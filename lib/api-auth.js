// lib/api-auth.js
// Shared authentication middleware for all ebenova.dev API routes
// Usage:
//   import { authenticate } from '../../lib/api-auth.js'
//   const auth = await authenticate(req)
//   if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

import { getRedis, apiKeyRedisKey, usageRedisKey } from './redis.js'

const TIER_LIMITS = {
  free:       { requestsPerMin: 10,  docsPerMonth: 5   },
  starter:    { requestsPerMin: 60,  docsPerMonth: 100  },
  growth:     { requestsPerMin: 120, docsPerMonth: 500  },
  scale:      { requestsPerMin: 300, docsPerMonth: 2000 },
  enterprise: { requestsPerMin: 999, docsPerMonth: 99999 },
}

/**
 * Validate the Bearer token, look up key data in Redis, and return
 * enriched auth context. Does NOT increment usage — call `recordUsage(auth)`
 * after a successful generation so failed requests don't count.
 */
export async function authenticate(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization']

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: {
        code: 'MISSING_AUTH',
        message: 'Authorization header required',
        hint: 'Add header: Authorization: Bearer sk_live_your_key',
      },
    }
  }

  const rawKey = authHeader.replace('Bearer ', '').trim()

  // Allow test key in non-production without Redis
  if (process.env.NODE_ENV !== 'production' && rawKey === 'sk_test_local_dev') {
    return {
      ok: true,
      key: rawKey,
      keyData: { owner: 'dev@local', tier: 'growth', monthlyLimit: 500, label: 'Local dev key' },
      usedThisMonth: 0,
      monthlyLimit: 500,
    }
  }

  let redis
  try {
    redis = getRedis()
  } catch {
    return { ok: false, status: 500, error: { code: 'SERVER_ERROR', message: 'Auth service unavailable' } }
  }

  // Fetch key metadata
  const keyMeta = await redis.get(apiKeyRedisKey(rawKey))
  if (!keyMeta) {
    return {
      ok: false,
      status: 401,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
        hint: 'Get your API key at ebenova.dev/dashboard',
      },
    }
  }

  const keyData = typeof keyMeta === 'string' ? JSON.parse(keyMeta) : keyMeta

  if (keyData.disabled) {
    return {
      ok: false,
      status: 403,
      error: { code: 'KEY_DISABLED', message: 'This API key has been disabled' },
    }
  }

  const tierConfig = TIER_LIMITS[keyData.tier] || TIER_LIMITS.free
  const monthlyLimit = keyData.monthlyLimit ?? tierConfig.docsPerMonth

  // Fetch current month usage
  const usageKey = usageRedisKey(rawKey)
  const rawUsage = await redis.get(usageKey)
  const usedThisMonth = rawUsage ? parseInt(rawUsage, 10) : 0

  if (usedThisMonth >= monthlyLimit) {
    return {
      ok: false,
      status: 429,
      error: {
        code: 'MONTHLY_LIMIT_REACHED',
        message: `Monthly document limit reached (${monthlyLimit})`,
        hint: 'Upgrade your plan at ebenova.dev/pricing',
      },
    }
  }

  // ── Per-minute rate limiting ──────────────────────────────────────────────
  const tierConfig2 = TIER_LIMITS[keyData.tier] || TIER_LIMITS.free
  const rpm = tierConfig2.requestsPerMin
  try {
    const now = new Date()
    const minuteKey = `ratelimit:${rawKey}:${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}T${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`
    const currentCount = await redis.incr(minuteKey)
    // Set 120s TTL on first write (covers the minute + buffer)
    if (currentCount === 1) await redis.expire(minuteKey, 120)
    if (currentCount > rpm) {
      return {
        ok: false,
        status: 429,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded (${rpm} requests/minute for ${keyData.tier} tier)`,
          hint: 'Slow down or upgrade your plan at ebenova.dev/pricing',
          retry_after_seconds: 60,
        },
      }
    }
  } catch (err) {
    // Non-fatal — don't block requests over a rate limit tracking error
    console.error('Rate limit check error:', err)
  }

  return { ok: true, key: rawKey, keyData, usedThisMonth, monthlyLimit }
}

/**
 * Increment usage counter for the given auth context.
 * Call this only after a document has been successfully generated.
 * Sets a 35-day TTL so old usage keys self-clean.
 */
export async function recordUsage(auth) {
  try {
    const redis = getRedis()
    const usageKey = usageRedisKey(auth.key)
    await redis.incr(usageKey)
    // Set TTL on first write (35 days — covers month rollover)
    if (auth.usedThisMonth === 0) {
      await redis.expire(usageKey, 60 * 60 * 24 * 35)
    }
  } catch (err) {
    // Non-fatal — don't fail the request over a usage tracking error
    console.error('recordUsage error:', err)
  }
}

/**
 * Build the standard usage block included in every API response.
 */
export function buildUsageBlock(auth, incrementedBy = 1) {
  const used = auth.usedThisMonth + incrementedBy
  return {
    documents_used: used,
    documents_remaining: Math.max(0, auth.monthlyLimit - used),
    monthly_limit: auth.monthlyLimit,
    resets_at: nextMonthISO(),
  }
}

/**
 * Detect whether a request is coming from an AI agent (MCP, Claude, Cursor, etc.)
 * Returns { isAgent: bool, agentType: string|null }
 */
export function detectAgent(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase()
  const agents = [
    ['claude',       'claude'],
    ['cursor',       'cursor'],
    ['copilot',      'github-copilot'],
    ['codeium',      'codeium'],
    ['smithery',     'smithery'],
    ['mcp',          'mcp-client'],
    ['anthropic',    'anthropic'],
    ['openai',       'openai'],
    ['langchain',    'langchain'],
    ['autogpt',      'autogpt'],
  ]
  for (const [match, label] of agents) {
    if (ua.includes(match)) return { isAgent: true, agentType: label }
  }
  // Heuristic: no browser UA markers = likely automated
  const hasBrowser = ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari')
  if (!hasBrowser && ua.length > 0) return { isAgent: true, agentType: 'unknown-agent' }
  return { isAgent: false, agentType: null }
}

/**
 * Track a request in Redis with agent signal.
 * Writes to: api:requests:{YYYY-MM}:{apiKey} (monthly count)
 *            api:agents:{YYYY-MM}:{agentType} (agent breakdown)
 * Non-fatal — never throws.
 */
export async function trackRequest(auth, req) {
  try {
    const redis = getRedis()
    const month = new Date().toISOString().slice(0, 7)
    const { isAgent, agentType } = detectAgent(req)
    const TTL = 60 * 60 * 24 * 35 // 35 days

    // Per-key request count (separate from document usage)
    const reqKey = `api:requests:${month}:${auth.key}`
    await redis.incr(reqKey)
    await redis.expire(reqKey, TTL)

    // Agent breakdown
    if (isAgent && agentType) {
      const agentKey = `api:agents:${month}:${agentType}`
      await redis.incr(agentKey)
      await redis.expire(agentKey, TTL)
    }
  } catch {
    // Non-fatal — usage tracking should never break a request
  }
}

function nextMonthISO() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
}
