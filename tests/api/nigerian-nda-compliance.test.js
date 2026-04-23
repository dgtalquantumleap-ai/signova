// Part 5 — Nigerian NDA NDPA/GAID compliance prompt tests.
//
// Rosemary Onu-Okeke audit 2026-04-20 identified 9 gaps in the Nigerian NDA
// generation pipeline. These tests assert that the system prompt sent to
// Anthropic contains all 9 MANDATORY compliance blocks on BOTH endpoints
// (consumer api/generate.js and developer api/v1/documents/generate.js).
//
// Approach: spy on global.fetch, run the handler with a Nigerian NDA request,
// find the api.anthropic.com call, parse the request body, assert .system
// contains the required strings. No real Anthropic call is made.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Environment setup ────────────────────────────────────────────────────────
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.OXAPAY_MERCHANT_KEY = 'test-oxapay-key'
process.env.NODE_ENV = 'test'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('stripe', () => {
  function MockStripe() {
    return { checkout: { sessions: { retrieve: vi.fn().mockResolvedValue({ payment_status: 'paid', id: 'cs_test_123' }) } } }
  }
  return { default: MockStripe }
})

// ── Mock response helpers ────────────────────────────────────────────────────
function anthropicOk(text = 'Generated legal document content for Nigerian NDA.') {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }),
  })
}
function oxaPayPaid() {
  return Promise.resolve({
    json: () => Promise.resolve({ result: 100, status: 'Paid', payAmount: '5.00', amount: '5.00', currency: 'USD' }),
  })
}
function redisNull() {
  return Promise.resolve({ json: () => Promise.resolve({ result: null }) })
}
function redisOk() {
  return Promise.resolve({ json: () => Promise.resolve({ result: 'OK' }) })
}

// ── Handlers under test ──────────────────────────────────────────────────────
const { default: consumerHandler } = await import('../../api/generate.js')
const { default: v1Handler } = await import('../../api/v1/documents/generate.js')

