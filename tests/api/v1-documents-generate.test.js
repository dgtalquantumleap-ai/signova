// Tests for api/v1/documents/generate.js
// Phase 2 SIG-CBDB6556 reproductions, developer-API flavour.
//
// The developer API endpoint has the same three structural defects as the
// consumer endpoint api/generate.js — no completeness validation, no
// stop_reason inspection, no title/body consistency check, no worker
// classification field. These tests reproduce Bugs A/B/C against it with
// the same fixture set, driven via the structured `document_type` + `fields`
// contract the developer API uses (vs the freeform `prompt` the consumer
// endpoint takes).

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '..', 'fixtures')
function loadFixture(name) {
  return readFileSync(join(FIXTURES, name), 'utf8')
}

// Env setup — must run before importing the handler.
// sk_test_local_dev is the non-prod bypass key recognised by lib/api-auth.js
// line 41; it avoids needing Redis mocks for the key lookup.
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.NODE_ENV = 'test'

const mockFetch = vi.fn()
global.fetch = mockFetch

// Shared Anthropic response helper (same shape as the consumer test).
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

function mockReq(body, method = 'POST') {
  return {
    method,
    body,
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer sk_test_local_dev',
      host: 'api.ebenova.dev',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    _headers: {},
    status(code) { this.statusCode = code; return this },
    json(data) { this.body = data; return this },
    setHeader(k, v) { this._headers[k] = v },
    end() { return this },
  }
  return res
}

const { default: handler } = await import('../../api/v1/documents/generate.js')

function serviceAgreementRequestNG() {
  const inputs = JSON.parse(loadFixture('sig-cbdb6556-inputs.json'))
  return {
    document_type: inputs.developerApiEquivalent.document_type,
    jurisdiction: inputs.developerApiEquivalent.jurisdiction,
    fields: inputs.developerApiEquivalent.fields,
  }
  // Note: worker_classification is intentionally NOT included here.
  // The helper is used by tests that both require and deliberately omit
  // the field — Bug A/B/C tests spread it and add a classification;
  // the WORKER_CLASSIFICATION_REQUIRED test uses this base directly.
}

