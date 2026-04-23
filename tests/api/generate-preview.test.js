// tests/api/generate-preview.test.js
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Set env vars before the module is imported. The handler reads these at
// runtime (inside the function body), so they can also be mutated per-test.
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'

const mockFetch = vi.fn()
global.fetch = mockFetch

// ── Test helpers ─────────────────────────────────────────────────────────────

function mockReq(body, headers = {}) {
  return {
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': '1.2.3.4', ...headers },
  }
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(data) { this.body = data; return this },
    end() { return this },
  }
  return res
}

function redisIncrResponse(count) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ result: count }),
  })
}

function redisExpireResponse() {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ result: 1 }),
  })
}

function anthropicSuccess(text) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      content: [{ type: 'text', text }],
    }),
  })
}

const DEFAULT_TEXT = Array.from({ length: 10 }, (_, i) => `Line ${i}`).join('\n')

// Routes fetch calls to the correct mock response based on URL pattern.
function setupFetch({ incrCount = 2 } = {}, previewText = DEFAULT_TEXT) {
  mockFetch.mockImplementation((url) => {
    if (url.includes('/incr/')) return redisIncrResponse(incrCount)
    if (url.includes('/expire/')) return redisExpireResponse()
    if (url.includes('api.anthropic.com')) return anthropicSuccess(previewText)
    return Promise.reject(new Error(`Unexpected fetch to: ${url}`))
  })
}