// ── Request builders ─────────────────────────────────────────────────────────
function consumerReq(body) {
  return {
    method: 'POST',
    body,
    headers: { host: 'localhost:3000' },
    socket: { remoteAddress: '127.0.0.1' },
  }
}
function v1Req(body) {
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

// ── Helpers ──────────────────────────────────────────────────────────────────

// Returns the system prompt string from the first Anthropic fetch call, or null.
function extractAnthropicSystemPrompt() {
  const call = mockFetch.mock.calls.find(
    ([url]) => typeof url === 'string' && url.includes('api.anthropic.com')
  )
  if (!call) return null
  try {
    return JSON.parse(call[1].body).system ?? null
  } catch {
    return null
  }
}

// ── The 9 MANDATORY compliance blocks + primacy checks ───────────────────────
// Each tuple: [clause-id, label, regex or string to assert in system prompt]
const COMPLIANCE_ASSERTIONS = [
  ['gaid-primacy',             'GAID 2025 primacy header',                    'GAID 2025 PRIMACY'],
  ['header',                   'Rosemary DataLex compliance section header',   'NIGERIAN NDA — NDPA/GAID COMPLIANCE REQUIREMENTS (REVIEWED BY DATALEX CONSULTING)'],
  ['lawful-basis',             'Gap 1 — Lawful Basis for Processing',          'LAWFUL BASIS FOR PROCESSING — MANDATORY'],
  ['data-minimisation',        'Gap 2 — Data Minimisation',                    'DATA MINIMISATION — MANDATORY'],
  ['retention-deletion',       'Gap 3 — Data Retention and Deletion',          'DATA RETENTION AND DELETION — MANDATORY'],
  ['security-measures',        'Gap 4 — Security Measures',                    'SECURITY MEASURES (TECHNICAL AND ORGANISATIONAL) — MANDATORY'],
  ['data-subject-rights',      'Gap 5 — Data Subject Rights',                 'DATA SUBJECT RIGHTS — MANDATORY'],
  ['audit-verification',       'Gap 6 — Audit and Compliance Verification',   'AUDIT AND COMPLIANCE VERIFICATION — MANDATORY'],
  ['cross-border-transfer',    'Gap 7 — Cross-Border Data Transfer (GAID)',    'CROSS-BORDER DATA TRANSFER — GAID 2025 SAFEGUARDS — MANDATORY'],
  ['breach-hierarchy',         'Gap 8 — Breach Notification Hierarchy',        'BREACH NOTIFICATION HIERARCHY — MANDATORY'],
  ['duration-survival',        'Gap 9 — Duration and Survival',               'CONFIDENTIALITY DURATION AND DATA PROTECTION SURVIVAL — MANDATORY'],
  ['party-to-party-step',      'Gap 8 — party-to-party notification step',    'STEP 1'],
  ['section-48-reference',     'Section 48 NDPA 2023 penalty awareness',       'Section 48'],
  ['aes-256',                  'Gap 4 — AES-256 encryption requirement',       'AES-256'],
  ['72-hour-ndpc',             'Gap 8 — 72-hour NDPC obligation preserved',   '72-HOUR NDPC'],
  ['closing-mandatory-line',   'Closing mandatory-instruction line',           'MANDATORY. Do not skip, summarise, or weaken'],
]

// ── Nigerian NDA prompt (consumer endpoint) ──────────────────────────────────
const NIGERIAN_NDA_PROMPT =
  'Generate a Non-Disclosure Agreement for Acme Corp Nigeria Ltd and Beta Technologies Ltd.\n' +
  'Governing law: Nigeria.\n' +
  'Parties will share commercially sensitive technical information and personal data of their employees.\n' +
  'Requirements:\n- Formal legal language.\n- Include all standard clauses.\nOutput the complete document only.'

// ── SUITE 1: Consumer endpoint (api/generate.js) ─────────────────────────────
describe('api/generate.js — Nigerian NDA NDPA/GAID compliance prompt', () => {
  let systemPrompt = null

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('sends the Nigerian NDA to Anthropic and captures the system prompt', async () => {
    mockFetch
      .mockResolvedValueOnce(oxaPayPaid())
      .mockResolvedValueOnce(redisNull())
      .mockResolvedValueOnce(anthropicOk())
      .mockResolvedValueOnce(redisOk())

    const req = consumerReq({ prompt: NIGERIAN_NDA_PROMPT, oxapayTrackId: 'ndpa_audit_track_01' })
    const res = mockRes()
    await consumerHandler(req, res)

    systemPrompt = extractAnthropicSystemPrompt()

    expect(systemPrompt, 'handler must have called Anthropic — no api.anthropic.com fetch found').not.toBeNull()
    expect(res.statusCode, 'handler must return 200 for a valid Nigerian NDA request').toBe(200)
  })

  it.each(COMPLIANCE_ASSERTIONS)(
    'consumer system prompt contains [%s] — %s',
    async (clauseId, label, needle) => {
      // Each it.each runs its own full request so the system prompt is always
      // captured fresh; share state would be fragile across concurrent runs.
      mockFetch
        .mockResolvedValueOnce(oxaPayPaid())
        .mockResolvedValueOnce(redisNull())
        .mockResolvedValueOnce(anthropicOk())
        .mockResolvedValueOnce(redisOk())

      const req = consumerReq({ prompt: NIGERIAN_NDA_PROMPT, oxapayTrackId: `ndpa_audit_${clauseId}` })
      const res = mockRes()
      await consumerHandler(req, res)

      const sp = extractAnthropicSystemPrompt()
      expect(sp, `Anthropic was not called — cannot verify ${label}`).not.toBeNull()
      expect(
        sp.includes(needle),
        `Consumer system prompt is missing required string for [${clauseId}]: "${needle}"\n\n` +
        `Clause: ${label}\nThis is a MANDATORY NDPA/GAID compliance requirement from Rosemary Onu-Okeke's 2026-04-20 audit.`
      ).toBe(true)
    }
  )
})

// ── SUITE 2: Developer v1 endpoint (api/v1/documents/generate.js) ─────────────
describe('api/v1/documents/generate.js — Nigerian NDA NDPA/GAID compliance prompt', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it.each(COMPLIANCE_ASSERTIONS)(
    'v1 system prompt contains [%s] — %s',
    async (clauseId, label, needle) => {
      mockFetch.mockResolvedValueOnce(anthropicOk())

      const req = v1Req({
        document_type: 'nda',
        jurisdiction: 'Nigeria',
        fields: {
          party_a: 'Acme Corp Nigeria Ltd',
          party_b: 'Beta Technologies Ltd',
          purpose: 'Evaluation of a potential commercial partnership',
          governing_law: 'Nigeria',
        },
      })
      const res = mockRes()
      await v1Handler(req, res)

      const sp = extractAnthropicSystemPrompt()
      expect(sp, `Anthropic was not called — cannot verify ${label}`).not.toBeNull()
      expect(
        sp.includes(needle),
        `v1 system prompt is missing required string for [${clauseId}]: "${needle}"\n\n` +
        `Clause: ${label}\nThis is a MANDATORY NDPA/GAID compliance requirement from Rosemary Onu-Okeke's 2026-04-20 audit.`
      ).toBe(true)
    }
  )
})

