// lib/vigil-helpers.js
// Shared utilities for Vigil fraud detection endpoints.

import { getRedis } from './redis.js'

// ── Tier gating ──
export const AUTH_TIERS = ['starter', 'growth', 'scale', 'enterprise']
export const AI_TIERS = ['growth', 'scale', 'enterprise']
export const REPORT_TIERS = ['scale', 'enterprise']

// ── Per-tier monthly authorization limits ──
export const VIGIL_MONTHLY_LIMITS = {
  starter: 500,
  growth: 5000,
  scale: 25000,
  enterprise: 100000,
}

// ── Redis key helpers ──
export function vigilRedisKey(apiKey, stat) {
  const now = new Date()
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  return `vigil:${apiKey}:${ym}:${stat}`
}

export function vigilCardKey(apiKey, cardId) {
  return `vigil:card:${apiKey}:${cardId}`
}

export function vigilGpsKey(apiKey, cardId) {
  return `vigil:gps:${apiKey}:${cardId}`
}

// ── Check Vigil-specific monthly quota ──
export async function checkVigilQuota(auth) {
  const tier = auth.keyData?.tier
  const limit = VIGIL_MONTHLY_LIMITS[tier]
  if (!limit) return { ok: true } // enterprise or unknown — no hard limit

  const redis = getRedis()
  const key = vigilRedisKey(auth.key, 'authorizations')
  const used = parseInt(await redis.get(key) || '0', 10)

  if (used >= limit) {
    return {
      ok: false,
      error: {
        code: 'VIGIL_QUOTA_EXCEEDED',
        message: `Monthly Vigil authorization limit reached (${limit} for ${tier} tier)`,
        hint: 'Upgrade at ebenova.dev/pricing for higher limits',
        used,
        limit,
      },
    }
  }
  return { ok: true, used, limit }
}

// ── Increment Vigil authorization counter ──
export async function recordVigilUsage(auth, stat = 'authorizations') {
  try {
    const redis = getRedis()
    const key = vigilRedisKey(auth.key, stat)
    const count = await redis.incr(key)
    if (count === 1) {
      // Expire at end of month (~31 days)
      await redis.expire(key, 86400 * 32)
    }
  } catch (err) {
    console.error('[vigil] Usage tracking error:', err.message)
  }
}

// ── Body parser (shared) ──
export async function parseBody(req) {
  if (req.body && typeof req.body === 'object' && req.body !== null) return req.body
  return new Promise((resolve) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}

// ── CORS headers ──
export function setCors(res, methods = 'POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// ── Get or initialize card data from Redis ──
export async function getCardData(auth, cardId) {
  const redis = getRedis()
  const key = vigilCardKey(auth.key, cardId)
  const data = await redis.get(key)
  if (data) return typeof data === 'string' ? JSON.parse(data) : data
  // Return default card if none registered
  return null
}

// ── Get GPS data from Redis ──
export async function getGpsData(auth, cardId) {
  const redis = getRedis()
  const key = vigilGpsKey(auth.key, cardId)
  const data = await redis.get(key)
  if (data) return typeof data === 'string' ? JSON.parse(data) : data
  return null
}

// ── Save card data to Redis ──
export async function saveCardData(auth, cardId, cardData) {
  const redis = getRedis()
  const key = vigilCardKey(auth.key, cardId)
  await redis.set(key, JSON.stringify(cardData))
}

// ── Save GPS data to Redis ──
export async function saveGpsData(auth, cardId, gpsData) {
  const redis = getRedis()
  const key = vigilGpsKey(auth.key, cardId)
  await redis.set(key, JSON.stringify({ ...gpsData, recorded_at: new Date().toISOString() }))
  // GPS data expires after 1 hour (stale beyond that)
  await redis.expire(key, 3600)
}