describe('api/v1/documents/generate.js — SIG-CBDB6556 reproductions (Phase 2)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('Bug A reproduction — must not ship 200 with truncation (dangling forward ref to Clause 15 with no clause 15 heading)', async () => {
    const truncated = loadFixture('sig-cbdb6556-truncated.txt')
    mockFetch
      .mockResolvedValueOnce(anthropicResponse(truncated, 'max_tokens'))
      // Continuation retry — also truncated.
      .mockResolvedValueOnce(anthropicResponse(truncated, 'max_tokens'))

    const req = mockReq({ ...serviceAgreementRequestNG(), worker_classification: 'independent_contractor' })
    const res = mockRes()
    await handler(req, res)

    const text = typeof res.body?.document === 'string' ? res.body.document : ''
    const hasForwardRefToC15 = /Clause\s+15\s*\(Termination\)/i.test(text)
    const hasClause15Heading = /(?:^|\n)\s*\*?\*?\s*15\.\s/m.test(text)
    const isDangling = hasForwardRefToC15 && !hasClause15Heading
    if (res.statusCode === 200) {
      expect(
        isDangling,
        `Developer API returned 200 with a document that references "Clause 15 (Termination)" but never draws a clause 15 heading — Anthropic stop_reason was max_tokens on both attempts. Endpoint must fail-close, not ship a document with dangling forward references.`
      ).toBe(false)
    }
  })

  it('Bug A fail-closed — after continuation retry also truncates, returns 5xx with code=DOC_INCOMPLETE_AFTER_RETRY, reference_id, and log correlation', async () => {
    const truncated = loadFixture('sig-cbdb6556-truncated.txt')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockFetch
        .mockResolvedValueOnce(anthropicResponse(truncated, 'max_tokens'))
        .mockResolvedValueOnce(anthropicResponse(truncated, 'max_tokens'))

      const req = mockReq({ ...serviceAgreementRequestNG(), worker_classification: 'independent_contractor' })
      const res = mockRes()
      await handler(req, res)

      // (a) 5xx
      expect(res.statusCode, 'fail-closed must return 5xx, not 200').toBeGreaterThanOrEqual(500)
      expect(res.statusCode).toBeLessThan(600)
      // (b) stable machine-readable error code — EXACT match (developer API nests it under error.code)
      expect(res.body?.error?.code, 'error code must be the stable DOC_INCOMPLETE_AFTER_RETRY constant').toBe('DOC_INCOMPLETE_AFTER_RETRY')
      // (c) reference_id present in the response AND in the structured log
      const refId = res.body?.error?.reference_id
      expect(typeof refId, 'response must include a reference_id string').toBe('string')
      expect(refId).toMatch(/^ref_[0-9a-f]+$/)
      // logger.js calls console.error('[ERROR]', JSON.stringify(payload)) —
      // scan ALL arguments of ALL calls to find the one carrying the payload.
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
      .mockResolvedValueOnce(anthropicResponse(truncated, 'max_tokens'))
      .mockResolvedValueOnce(anthropicResponse(continuation, 'end_turn'))

    const req = mockReq({ ...serviceAgreementRequestNG(), worker_classification: 'independent_contractor' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode, 'successful continuation must return 200').toBe(200)
    const text = typeof res.body?.document === 'string' ? res.body.document : ''
    expect(text, 'stitched document must contain a clause-11 opening from the first half').toMatch(/\*\*11\./)
    expect(text, 'stitched document must contain Clause 15 (Termination)').toMatch(/\*\*15\.\s+TERMINATION/)
    expect(text, 'stitched document must contain Governing Law').toMatch(/GOVERNING LAW/)
  })

  it('Bug B fail-closed — title/body mismatch returns 5xx with code=DOC_TITLE_BODY_MISMATCH, reference_id, and log correlation', async () => {
    const mismatch = loadFixture('sig-cbdb6556-title-mismatch.txt')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockFetch.mockResolvedValueOnce(anthropicResponse(mismatch, 'end_turn'))

      const req = mockReq({ ...serviceAgreementRequestNG(), worker_classification: 'independent_contractor' })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode, 'title/body mismatch must return 5xx, not 200').toBeGreaterThanOrEqual(500)
      expect(res.statusCode).toBeLessThan(600)
      expect(res.body?.error?.code, 'error code must be DOC_TITLE_BODY_MISMATCH').toBe('DOC_TITLE_BODY_MISMATCH')
      expect(res.body?.error?.expected_title).toBe('Service Agreement')
      expect(res.body?.error?.conflicting_title).toMatch(/Contract of Employment/i)
      const refId = res.body?.error?.reference_id
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

  it('Bug C fail-closed — forbidden combination returns 5xx with code=DOC_FORBIDDEN_COMBINATION, reference_id, and log correlation', async () => {
    const conflict = loadFixture('sig-cbdb6556-classification-conflict.txt')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockFetch.mockResolvedValueOnce(anthropicResponse(conflict, 'end_turn'))

      const req = mockReq({
        ...serviceAgreementRequestNG(),
        worker_classification: 'independent_contractor',
      })
      const res = mockRes()
      await handler(req, res)

      expect(res.statusCode, 'forbidden combination must return 5xx').toBeGreaterThanOrEqual(500)
      expect(res.statusCode).toBeLessThan(600)
      expect(res.body?.error?.code).toBe('DOC_FORBIDDEN_COMBINATION')
      expect(res.body?.error?.combination_id).toBe('s91_with_paye_stack')
      const refId = res.body?.error?.reference_id
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

  // ─── Phase 5 three-way branch tests — developer API ────────────────────

  it('Phase 5 — independent_contractor: clean fixture returns 200', async () => {
    const cleanIC = loadFixture('sig-cbdb6556-clean-independent-contractor.txt')
    mockFetch.mockResolvedValueOnce(anthropicResponse(cleanIC, 'end_turn'))

    const req = mockReq({ ...serviceAgreementRequestNG(), worker_classification: 'independent_contractor' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const text = res.body?.document || ''
    expect(/\bs\.?\s*91\b|section\s+91\b/i.test(text)).toBe(false)
    expect(/\bPAYE\b/.test(text)).toBe(false)
    expect(/pension\s+reform\s+act|pension\s+contribution/i.test(text)).toBe(false)
    expect(/\bNSITF\b/.test(text)).toBe(false)
    expect(/\bNHF\b/.test(text)).toBe(false)
    expect(/\bITF\b/.test(text)).toBe(false)
  })

  it('Phase 5 — exempt_worker_s91: clean fixture has BOTH s.91 citation AND full employee-side deductions — s.91 exempts from Labour Act scope only, not from tax/pension/social-security', async () => {
    const cleanExempt = loadFixture('sig-cbdb6556-clean-exempt-worker-s91.txt')
    mockFetch.mockResolvedValueOnce(anthropicResponse(cleanExempt, 'end_turn'))

    const req = mockReq({ ...serviceAgreementRequestNG(), worker_classification: 'exempt_worker_s91' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const text = res.body?.document || ''
    expect(/section\s+91\b|\bs\.?\s*91\b/i.test(text), 's.91 must be cited').toBe(true)
    expect(/\bPAYE\b/.test(text), 'PAYE must still apply (PITA is unaffected by s.91)').toBe(true)
    expect(/pension\s+reform\s+act|pension\s+contribution/i.test(text), 'pension (PRA 2014) must still apply').toBe(true)
    expect(/\bNSITF\b/.test(text), 'NSITF (ECA 2010) must still apply').toBe(true)
    expect(/\bNHF\b/.test(text), 'NHF Act 1992 must still apply').toBe(true)
  })

  it('Phase 5 — employee (on employment-offer-letter): clean fixture (PAYE + pension + NSITF present, no s.91 exemption) returns 200', async () => {
    const cleanEmployee = loadFixture('sig-cbdb6556-clean-employee.txt')
    mockFetch.mockResolvedValueOnce(anthropicResponse(cleanEmployee, 'end_turn'))

    const req = mockReq({
      document_type: 'employment-offer-letter',
      jurisdiction: 'Nigeria',
      fields: { employer: 'BrightPath Nigeria Ltd.', employee: 'Adewale Okonkwo', jurisdiction: 'Nigeria' },
      worker_classification: 'employee',
    })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const text = res.body?.document || ''
    // The employee clean fixture cites s.91 only as a NOTICE minimum reference
    // ("Labour Act s.11") — not as an exemption. Confirm no "exempt" wording.
    expect(/s\.?\s*91.*exempt|exempt.*s\.?\s*91/i.test(text)).toBe(false)
    expect(/\bPAYE\b/.test(text)).toBe(true)
    expect(/pension\s+reform\s+act|pension\s+contribution/i.test(text)).toBe(true)
    expect(/\bNSITF\b/.test(text)).toBe(true)
  })

  it('Phase 5 — WORKER_CLASSIFICATION_REQUIRED: dev API rejects 400 when worker_classification missing for service-agreement', async () => {
    // Note: no Anthropic mock — we expect rejection BEFORE any LLM call.
    const req = mockReq(serviceAgreementRequestNG()) // <- no worker_classification
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
    expect(res.body?.error?.code).toBe('WORKER_CLASSIFICATION_REQUIRED')
    expect(Array.isArray(res.body?.error?.valid_values)).toBe(true)
    expect(res.body?.error?.valid_values).toContain('independent_contractor')
    expect(res.body?.error?.valid_values).toContain('exempt_worker_s91')
    const refId = res.body?.error?.reference_id
    expect(typeof refId).toBe('string')
    expect(refId).toMatch(/^ref_[0-9a-f]+$/)
  })

  it('Phase 5 — WORKER_CLASSIFICATION_INVALID: dev API rejects 400 when worker_classification is not a valid mode for the doc_type', async () => {
    // "employee" is not a valid mode for service-agreement (only independent_contractor / exempt_worker_s91)
    const req = mockReq({ ...serviceAgreementRequestNG(), worker_classification: 'employee' })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error?.code).toBe('WORKER_CLASSIFICATION_INVALID')
    expect(res.body?.error?.valid_values).toContain('independent_contractor')
    expect(res.body?.error?.valid_values).not.toContain('employee')
  })
})
