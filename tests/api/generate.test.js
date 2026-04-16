// Tests for api/generate.js
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Set required env vars before importing the module
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.OXAPAY_MERCHANT_KEY = 'test-oxapay-key'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('stripe', () => {
  const mockRetrieve = vi.fn().mockResolvedValue({
    payment_status: 'paid',
    id: 'cs_test_123',
  })
  function MockStripe() {
    return {
      checkout: {
        sessions: {
          retrieve: mockRetrieve,
        },
      },
    }
  }
  return { default: MockStripe }
})

function mockReq(body, method = 'POST', headers = {}) {
  return {
    method,
    body,
    headers: { host: 'localhost:3000', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
  }
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.body = data
      return this
    },
    end() {
      return this
    },
  }
  return res
}

// Anthropic success response
function anthropicSuccess(text = 'Generated legal document content.') {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        content: [{ type: 'text', text }],
      }),
  })
}

// Redis GET response (null = key not set)
function redisGetResponse(value) {
  return Promise.resolve({
    json: () => Promise.resolve({ result: value }),
  })
}

// Redis SET response
function redisSetResponse() {
  return Promise.resolve({
    json: () => Promise.resolve({ result: 'OK' }),
  })
}

// OxaPay paid response
function oxaPayPaidResponse(status = 'Paid', payAmount = '5.00') {
  return Promise.resolve({
    json: () =>
      Promise.resolve({
        result: 100,
        status,
        payAmount,
        amount: payAmount,
        currency: 'USD',
      }),
  })
}

// OxaPay failed response
function oxaPayFailedResponse(result = 200, status = 'Failed') {
  return Promise.resolve({
    json: () =>
      Promise.resolve({
        result,
        status,
        message: 'Inquiry failed',
      }),
  })
}

const { default: handler } = await import('../../api/generate.js')

describe('api/generate.js', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns 405 for GET requests', async () => {
    const req = mockReq({}, 'GET')
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 400 if prompt is missing', async () => {
    const req = mockReq({ sessionId: 'cs_test_123' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/Missing prompt/i)
  })

  it('returns 400 if prompt exceeds 8000 characters', async () => {
    const req = mockReq({ prompt: 'a'.repeat(8001), sessionId: 'cs_test_123' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/too long/i)
  })

  it('returns 403 if no auth method provided', async () => {
    const req = mockReq({ prompt: 'Generate an NDA' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toMatch(/Payment verification required/i)
  })

  it('returns 403 when OxaPay result !== 100', async () => {
    mockFetch.mockResolvedValueOnce(oxaPayFailedResponse(200, 'Failed'))

    const req = mockReq({ prompt: 'Generate an NDA', oxapayTrackId: 'track_abc' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toMatch(/OxaPay payment verification failed/i)
  })

  it('returns 403 when OxaPay status is "Failed"', async () => {
    // result is 100 but status is Failed (not Paid/Confirming)
    mockFetch.mockResolvedValueOnce(
      Promise.resolve({
        json: () =>
          Promise.resolve({
            result: 100,
            status: 'Failed',
          }),
      })
    )

    const req = mockReq({ prompt: 'Generate an NDA', oxapayTrackId: 'track_abc' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toMatch(/not completed/i)
  })

  it('returns 409 for OxaPay idempotency: Redis GET returns "1" for used trackId', async () => {
    // OxaPay inquiry succeeds
    mockFetch
      .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00'))
      // Redis GET for idempotency key returns '1' (already used)
      .mockResolvedValueOnce(redisGetResponse('1'))

    const req = mockReq({ prompt: 'Generate an NDA', oxapayTrackId: 'track_used' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toMatch(/already been used/i)
  })

  it('returns 409 for Stripe idempotency: Redis GET returns "1" for used sessionId', async () => {
    // Stripe mock returns paid status (from vi.mock above)
    // Redis GET for idempotency key returns '1' (already used)
    mockFetch.mockResolvedValueOnce(redisGetResponse('1'))

    const req = mockReq({ prompt: 'Generate an NDA', sessionId: 'cs_test_used' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toMatch(/already been used/i)
  })

  it('returns 200 with text and isPremium:true for valid OxaPay payment', async () => {
    mockFetch
      .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00')) // OxaPay inquiry
      .mockResolvedValueOnce(redisGetResponse(null)) // Redis GET (not used)
      .mockResolvedValueOnce(anthropicSuccess('Here is your NDA document.')) // Anthropic
      .mockResolvedValueOnce(redisSetResponse()) // Redis SET after generation

    const req = mockReq({ prompt: 'Generate an NDA', oxapayTrackId: 'track_new' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.text).toBe('Here is your NDA document.')
    expect(res.body.isPremium).toBe(true)
  })

  it('calls Redis SET for the idempotency key after successful OxaPay generation', async () => {
    mockFetch
      .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00')) // OxaPay inquiry
      .mockResolvedValueOnce(redisGetResponse(null)) // Redis GET (not used)
      .mockResolvedValueOnce(anthropicSuccess('Generated document.')) // Anthropic
      .mockResolvedValueOnce(redisSetResponse()) // Redis SET

    const req = mockReq({ prompt: 'Generate an NDA', oxapayTrackId: 'track_set_test' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)

    // Verify a Redis SET call was made for the idempotency key
    // URL uses encodeURIComponent so ':' becomes '%3A'
    const setCalls = mockFetch.mock.calls.filter(
      ([url]) =>
        typeof url === 'string' &&
        (url.includes('payment:used:oxapay') || url.includes('payment%3Aused%3Aoxapay'))
    )
    expect(setCalls.length).toBeGreaterThan(0)
  })
})
