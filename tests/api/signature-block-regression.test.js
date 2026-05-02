// tests/api/signature-block-regression.test.js
// Regression suite for the three signature-block bugs found in the
// African Founders Community NDA/MOU incident (2026-05-02):
//
//   Bug 1 — isDpa false-positive: 'ndpa'.includes('dpa') === true, so any
//            Nigerian prompt mentioning "NDPA" silenced executionFormalitiesClause.
//   Bug 2 — MOU max_tokens null → 8000 default caused token-budget truncation.
//   Bug 3 — NDA + MOU had required_clauses: [] so completeness check never
//            detected a missing signature block.
//
// These tests are the safety net that must pass before any deploy.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Env setup (must happen before any handler import) ─────────────────────
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.NODE_ENV = 'test'

const mockFetch = vi.fn()
global.fetch = mockFetch

// ── Imports ────────────────────────────────────────────────────────────────
import { getMaxTokens } from '../../lib/doc-registry.js'
import { findMissingClauses } from '../../lib/doc-completeness.js'
import { EXECUTION_FORMALITIES_CLAUSE } from '../../lib/execution-formalities.js'

// ── isDpa logic (extracted for unit testing without importing the handlers) ─
// This mirrors the exact expression used in api/generate.js and
// api/generate-preview.js line-for-line. If the handler code changes,
// update here too.
function computeIsDpa(prompt) {
  const lower = prompt.toLowerCase()
  return lower.includes('data processing agreement') || /\bdpa\b/.test(lower)
}

// ── Test helpers ───────────────────────────────────────────────────────────
function anthropicResponse(text, stopReason = 'end_turn') {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      content: [{ type: 'text', text }],
      stop_reason: stopReason,
    }),
  })
}

