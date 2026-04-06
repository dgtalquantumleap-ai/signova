// Tests for CORS middleware
import { describe, it, expect } from 'vitest'
import { applyCorsHeaders, handleOptions } from '../../lib/cors-middleware.js'

describe('lib/cors-middleware.js', () => {
  describe('applyCorsHeaders', () => {
    it('should reflect origin if on allowlist', () => {
      const req = { headers: { origin: 'https://www.getsignova.com' } }
      const res = { headers: new Map(), setHeader(key, value) { this.headers.set(key, value) } }
      
      applyCorsHeaders(req, res)
      
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://www.getsignova.com')
      expect(res.headers.get('Vary')).toBe('Origin')
    })

    it('should NOT reflect origin if not on allowlist', () => {
      const req = { headers: { origin: 'https://evil.com' } }
      const res = { headers: new Map(), setHeader(key, value) { this.headers.set(key, value) } }
      
      applyCorsHeaders(req, res)
      
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeUndefined()
    })

    it('should set standard CORS headers', () => {
      const req = { headers: { origin: 'https://www.getsignova.com' } }
      const res = { headers: new Map(), setHeader(key, value) { this.headers.set(key, value) } }
      
      applyCorsHeaders(req, res)
      
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS')
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
    })

    it('should handle missing origin header', () => {
      const req = { headers: {} }
      const res = { headers: new Map(), setHeader(key, value) { this.headers.set(key, value) } }
      
      applyCorsHeaders(req, res)
      
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeUndefined()
    })
  })

  describe('handleOptions', () => {
    it('should return true and end response for OPTIONS requests', () => {
      const req = { method: 'OPTIONS' }
      const res = { status(code) { this.statusCode = code; return this }, end() { this.ended = true } }
      
      const result = handleOptions(req, res)
      
      expect(result).toBe(true)
      expect(res.statusCode).toBe(200)
      expect(res.ended).toBe(true)
    })

    it('should return false for non-OPTIONS requests', () => {
      const req = { method: 'POST' }
      const res = {}
      
      const result = handleOptions(req, res)
      
      expect(result).toBe(false)
    })
  })
})
