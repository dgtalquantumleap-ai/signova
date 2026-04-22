// Tests for api/generate.js
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Fixture loader — resolves relative to this test file.
const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '..', 'fixtures')
function loadFixture(name) {
  return readFileSync(join(FIXTURES, name), 'utf8')
}

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

// Anthropic response with a caller-controlled stop_reason. Used by the
// SIG-CBDB6556 reproduction tests to simulate the exact broken upstream
// responses (e.g. max_tokens truncation). Do not fold this into
// anthropicSuccess — the existing tests depend on the stop_reason being
// absent.
function anthropicResponse(text, stopReason = 'end_turn') {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        content: [{ type: 'text', text }],
        stop_reason: stopReason,
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
    // Premium docs are stamped with a Provenance block appended to the raw text.
    expect(res.body.text).toContain('Here is your NDA document.')
    expect(res.body.text).toContain('Document Provenance')
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

// ─────────────────────────────────────────────────────────────────────────────
// SIG-CBDB6556 reproduction tests — Phase 2 of the doc-pipeline bug fix plan.
//
// These tests deliberately fail today. They assert the behaviour the pipeline
// SHOULD exhibit for a paid Nigerian Service Agreement, given specific broken
// upstream responses captured as fixtures in tests/fixtures/. Each test
// reproduces one of the three bugs observed on SIG-CBDB6556:
//
//   Bug A — truncation at "**11." with stop_reason: max_tokens
//   Bug B — document header says SERVICE AGREEMENT, body says CONTRACT OF EMPLOYMENT
//   Bug C — clause 2.1 cites s.91 Labour Act worker-exemption AND clause 4
//           imposes PAYE / pension / NSITF / NHF / ITF simultaneously
//
// Every test uses a Nigerian Service Agreement prompt reconstructed from the
// Generator.jsx form (tests/fixtures/sig-cbdb6556-inputs.json). No real
// Anthropic call — the fixture text is injected via mockFetch.
// ─────────────────────────────────────────────────────────────────────────────

function serviceAgreementPromptNG({ classificationAnchor = 'independent contractor' } = {}) {
  // Phase 5 — the consumer path infers worker_classification from the
  // prompt. Tests focused on Bug A / Bug B / Bug C must supply a
  // classification anchor or they'll short-circuit with
  // WORKER_CLASSIFICATION_AMBIGUOUS before reaching the orchestrator.
  // Tests that exercise a specific classification mode pass their own
  // anchor; tests not about classification use the default.
  const inputs = JSON.parse(loadFixture('sig-cbdb6556-inputs.json'))
  const a = inputs.answers
  return (
    'Generate a professional, comprehensive Service Agreement document for the following business:\n\n' +
    `Service provider name / company: ${a.provider}\n` +
    `Client name / company: ${a.client}\n` +
    `Description of services: ${a.services}` +
    (classificationAnchor ? ` Engagement style: ${classificationAnchor}.\n` : '\n') +
    `Service fee / rate: ${a.fee}\n` +
    `Payment terms: ${a.paymentTerms}\n` +
    `Agreement duration: ${a.duration}\n` +
    `Governing law: ${a.country}\n` +
    `Who owns work created under this agreement?: ${a.ipOwnership}\n` +
    `Include confidentiality clause?: ${a.confidentiality}\n\n` +
    'Requirements:\n- Formal legal language.\nOutput the complete document only.'
  )
}

describe('api/generate.js — SIG-CBDB6556 reproductions (Phase 2)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('Bug A reproduction — must not ship 200 with truncation (dangling forward ref to Clause 15 with no clause 15 heading)', async () => {
    // Both Anthropic calls are truncated so the validator fails after the
    // continuation retry. We assert the handler does not return a 200 with
    // dangling forward references. The fail-closed contract (exact error
    // code + reference_id + log correlation) is verified in its own test
    // below.
    const truncated = loadFixture('sig-cbdb6556-truncated.txt')
    mockFetch
      .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00'))
      .mockResolvedValueOnce(redisGetResponse(null))
      .mockResolvedValueOnce(anthropicResponse(truncated, 'max_tokens'))
      // Continuation retry — also truncated (same fixture, same stop_reason).
      .mockResolvedValueOnce(anthropicResponse(truncated, 'max_tokens'))

    const req = mockReq({ prompt: serviceAgreementPromptNG(), oxapayTrackId: 'bug_a_repro_track' })
    const res = mockRes()
    await handler(req, res)

    const text = typeof res.body?.text === 'string' ? res.body.text : ''
    const hasForwardRefToC15 = /Clause\s+15\s*\(Termination\)/i.test(text)
    const hasClause15Heading = /(?:^|\n)\s*\*?\*?\s*15\.\s/m.test(text)
    const isDangling = hasForwardRefToC15 && !hasClause15Heading
    if (res.statusCode === 200) {
      expect(
        isDangling,
        `Handler returned 200 with a document that references "Clause 15 (Termination)" but never draws a clause 15 heading — Anthropic stop_reason was max_tokens on both attempts. Handler must fail-close, not ship a document with dangling forward references.`
      ).toBe(false)
    }
  })

  it('Bug A fail-closed — after continuation retry also truncates, returns 5xx with code=DOC_INCOMPLETE_AFTER_RETRY, reference_id, and log correlation', async () => {
    const truncated = loadFixture('sig-cbdb6556-truncated.txt')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockFetch
        .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00'))
        .mockResolvedValueOnce(redisGetResponse(null))
        .mockResolvedValueOnce(anthropicResponse(truncated, 'max_tokens'))
        // Continuation — still truncated.
        .mockResolvedValueOnce(anthropicResponse(truncated, 'max_tokens'))

      const req = mockReq({ prompt: serviceAgreementPromptNG(), oxapayTrackId: 'bug_a_failclosed_track' })
      const res = mockRes()
      await handler(req, res)

      // (a) 5xx
      expect(res.statusCode, 'fail-closed must return 5xx, not 200').toBeGreaterThanOrEqual(500)
      expect(res.statusCode).toBeLessThan(600)
      // (b) stable machine-readable error code — EXACT match
      expect(res.body?.code, 'error code must be the stable DOC_INCOMPLETE_AFTER_RETRY constant').toBe('DOC_INCOMPLETE_AFTER_RETRY')
      // (c) reference_id present in the response AND in the structured log
      const refId = res.body?.reference_id
      expect(typeof refId, 'response must include a reference_id string').toBe('string')
      expect(refId).toMatch(/^ref_[0-9a-f]+$/)
      // logger.js calls console.error('[ERROR]', JSON.stringify(payload)) —
      // scan ALL arguments of ALL calls so we don't miss the one carrying
      // the serialised payload.
      const loggedWithRef = errorSpy.mock.calls.some(args =>
        args.some(a => {
          const s = typeof a === 'string' ? a : JSON.stringify(a)
          return typeof s === 'string' && s.includes(refId)
        })
      )
      expect(
        loggedWithRef,
        `reference_id ${refId} returned to the client must also appear in a structured log event so ops can correlate user-visible errors with logs`
      ).toBe(true)
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('Bug A recovery — if continuation retry produces the missing clauses, returns 200 with the stitched document', async () => {
    const truncated = loadFixture('sig-cbdb6556-truncated.txt')
    const continuation = loadFixture('sig-cbdb6556-continuation-complete.txt')
    mockFetch
      .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00'))
      .mockResolvedValueOnce(redisGetResponse(null))
      .mockResolvedValueOnce(anthropicResponse(truncated, 'max_tokens'))
      // Continuation succeeds — contains clauses 12–16 including Termination + Governing Law + SIGNED.
      .mockResolvedValueOnce(anthropicResponse(continuation, 'end_turn'))
      // Post-Anthropic Redis SET for idempotency — all earlier audit-log
      // calls fall through and are swallowed by the non-fatal try/catch.
      .mockResolvedValueOnce(redisSetResponse())

    const req = mockReq({ prompt: serviceAgreementPromptNG(), oxapayTrackId: 'bug_a_recovery_track' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode, 'successful continuation must return 200').toBe(200)
    const text = typeof res.body?.text === 'string' ? res.body.text : ''
    // Both halves are in the response.
    expect(text, 'stitched document must contain a clause-11 opening from the first half').toMatch(/\*\*11\./)
    expect(text, 'stitched document must contain Clause 15 (Termination)').toMatch(/\*\*15\.\s+TERMINATION/)
    expect(text, 'stitched document must contain Governing Law').toMatch(/GOVERNING LAW/)
    // Provenance block still appended.
    expect(text).toContain('Document Provenance')
  })

  it('Bug B fail-closed — title/body mismatch returns 5xx with code=DOC_TITLE_BODY_MISMATCH, reference_id, and log correlation', async () => {
    const mismatch = loadFixture('sig-cbdb6556-title-mismatch.txt')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockFetch
        .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00'))
        .mockResolvedValueOnce(redisGetResponse(null))
        .mockResolvedValueOnce(anthropicResponse(mismatch, 'end_turn'))

      const req = mockReq({
        prompt: serviceAgreementPromptNG(),
        doc_type_id: 'service-agreement',
        oxapayTrackId: 'bug_b_track',
      })
      const res = mockRes()
      await handler(req, res)

      // (a) 5xx
      expect(res.statusCode, 'title/body mismatch must return 5xx, not 200').toBeGreaterThanOrEqual(500)
      expect(res.statusCode).toBeLessThan(600)
      // (b) exact stable error code
      expect(res.body?.code, 'error code must be DOC_TITLE_BODY_MISMATCH').toBe('DOC_TITLE_BODY_MISMATCH')
      // (c) response body contains the expected + conflicting titles
      expect(res.body?.expected_title).toBe('Service Agreement')
      expect(res.body?.conflicting_title).toMatch(/Contract of Employment/i)
      // (d) reference_id present and appears in structured log
      const refId = res.body?.reference_id
      expect(typeof refId).toBe('string')
      expect(refId).toMatch(/^ref_[0-9a-f]+$/)
      const loggedWithRef = errorSpy.mock.calls.some(args =>
        args.some(a => {
          const s = typeof a === 'string' ? a : JSON.stringify(a)
          return typeof s === 'string' && s.includes(refId)
        })
      )
      expect(loggedWithRef, `reference_id ${refId} returned to the client must also appear in a structured log event`).toBe(true)
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('Bug C fail-closed — forbidden combination (s.91 + PAYE/pension/NSITF/NHF/ITF) returns 5xx with code=DOC_FORBIDDEN_COMBINATION, reference_id, and log correlation', async () => {
    const conflict = loadFixture('sig-cbdb6556-classification-conflict.txt')
    // Prompt has "independent contractor" anchor (helper default) so
    // classifier resolves and we reach the orchestrator.
    const promptWithIcTrigger = serviceAgreementPromptNG()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockFetch
        .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00'))
        .mockResolvedValueOnce(redisGetResponse(null))
        .mockResolvedValueOnce(anthropicResponse(conflict, 'end_turn'))

      const req = mockReq({
        prompt: promptWithIcTrigger,
        doc_type_id: 'service-agreement',
        oxapayTrackId: 'bug_c_track',
      })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode, 'forbidden combination must return 5xx, not 200').toBeGreaterThanOrEqual(500)
      expect(res.statusCode).toBeLessThan(600)
      expect(res.body?.code).toBe('DOC_FORBIDDEN_COMBINATION')
      expect(res.body?.combination_id).toBe('s91_with_paye_stack')
      expect(Array.isArray(res.body?.anchor_hits)).toBe(true)
      const refId = res.body?.reference_id
      expect(typeof refId).toBe('string')
      expect(refId).toMatch(/^ref_[0-9a-f]+$/)
      const loggedWithRef = errorSpy.mock.calls.some(args =>
        args.some(a => {
          const s = typeof a === 'string' ? a : JSON.stringify(a)
          return typeof s === 'string' && s.includes(refId)
        })
      )
      expect(loggedWithRef).toBe(true)
    } finally {
      errorSpy.mockRestore()
    }
  })

  // ─── Phase 5 three-way branch tests — consumer endpoint ───────────────

  it('Phase 5 — independent_contractor mode: clean fixture (no s.91, no PAYE, no pension, no NSITF, no NHF, no ITF) returns 200', async () => {
    const cleanIC = loadFixture('sig-cbdb6556-clean-independent-contractor.txt')
    // "independent contractor" anchor comes from the helper default.
    const prompt = serviceAgreementPromptNG()
    mockFetch
      .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00'))
      .mockResolvedValueOnce(redisGetResponse(null))
      .mockResolvedValueOnce(anthropicResponse(cleanIC, 'end_turn'))
      .mockResolvedValueOnce(redisSetResponse())

    const req = mockReq({ prompt, doc_type_id: 'service-agreement', oxapayTrackId: 'p5_ic_track' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const text = res.body?.text || ''
    expect(/\bs\.?\s*91\b|section\s+91\b/i.test(text), 'independent_contractor doc must not cite s.91').toBe(false)
    expect(/\bPAYE\b/.test(text), 'independent_contractor doc must not mention PAYE').toBe(false)
    expect(/pension\s+reform\s+act|pension\s+contribution/i.test(text), 'no pension clauses').toBe(false)
    expect(/\bNSITF\b/.test(text), 'no NSITF').toBe(false)
    expect(/\bNHF\b/.test(text), 'no NHF').toBe(false)
    expect(/\bITF\b/.test(text), 'no ITF').toBe(false)
  })

  it('Phase 5 — exempt_worker_s91 mode: clean fixture has BOTH s.91 citation AND full employee-side deductions (PAYE, pension, NSITF, NHF, ITF) — s.91 only exempts from Labour Act scope, not from tax/pension/social-security statutes', async () => {
    const cleanExempt = loadFixture('sig-cbdb6556-clean-exempt-worker-s91.txt')
    const prompt = serviceAgreementPromptNG({ classificationAnchor: 'managerial / executive role' })
    mockFetch
      .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00'))
      .mockResolvedValueOnce(redisGetResponse(null))
      .mockResolvedValueOnce(anthropicResponse(cleanExempt, 'end_turn'))
      .mockResolvedValueOnce(redisSetResponse())

    const req = mockReq({ prompt, doc_type_id: 'service-agreement', oxapayTrackId: 'p5_exempt_track' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const text = res.body?.text || ''
    expect(/section\s+91\b|\bs\.?\s*91\b/i.test(text), 's.91 must be cited — this IS the exempt_worker_s91 classification signal').toBe(true)
    expect(/\bPAYE\b/.test(text), 'PAYE must still apply — PITA liability is not affected by Labour Act s.91').toBe(true)
    expect(/pension\s+reform\s+act|pension\s+contribution/i.test(text), 'pension (PRA 2014) must still apply to exempt managerial employees').toBe(true)
    expect(/\bNSITF\b/.test(text), 'NSITF (ECA 2010) must still apply').toBe(true)
    expect(/\bNHF\b/.test(text), 'NHF Act 1992 must still apply').toBe(true)
  })

  it('Phase 5 — WORKER_CLASSIFICATION_AMBIGUOUS: prompt with no classification anchors fails-close before Anthropic call', async () => {
    // Helper with classificationAnchor:null → neither rule fires.
    const ambiguousPrompt = serviceAgreementPromptNG({ classificationAnchor: null })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockFetch
        .mockResolvedValueOnce(oxaPayPaidResponse('Paid', '5.00'))
        .mockResolvedValueOnce(redisGetResponse(null))
        // No Anthropic mock — we expect the fail-close BEFORE any Anthropic call.

      const req = mockReq({ prompt: ambiguousPrompt, doc_type_id: 'service-agreement', oxapayTrackId: 'p5_amb_track' })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(422)
      expect(res.body?.code).toBe('WORKER_CLASSIFICATION_AMBIGUOUS')
      expect(Array.isArray(res.body?.valid_values)).toBe(true)
      expect(res.body?.valid_values).toContain('independent_contractor')
      expect(res.body?.valid_values).toContain('exempt_worker_s91')
      const refId = res.body?.reference_id
      expect(typeof refId).toBe('string')
      expect(refId).toMatch(/^ref_[0-9a-f]+$/)
      // Verify no Anthropic call was made — only OxaPay inquiry + Redis GET.
      const anthropicCalls = mockFetch.mock.calls.filter(
        ([url]) => typeof url === 'string' && url.includes('api.anthropic.com')
      )
      expect(anthropicCalls.length, 'ambiguous classification must fail-close before Anthropic call').toBe(0)
    } finally {
      errorSpy.mockRestore()
    }
  })
})
