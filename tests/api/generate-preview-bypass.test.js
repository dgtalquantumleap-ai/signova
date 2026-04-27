// tests/api/generate-preview-bypass.test.js
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

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
    headers: { 'x-forwarded-for': '9.9.9.9', ...headers },
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

function anthropicSuccess(text = 'Line 0\nLine 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9') {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ content: [{ type: 'text', text }] }),
  })
}

// Routes fetch calls: Redis INCR returns overLimitCount (simulating cap exceeded),
// Anthropic returns success. Used to verify bypass paths skip Redis entirely.
function setupFetchOverLimit(incrCount = 6) {
  mockFetch.mockImplementation((url) => {
    if (url.includes('/incr/')) return redisIncrResponse(incrCount)
    if (url.includes('/expire/')) return redisExpireResponse()
    if (url.includes('api.anthropic.com')) return anthropicSuccess()
    return Promise.reject(new Error(`Unexpected fetch to: ${url}`))
  })
}

const { default: handler } = await import('../../api/generate-preview.js')

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generate-preview — founder & promo bypasses', () => {
  let savedFounderEmails

  beforeEach(() => {
    mockFetch.mockReset()
    savedFounderEmails = process.env.FOUNDER_BYPASS_EMAILS
  })

  afterEach(() => {
    if (savedFounderEmails === undefined) {
      delete process.env.FOUNDER_BYPASS_EMAILS
    } else {
      process.env.FOUNDER_BYPASS_EMAILS = savedFounderEmails
    }
  })

  it('founder email in FOUNDER_BYPASS_EMAILS bypasses rate limit', async () => {
    process.env.FOUNDER_BYPASS_EMAILS = 'olumide@ebenova.net,admin@getsignova.com'
    // Redis would return 6 (over limit) if reached — but founder bypass should
    // prevent any Redis call.
    setupFetchOverLimit(6)

    const req = mockReq({ prompt: 'Generate an NDA', email: 'olumide@ebenova.net' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const redisCall = mockFetch.mock.calls.find(([url]) => url.includes('/incr/'))
    expect(redisCall).toBeUndefined()
  })

  it('non-founder email respects the rate limit', async () => {
    process.env.FOUNDER_BYPASS_EMAILS = 'olumide@ebenova.net'
    setupFetchOverLimit(6)

    const req = mockReq({ prompt: 'Generate an NDA', email: 'random@user.com' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body.rateLimited).toBe(true)
  })

  it.each(['OLUMIDE', 'ROSEMARY', 'VERYWISEMAN'])(
    'valid promo code %s bypasses rate limit for a non-founder',
    async (code) => {
      process.env.FOUNDER_BYPASS_EMAILS = ''
      setupFetchOverLimit(6)

      const req = mockReq({ prompt: 'Generate an NDA', promoCode: code })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      const redisCall = mockFetch.mock.calls.find(([url]) => url.includes('/incr/'))
      expect(redisCall).toBeUndefined()
    }
  )

  it('429 response body includes requires_payment: true and paid_generation_url', async () => {
    process.env.FOUNDER_BYPASS_EMAILS = ''
    setupFetchOverLimit(6)

    const req = mockReq({ prompt: 'Generate an NDA' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body.requires_payment).toBe(true)
    expect(res.body.paid_generation_url).toBe('/api/generate')
    expect(res.body.code).toBe('PREVIEW_CAP_REACHED')
    expect(res.body.promo_code_field_visible).toBe(true)
  })

  it('empty FOUNDER_BYPASS_EMAILS does not crash; rate limit applies normally', async () => {
    process.env.FOUNDER_BYPASS_EMAILS = ''
    setupFetchOverLimit(6)

    const req = mockReq({ prompt: 'Generate an NDA', email: 'someone@example.com' })
    const res = mockRes()
    await handler(req, res)

    // Rate limit fires normally — no bypass
    expect(res.statusCode).toBe(429)
    expect(res.body.rateLimited).toBe(true)
  })
})
