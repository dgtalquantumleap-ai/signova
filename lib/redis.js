// lib/redis.js
// Upstash Redis client — shared across all API routes
// Docs: https://upstash.com/docs/redis/sdks/javascriptsdk/getstarted

import { Redis } from '@upstash/redis'

// Lazily initialised so missing env vars don't crash the whole app at boot
let _client = null

export function getRedis() {
  if (_client) return _client
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env vars')
  }
  _client = new Redis({ url, token })
  return _client
}

// ─── Key schema ────────────────────────────────────────────────────────────────
// apikey:{key}          → JSON string  { owner, tier, monthlyLimit, label, createdAt }
// usage:{key}:{YYYY-MM} → integer      incremented on each successful request
// ───────────────────────────────────────────────────────────────────────────────

export function apiKeyRedisKey(key) {
  return `apikey:${key}`
}

export function usageRedisKey(key) {
  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  return `usage:${key}:${month}`
}

export function usageRedisKeyForMonth(key, yearMonth) {
  return `usage:${key}:${yearMonth}`
}
