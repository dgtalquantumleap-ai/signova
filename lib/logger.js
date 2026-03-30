// lib/logger.js
// Centralized error logging for all API routes
// Usage:
//   import { logError, logInfo } from '../../lib/logger.js'
//   logError('POST /v1/documents/generate', { status: 500, message: err.message })

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO : LOG_LEVELS.INFO

function formatLog(level, endpoint, data) {
  return {
    timestamp: new Date().toISOString(),
    level,
    endpoint,
    ...data,
    environment: process.env.NODE_ENV || 'development',
  }
}

export function logDebug(endpoint, data) {
  if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
    console.log('[DEBUG]', JSON.stringify(formatLog('DEBUG', endpoint, data)))
  }
}

export function logInfo(endpoint, data) {
  if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
    console.log('[INFO]', JSON.stringify(formatLog('INFO', endpoint, data)))
  }
}

export function logWarn(endpoint, data) {
  if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
    console.warn('[WARN]', JSON.stringify(formatLog('WARN', endpoint, data)))
  }
}

export function logError(endpoint, data) {
  if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
    console.error('[ERROR]', JSON.stringify(formatLog('ERROR', endpoint, data)))
  }
}

/**
 * Log detailed error with stack trace for debugging
 */
export function logDetailedError(endpoint, error, context = {}) {
  const errorData = {
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    status: error.status || 500,
    stack: error.stack,
    ...context,
  }
  logError(endpoint, errorData)
}

/**
 * Log API request/response metrics
 */
export function logRequest(endpoint, method, status, durationMs, keyData = {}) {
  logInfo(endpoint, {
    method,
    status,
    duration_ms: durationMs,
    ...keyData,
  })
}
