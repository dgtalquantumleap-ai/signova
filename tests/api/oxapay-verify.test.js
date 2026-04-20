// Tests for api/oxapay-verify.js
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Set required env vars before importing the module
process.env.OXAPAY_MERCHANT_KEY = 'test-oxapay-key'

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockReq(body, method = 'POST', headers = {}) {
  return {
    method,
    body,
    headers,
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

function oxaPayResponse(result, status, payAmount) {
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        result,
        status,
        payAmount: String(payAmount),
        amount: String(payAmount),
        currency: 'USD',
        message: result !== 100 ? 'Inquiry failed' : undefined,
      }),
  })
}

const { default: handler } = await import('../../api/oxapay-verify.js')

describe('api/oxapay-verify.js', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns 405 for GET requests', async () => {
    const req = mockReq({}, 'GET')
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 400 for missing trackId', async () => {
    const req = mockReq({})
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/Missing trackId/i)
  })

  it('returns 400 when OxaPay result !== 100', async () => {
    mockFetch.mockResolvedValueOnce(oxaPayResponse(200, 'Failed', 0))

    const req = mockReq({ trackId: 'track_error' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.verified).toBe(false)
  })

  it('returns 400 when status is "Waiting" (not paid)', async () => {
    mockFetch.mockResolvedValueOnce(oxaPayResponse(100, 'Waiting', 0))

    const req = mockReq({ trackId: 'track_waiting' })
    const res = mockRes()
    await handler(req, res)
    // Waiting is not 'Paid' or 'Confirming' → verified: false, status 200 with verified=false
    expect(res.statusCode).toBe(200)
    expect(res.body.verified).toBe(false)
    expect(res.body.status).toBe('Waiting')
  })

  it('returns 402 when payAmount < 4.0 (amount too low)', async () => {
    mockFetch.mockResolvedValueOnce(oxaPayResponse(100, 'Paid', 3.5))

    const req = mockReq({ trackId: 'track_low_amount' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(402)
    expect(res.body.verified).toBe(false)
    expect(res.body.error).toMatch(/insufficient/i)
  })

  it('returns 200 with verified:true for status "Paid" with sufficient amount', async () => {
    mockFetch.mockResolvedValueOnce(oxaPayResponse(100, 'Paid', 5.0))

    const req = mockReq({ trackId: 'track_paid' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.verified).toBe(true)
    expect(res.body.status).toBe('Paid')
  })
})
