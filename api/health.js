// api/health.js
// Health check endpoint for monitoring and uptime checks.
// Returns service status, dependencies, and uptime information.
//
// Usage: GET https://api.ebenova.dev/health
// Used by: Uptime monitors, CI/CD checks, deployment verification

import { getRedis } from '../lib/redis.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startTime = Date.now()
  const checks = {}
  let overallStatus = 'healthy'

  // Check Redis connectivity
  try {
    const redisCheckStart = Date.now()
    const redis = getRedis()
    await redis.ping()
    checks.redis = {
      status: 'connected',
      latency_ms: Date.now() - redisCheckStart,
    }
  } catch (err) {
    checks.redis = {
      status: 'disconnected',
      error: err.message,
    }
    overallStatus = 'degraded'
  }

  // Check required environment variables
  const requiredEnvVars = [
    'ANTHROPIC_API_KEY',
    'STRIPE_SECRET_KEY',
    'UPSTASH_REDIS_REST_URL',
  ]

  checks.environment = {
    node_env: process.env.NODE_ENV || 'development',
    missing_keys: requiredEnvVars.filter(key => !process.env[key]),
  }

  if (checks.environment.missing_keys.length > 0) {
    overallStatus = 'degraded'
  }

  // Memory usage
  const memUsage = process.memoryUsage()
  checks.memory = {
    rss_mb: Math.round(memUsage.rss / 1024 / 1024),
    heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
  }

  // Uptime
  checks.uptime = {
    seconds: Math.round(process.uptime()),
    human: formatUptime(process.uptime()),
  }

  const responseTime = Date.now() - startTime

  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    response_time_ms: responseTime,
    checks,
  })
}

function formatUptime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}