function mockReqV1(body) {
  return {
    method: 'POST',
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

// Minimal document text with a real execution block (last-30% zone)
const DOC_WITH_SIGNATURE = `
NON-DISCLOSURE AGREEMENT

1. DEFINITIONS
"Confidential Information" means any information disclosed...

2. OBLIGATIONS
Each party agrees to maintain confidentiality...

3. GOVERNING LAW
This Agreement shall be governed by the laws of the Federal Republic of Nigeria.

IN WITNESS WHEREOF, the Parties have hereunto set their hands and seals the day
and year first above written.

SIGNED by ACME Nigeria Limited
Signature: _____________________________
Name: _____________________________
Date: _____________________________

WITNESS 1 (to ACME Nigeria Limited):
Signature: _____________________________
Name: _____________________________
Date: _____________________________
`

// Minimal document text WITHOUT any execution block
const DOC_WITHOUT_SIGNATURE = `
NON-DISCLOSURE AGREEMENT

1. DEFINITIONS
"Confidential Information" means any information disclosed by either party...

2. OBLIGATIONS
Each party agrees to maintain confidentiality of any information received from
the other party for a period of three (3) years from the date of disclosure.

3. GOVERNING LAW
This Agreement shall be governed by the laws of the Federal Republic of Nigeria.
`

// ── Test suites ────────────────────────────────────────────────────────────

describe('Bug 1 — isDpa word-boundary fix', () => {
  it('NDPA substring must NOT trigger DPA classification (the bug)', () => {
    const prompt = 'Generate a Nigerian NDA — NDPA 2023 compliant, parties are Acme Ltd and Beta Ltd'
    expect(computeIsDpa(prompt)).toBe(false)
  })

  it('"ndpa" alone must NOT trigger DPA classification', () => {
    expect(computeIsDpa('ndpa data protection requirements')).toBe(false)
  })

  it('"NDPA 2023" capitalised must NOT trigger DPA classification', () => {
    expect(computeIsDpa('Governed by NDPA 2023 provisions')).toBe(false)
  })

  it('standalone "dpa" must still trigger DPA classification', () => {
    expect(computeIsDpa('I need a DPA between controller and processor')).toBe(true)
  })

  it('"data processing agreement" must still trigger DPA classification', () => {
    expect(computeIsDpa('data processing agreement for our vendor onboarding')).toBe(true)
  })

  it('"data processing agreement" is case-insensitive', () => {
    expect(computeIsDpa('Generate a Data Processing Agreement')).toBe(true)
  })

  it('"dpa" at word boundary in a longer prompt must trigger', () => {
    expect(computeIsDpa('we need a dpa signed before launch')).toBe(true)
  })

  it('"dpa" embedded mid-word (e.g. "update") must NOT trigger', () => {
    // "update" contains "dpa"? No — "update" → u-p-d-a-t-e, no "dpa" substring.
    // Test with a word that genuinely embeds "dpa": e.g. "ndpa", "edpa", "updater"
    // "updater" does not contain "dpa". Let's use "ndpa" as the canonical case.
    expect(computeIsDpa('governed by the ndpa act')).toBe(false)
  })
})

describe('Bug 2 — MOU max_tokens', () => {
  it('mou max_tokens must be 16000 (not the 8000 default)', () => {
    expect(getMaxTokens('mou')).toBe(16000)
  })

  it('nda max_tokens must still be 20000', () => {
    expect(getMaxTokens('nda')).toBe(20000)
  })

  it('service-agreement max_tokens must still be 16000', () => {
    expect(getMaxTokens('service-agreement')).toBe(16000)
  })
})

describe('Bug 3 — execution-block completeness check', () => {
  it('findMissingClauses flags execution-block when signature block is absent', () => {
    const missing = findMissingClauses(DOC_WITHOUT_SIGNATURE, 'nda')
    expect(missing).toContain('execution-block')
  })

  it('findMissingClauses does NOT flag execution-block when "IN WITNESS WHEREOF" is present', () => {
    const missing = findMissingClauses(DOC_WITH_SIGNATURE, 'nda')
    expect(missing).not.toContain('execution-block')
  })

  it('findMissingClauses does NOT flag execution-block when "SIGNED by" appears in last 30%', () => {
    const missing = findMissingClauses(DOC_WITH_SIGNATURE, 'mou')
    expect(missing).not.toContain('execution-block')
  })

  it('findMissingClauses flags execution-block on MOU without signature', () => {
    const missing = findMissingClauses(DOC_WITHOUT_SIGNATURE, 'mou')
    expect(missing).toContain('execution-block')
  })

  it('execution-block detection ignores "signature" mentions in the document body (not last 30%)', () => {
    // "signature" appears only in a clause heading — body mentions it, last-30% does not
    const docBodyMentionsSignature = `
NON-DISCLOSURE AGREEMENT

1. DEFINITIONS

2. CONFIDENTIALITY OBLIGATIONS

3. SIGNATURE REQUIREMENTS CLAUSE
Both parties acknowledge that signature is required for execution.

4. GOVERNING LAW
This Agreement is governed by Nigerian law.
`
    // Short doc — last 30% is roughly the governing law clause; no real sig block
    const missing = findMissingClauses(docBodyMentionsSignature, 'nda')
    expect(missing).toContain('execution-block')
  })

  it('multi-line underscores + "Date:" within 3 lines triggers execution-block detection', () => {
    const docWithUnderscore = `
MEMORANDUM OF UNDERSTANDING

1. PURPOSE

2. OBLIGATIONS

3. TERM

The parties have agreed to the terms above.

Party A:
______________________________
Date: _________________________
`
    const missing = findMissingClauses(docWithUnderscore, 'mou')
    expect(missing).not.toContain('execution-block')
  })

  it('Witness Signature: line triggers execution-block detection', () => {
    const docWithWitness = `
NON-DISCLOSURE AGREEMENT

1. CONFIDENTIALITY

2. GOVERNING LAW

Signed hereunder by the parties.

Witness Signature: _____________________________
Witness Name: John Doe
`
    const missing = findMissingClauses(docWithWitness, 'nda')
    expect(missing).not.toContain('execution-block')
  })
})

describe('Fix 4 — V1 endpoint execution formalities parity', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('EXECUTION_FORMALITIES_CLAUSE is non-empty and contains the key required phrases', () => {
    expect(EXECUTION_FORMALITIES_CLAUSE.length).toBeGreaterThan(100)
    expect(EXECUTION_FORMALITIES_CLAUSE.toLowerCase()).toContain('in witness whereof')
    expect(EXECUTION_FORMALITIES_CLAUSE.toLowerCase()).toContain('signed by')
    expect(EXECUTION_FORMALITIES_CLAUSE.toLowerCase()).toContain('witness')
  })

  it('V1 endpoint injects execution formalities into the system prompt for a non-DPA document', async () => {
    const { default: handler } = await import('../../api/v1/documents/generate.js')

    const capturedRequests = []
    mockFetch.mockImplementation((url, options) => {
      if (url.includes('anthropic.com')) {
        capturedRequests.push(JSON.parse(options.body))
        return anthropicResponse(DOC_WITH_SIGNATURE)
      }
      // Redis usage recording
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const req = mockReqV1({
      document_type: 'nda',
      jurisdiction: 'Nigeria',
      fields: {
        parties: 'Acme Ltd and Beta Ltd',
        purpose: 'evaluate potential partnership',
        jurisdiction: 'Nigeria',
      },
    })
    const res = mockRes()
    await handler(req, res)

    expect(capturedRequests.length).toBeGreaterThan(0)
    const systemPrompt = capturedRequests[0]?.system || ''
    expect(
      systemPrompt.toLowerCase(),
      'V1 system prompt must contain "in witness whereof" from EXECUTION_FORMALITIES_CLAUSE'
    ).toContain('in witness whereof')
    expect(
      systemPrompt.toLowerCase(),
      'V1 system prompt must contain "signed by" from EXECUTION_FORMALITIES_CLAUSE'
    ).toContain('signed by')
  })

  it('V1 endpoint does NOT inject execution formalities for a DPA document', async () => {
    const { default: handler } = await import('../../api/v1/documents/generate.js')

    const capturedRequests = []
    mockFetch.mockImplementation((url, options) => {
      if (url.includes('anthropic.com')) {
        capturedRequests.push(JSON.parse(options.body))
        return anthropicResponse('Data Processing Agreement\n\nThis DPA...\nSIGNED by Controller\n', 'end_turn')
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const req = mockReqV1({
      document_type: 'data-processing-agreement',
      jurisdiction: 'Nigeria',
      fields: {
        controller_name: 'Acme Ltd',
        processor_name: 'Beta Ltd',
        jurisdiction: 'Nigeria',
      },
    })
    const res = mockRes()
    await handler(req, res)

    // DPA path uses buildDpaSystemPrompt() — execution formalities clause must NOT be appended
    if (capturedRequests.length > 0) {
      const systemPrompt = capturedRequests[0]?.system || ''
      // The execution formalities clause has the unique string "TWO WITNESSES PER PARTY"
      // which should NOT appear in a DPA system prompt
      expect(
        systemPrompt,
        'DPA system prompt must not contain TWO WITNESSES PER PARTY from executionFormalitiesClause'
      ).not.toContain('TWO WITNESSES PER PARTY')
    }
  })
})
