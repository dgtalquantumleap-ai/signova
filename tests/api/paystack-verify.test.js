// Tests for api/paystack-verify.js
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Set required env vars before importing the module
process.env.PAYSTACK_SECRET_KEY = 'sk_test_paystack_key'

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

function paystackResponse(status, txStatus, amount) {
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        status,
        data: {
          status: txStatus,
          amount,
          reference: 'ref_test_123',
          currency: 'NGN',
          customer: { email: 'test@example.com' },
          metadata: {},
        },
      }),
  })
}

const { default: handler } = await import('../../api/paystack-verify.js')

describe('api/paystack-verify.js', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns 405 for GET requests', async () => {
    const req = mockReq({}, 'GET')
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 400 for missing reference', async () => {
    const req = mockReq({})
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/Missing Paystack reference/i)
  })

  it('returns 400 when Paystack API returns data.status !== "success"', async () => {
    mockFetch.mockResolvedValueOnce(paystackResponse(true, 'failed', 100000))

    const req = mockReq({ reference: 'ref_failed' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.verified).toBe(false)
    expect(res.body.error).toMatch(/failed/i)
  })

  it('returns 402 when tx.amount < 100000 kobo (amount too low)', async () => {
    mockFetch.mockResolvedValueOnce(paystackResponse(true, 'success', 50000)) // 50000 kobo = ₦500

    const req = mockReq({ reference: 'ref_low_amount' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(402)
    expect(res.body.verified).toBe(false)
    expect(res.body.error).toMatch(/insufficient/i)
  })

  it('returns 200 with verified:true for valid payment with sufficient amount', async () => {
    mockFetch.mockResolvedValueOnce(paystackResponse(true, 'success', 150000)) // ₦1,500

    const req = mockReq({ reference: 'ref_valid' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.verified).toBe(true)
    expect(res.body.reference).toBe('ref_test_123')
    expect(res.body.amount).toBe(150000)
    expect(res.body.currency).toBe('NGN')
  })
})
