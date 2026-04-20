// Tests for lib/jurisdiction-context.js
// Covers the 3 guarantees Scope Guard now depends on:
//   1. nigeria   → prompt context cites CAMA / NDPA
//   2. uk        → prompt context cites ERA 1996 / UK GDPR
//   3. undefined → Commonwealth fallback + explicit "do not default to US"
//      (California / Delaware must NOT appear as substantive governing-law
//       guidance; they only appear inside the anti-default prohibition.)
import { describe, it, expect } from 'vitest'
import {
  buildJurisdictionContext,
  jurisdictionDisplayName,
  JURISDICTION_KEYS,
} from '../../lib/jurisdiction-context.js'

describe('jurisdiction-context', () => {
  it('nigeria context cites CAMA and NDPA (Scope Guard pillar #1)', () => {
    const ctx = buildJurisdictionContext('nigeria')
    // Corporate statute — governs service-provider incorporation, capacity,
    // directors' authority to bind the client to a change order.
    expect(ctx).toMatch(/CAMA/)
    // Data protection — relevant to scope disputes involving data handling.
    expect(ctx).toMatch(/NDPA|Nigeria Data Protection Act/)
    // Sanity — must name the jurisdiction itself so Claude/Llama anchors.
    expect(ctx).toMatch(/NIGERIA/i)
  })

  it('uk context cites ERA 1996 and UK GDPR (Scope Guard pillar #2)', () => {
    const ctx = buildJurisdictionContext('uk')
    expect(ctx).toMatch(/ERA 1996|Employment Rights Act 1996/)
    expect(ctx).toMatch(/UK GDPR|Data Protection Act 2018/)
    expect(ctx).toMatch(/United Kingdom|England/i)
  })

  it('missing jurisdiction returns Commonwealth fallback that forbids US-default (Scope Guard pillar #3)', () => {
    const ctx = buildJurisdictionContext(undefined)
    expect(ctx).toMatch(/COMMONWEALTH/i)
    // The anti-default instruction must be present and unambiguous.
    expect(ctx).toMatch(/DO NOT DEFAULT TO U\.S\. LAW/i)
    // And California/Delaware may only appear inside that anti-default
    // prohibition, not as a positive governing-law recommendation. A crude
    // structural check: both names should appear on the same line as the
    // prohibition.
    const prohibitionLine = ctx
      .split('\n')
      .find(line => /DO NOT DEFAULT TO U\.S\. LAW/i.test(line))
    expect(prohibitionLine).toBeTruthy()
    expect(prohibitionLine).toMatch(/California/)
    expect(prohibitionLine).toMatch(/Delaware/)
  })

  it('unknown jurisdiction key falls through to Commonwealth fallback (no silent US-default)', () => {
    const ctx = buildJurisdictionContext('atlantis')
    expect(ctx).toMatch(/COMMONWEALTH/i)
    expect(ctx).toMatch(/DO NOT DEFAULT TO U\.S\. LAW/i)
  })

  it('every JURISDICTION_KEYS entry produces a non-empty, jurisdiction-specific context block', () => {
    for (const key of JURISDICTION_KEYS) {
      const ctx = buildJurisdictionContext(key)
      expect(ctx.length).toBeGreaterThan(100)
      // Fallback string must NOT appear when a real key was supplied.
      expect(ctx).not.toMatch(/COMMONWEALTH COMMON-LAW BASELINE/)
    }
  })

  it('jurisdictionDisplayName returns readable labels and a safe default', () => {
    expect(jurisdictionDisplayName('nigeria')).toBe('Nigeria')
    expect(jurisdictionDisplayName('uk')).toMatch(/United Kingdom/)
    expect(jurisdictionDisplayName('south_africa')).toBe('South Africa')
    // Missing / unknown keys get a neutral fallback — never "California".
    expect(jurisdictionDisplayName(undefined)).not.toMatch(/California|Delaware/)
    expect(jurisdictionDisplayName('atlantis')).not.toMatch(/California|Delaware/)
  })
})