const { default: handler } = await import('../../api/generate-preview.js')

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generate-preview API', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  // ── Content gating ──────────────────────────────────────────────────────────

  describe('server-side content gating — 40% truncation', () => {
    it('returns only the first 40% of lines in the text field', async () => {
      const lines = Array.from({ length: 10 }, (_, i) => `Line ${i}`)
      setupFetch({ incrCount: 2 }, lines.join('\n'))

      const req = mockReq({ prompt: 'Generate an NDA for Acme Corp.' })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      // cutoff = Math.floor(10 * 0.4) = 4 → first 4 lines visible
      const responseLines = res.body.text.split('\n')
      expect(responseLines).toHaveLength(4)
      expect(responseLines[0]).toBe('Line 0')
      expect(responseLines[3]).toBe('Line 3')
    })

    it('sets lockedLineCount to the number of hidden lines', async () => {
      const lines = Array.from({ length: 10 }, (_, i) => `Line ${i}`)
      setupFetch({ incrCount: 2 }, lines.join('\n'))

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      // 10 lines total, 4 visible → 6 locked
      expect(res.body.lockedLineCount).toBe(6)
    })

    it('extracts ## and ### headings from the locked portion into lockedSectionTitles', async () => {
      const lines = [
        'Line 0', 'Line 1', 'Line 2', 'Line 3',    // visible (40% of 10)
        '## Obligations', 'Some obligation text.',
        '### Payment Terms', 'Payment content.',
        '## Termination', 'Termination content.',   // locked (60%)
      ]
      setupFetch({ incrCount: 2 }, lines.join('\n'))

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      expect(res.body.lockedSectionTitles).toEqual([
        'Obligations',
        'Payment Terms',
        'Termination',
      ])
    })

    it('does not include visible-section headings in lockedSectionTitles', async () => {
      const lines = [
        '## Introduction', 'Line 1', 'Line 2', 'Line 3', // visible
        '## Obligations', 'Line 5', 'Line 6', 'Line 7', 'Line 8', 'Line 9',
      ]
      setupFetch({ incrCount: 2 }, lines.join('\n'))

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      // "Introduction" is in the visible half — must not appear in lockedSectionTitles
      expect(res.body.lockedSectionTitles).not.toContain('Introduction')
      expect(res.body.lockedSectionTitles).toContain('Obligations')
    })

    it('sets isPreview: true', async () => {
      setupFetch()

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      expect(res.body.isPreview).toBe(true)
    })

    it('includes a receipt object', async () => {
      setupFetch()

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      expect(res.body.receipt).toBeTruthy()
    })
  })

  // ── Integration: locked body text never leaves the server ───────────────────

  describe('integration — locked body text never in response', () => {
    it('response JSON does not contain any text from the locked 60%', async () => {
      const lines = [
        'Visible line 1', 'Visible line 2', 'Visible line 3', 'Visible line 4',
        'SECRET CLAUSE: Do not send this to the client.',
        'More locked content.',
        'Locked obligations clause.',
        'Locked payment terms clause.',
        'Locked termination clause.',
        'Locked signature block.',
      ]
      setupFetch({ incrCount: 2 }, lines.join('\n'))

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      const jsonStr = JSON.stringify(res.body)
      expect(jsonStr).not.toContain('SECRET CLAUSE: Do not send this to the client.')
      expect(jsonStr).not.toContain('More locked content.')
      expect(jsonStr).not.toContain('Locked obligations clause.')
    })

    it('visible text in response matches exactly the first 40% of lines', async () => {
      const lines = Array.from({ length: 20 }, (_, i) => `Unique content line ${i}`)
      setupFetch({ incrCount: 2 }, lines.join('\n'))

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      // cutoff = Math.floor(20 * 0.4) = 8 → lines 0–7 visible
      const expectedVisible = lines.slice(0, 8).join('\n')
      expect(res.body.text).toBe(expectedVisible)

      // Lines 8–19 must not appear anywhere in the response
      for (const line of lines.slice(8)) {
        expect(JSON.stringify(res.body)).not.toContain(line)
      }
    })
  })

  // ── Redis rate limiter ──────────────────────────────────────────────────────

  describe('Redis rate limiter', () => {
    it('uses the monthly key pattern preview:ratelimit:{ip}:{YYYY-MM}', async () => {
      setupFetch({ incrCount: 1 })

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      const incrCall = mockFetch.mock.calls.find(([url]) => url.includes('/incr/'))
      expect(incrCall).toBeTruthy()

      const now = new Date()
      const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
      const expectedKeyFragment = encodeURIComponent(`preview:ratelimit:1.2.3.4:${yearMonth}`)
      expect(incrCall[0]).toContain(expectedKeyFragment)
    })

    it('calls EXPIRE on the first request of the month (count === 1)', async () => {
      setupFetch({ incrCount: 1 })

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      const expireCall = mockFetch.mock.calls.find(([url]) => url.includes('/expire/'))
      expect(expireCall).toBeTruthy()
    })

    it('does NOT call EXPIRE on subsequent requests within the month', async () => {
      setupFetch({ incrCount: 3 })

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      const expireCall = mockFetch.mock.calls.find(([url]) => url.includes('/expire/'))
      expect(expireCall).toBeUndefined()
    })

    it('allows requests when count is exactly at the limit (count === 5)', async () => {
      setupFetch({ incrCount: 5 })

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
    })

    it('returns 429 when count exceeds 5', async () => {
      setupFetch({ incrCount: 6 })

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(429)
      expect(res.body.rateLimited).toBe(true)
      expect(res.body.error).toContain('5 free previews')
    })

    it('429 response includes limitResetAt pointing to start of next month (UTC)', async () => {
      setupFetch({ incrCount: 6 })

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      expect(res.body.limitResetAt).toBeTruthy()
      const resetDate = new Date(res.body.limitResetAt)
      expect(resetDate.getUTCDate()).toBe(1)
      expect(resetDate.getUTCHours()).toBe(0)
      expect(resetDate.getUTCMinutes()).toBe(0)
      expect(resetDate > new Date()).toBe(true)
    })

    it('does NOT call Anthropic API when rate limit is exceeded', async () => {
      setupFetch({ incrCount: 6 })

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      const anthropicCall = mockFetch.mock.calls.find(([url]) => url.includes('api.anthropic.com'))
      expect(anthropicCall).toBeUndefined()
    })

    it('fails open when Redis INCR throws — allows the preview through', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('/incr/')) return Promise.reject(new Error('Redis connection refused'))
        if (url.includes('api.anthropic.com')) return anthropicSuccess(DEFAULT_TEXT)
        return Promise.reject(new Error(`Unexpected fetch to: ${url}`))
      })

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
    })

    it('fails open when Redis returns a non-ok HTTP response', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('/incr/')) return Promise.resolve({ ok: false, status: 503 })
        if (url.includes('api.anthropic.com')) return anthropicSuccess(DEFAULT_TEXT)
        return Promise.reject(new Error(`Unexpected fetch to: ${url}`))
      })

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
    })

    it('skips Redis entirely when env vars are not set', async () => {
      const savedUrl = process.env.UPSTASH_REDIS_REST_URL
      const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN
      try {
        delete process.env.UPSTASH_REDIS_REST_URL
        delete process.env.UPSTASH_REDIS_REST_TOKEN

        mockFetch.mockImplementation((url) => {
          if (url.includes('api.anthropic.com')) return anthropicSuccess(DEFAULT_TEXT)
          return Promise.reject(new Error(`Unexpected fetch to: ${url}`))
        })

        const req = mockReq({ prompt: 'NDA' })
        const res = mockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(200)
        const redisCall = mockFetch.mock.calls.find(([url]) => url.includes('upstash.io'))
        expect(redisCall).toBeUndefined()
      } finally {
        process.env.UPSTASH_REDIS_REST_URL = savedUrl
        process.env.UPSTASH_REDIS_REST_TOKEN = savedToken
      }
    })
  })

  // ── Error handling ──────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 405 for non-POST requests', async () => {
      const req = { method: 'GET', headers: {} }
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(405)
    })

    it('returns 400 when prompt is missing', async () => {
      setupFetch()
      const req = mockReq({})
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toContain('Missing prompt')
    })

    it('returns 500 when Anthropic returns a non-ok response', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('/incr/')) return redisIncrResponse(2)
        if (url.includes('/expire/')) return redisExpireResponse()
        if (url.includes('api.anthropic.com')) return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: { message: 'Anthropic error' } }),
          text: () => Promise.resolve('Anthropic error'),
        })
        return Promise.reject(new Error(`Unexpected: ${url}`))
      })

      const req = mockReq({ prompt: 'NDA' })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(500)
    })
  })
})