// ── SUITE 3: Scope guard — non-Nigerian NDAs must NOT receive the NDPA block ──
describe('Scope guard — NDPA/GAID block must not fire outside Nigeria', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('consumer: UK NDA prompt does not inject NDPA/GAID block', async () => {
    mockFetch
      .mockResolvedValueOnce(oxaPayPaid())
      .mockResolvedValueOnce(redisNull())
      .mockResolvedValueOnce(anthropicOk())
      .mockResolvedValueOnce(redisOk())

    const ukPrompt =
      'Generate a Non-Disclosure Agreement for Alpha Ltd and Beta Ltd.\n' +
      'Governing law: England and Wales.\n' +
      'Output the complete document only.'

    const req = consumerReq({ prompt: ukPrompt, oxapayTrackId: 'scope_guard_uk_track' })
    const res = mockRes()
    await consumerHandler(req, res)

    const sp = extractAnthropicSystemPrompt()
    expect(sp, 'Anthropic must have been called').not.toBeNull()
    expect(
      sp.includes('NIGERIAN NDA — NDPA/GAID COMPLIANCE REQUIREMENTS'),
      'NDPA/GAID block must NOT appear in a UK NDA system prompt'
    ).toBe(false)
  })

  it('v1: UK NDA request does not inject NDPA/GAID block', async () => {
    mockFetch.mockResolvedValueOnce(anthropicOk())

    const req = v1Req({
      document_type: 'nda',
      jurisdiction: 'United Kingdom',
      fields: { party_a: 'Alpha Ltd', party_b: 'Beta Ltd', governing_law: 'England and Wales' },
    })
    const res = mockRes()
    await v1Handler(req, res)

    const sp = extractAnthropicSystemPrompt()
    expect(sp, 'Anthropic must have been called').not.toBeNull()
    expect(
      sp.includes('NIGERIAN NDA — NDPA/GAID COMPLIANCE REQUIREMENTS'),
      'NDPA/GAID block must NOT appear in a UK NDA system prompt'
    ).toBe(false)
  })
})

// ── SUITE 4: Registry — nda.max_tokens must be 16000 ─────────────────────────
describe('doc-registry.json — NDA token budget', () => {
  it('nda.max_tokens is 16000 to accommodate 9 NDPA/GAID compliance clauses without truncation', () => {
    const registryPath = join(__dirname, '..', '..', 'lib', 'doc-registry.json')
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
    expect(
      registry.docTypes?.nda?.max_tokens,
      'docTypes.nda.max_tokens must be 20000 — bumped from null → 12000 → 16000 → 20000; 16000 truncated complex data-analytics NDAs before signature block'
    ).toBe(20000)
  })
})
