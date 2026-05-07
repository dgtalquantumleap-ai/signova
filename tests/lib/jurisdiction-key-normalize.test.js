// Tests for lib/jurisdiction-key-normalize.js
//
// Day 5A added a Delaware branch. Existing branches are exercised here to
// lock in the behavior (no separate test file existed before today).

import { describe, it, expect } from 'vitest'
import { normalizeJurisdictionKey } from '../../lib/jurisdiction-key-normalize.js'

describe('normalizeJurisdictionKey — null and canonical-key passthrough', () => {
  it('returns null for empty / nullish input', () => {
    expect(normalizeJurisdictionKey(null)).toBeNull()
    expect(normalizeJurisdictionKey(undefined)).toBeNull()
    expect(normalizeJurisdictionKey('')).toBeNull()
  })

  it('passes through canonical keys unchanged', () => {
    expect(normalizeJurisdictionKey('nigeria')).toBe('nigeria')
    expect(normalizeJurisdictionKey('usa_federal')).toBe('usa_federal')
    expect(normalizeJurisdictionKey('usa_delaware')).toBe('usa_delaware')
  })

  it('returns null for unrecognized free-form strings', () => {
    expect(normalizeJurisdictionKey('atlantis')).toBeNull()
    expect(normalizeJurisdictionKey('mars')).toBeNull()
  })
})

describe('normalizeJurisdictionKey — non-US branches still work after Day 5A change', () => {
  it.each([
    ['Nigeria', 'nigeria'],
    ['Kenya', 'kenya'],
    ['Ghana', 'ghana'],
    ['South Africa', 'south_africa'],
    ['United Kingdom', 'uk'],
    ['UK', 'uk'],
    ['Singapore', 'singapore'],
    ['India', 'india'],
    ['United Arab Emirates', 'uae'],
    ['DIFC', 'uae'],
    ['European Union', 'eu'],
    ['Quebec', 'canada_quebec'],
    ['Ontario', 'canada_ontario'],
    ['British Columbia', 'canada_bc'],
    ['Canada', 'canada_federal'],
    ['Alberta', 'canada_federal'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeJurisdictionKey(input)).toBe(expected)
  })
})

describe('normalizeJurisdictionKey — Delaware (Day 5A)', () => {
  it.each([
    ['Delaware', 'usa_delaware'],
    ['delaware', 'usa_delaware'],
    ['DELAWARE', 'usa_delaware'],
    ['United States — Delaware', 'usa_delaware'],
    ['United States - Delaware', 'usa_delaware'],
    ['DGCL', 'usa_delaware'],
    ['Delaware General Corporation Law', 'usa_delaware'],
    ['Delaware Court of Chancery', 'usa_delaware'],
    ['6 Del. C. § 2001', 'usa_delaware'],
    ['6 Del C 2001', 'usa_delaware'],
  ])('routes %s to usa_delaware', (input, expected) => {
    expect(normalizeJurisdictionKey(input)).toBe(expected)
  })

  it('does NOT route "Delaware County, PA" to usa_delaware (negative lookahead excludes county)', () => {
    // Returns null (ambiguous input — neither delaware-state nor PA explicitly
    // claimed). The critical guarantee is that it does not falsely route to
    // usa_delaware.
    const result = normalizeJurisdictionKey('Delaware County, PA')
    expect(result).not.toBe('usa_delaware')
  })

  it('does NOT route "Delaware County" alone to usa_delaware', () => {
    expect(normalizeJurisdictionKey('Delaware County')).not.toBe('usa_delaware')
  })

  it('does NOT route "Pennsylvania" to usa_delaware', () => {
    expect(normalizeJurisdictionKey('Pennsylvania')).toBe('usa_federal')
  })

  it('Delaware-state input takes precedence over plain "United States"', () => {
    // "Delaware" check fires before "united states" check.
    expect(normalizeJurisdictionKey('United States — Delaware')).toBe('usa_delaware')
  })
})

describe('normalizeJurisdictionKey — non-Delaware US states still work', () => {
  it.each([
    ['California', 'usa_california'],
    ['CCPA', 'usa_california'],
    ['New York', 'usa_new_york'],
    ['Texas', 'usa_texas'],
    ['Florida', 'usa_florida'],
    ['United States', 'usa_federal'],
    ['USA', 'usa_federal'],
    ['Colorado', 'usa_federal'],
    ['Massachusetts', 'usa_federal'],
    ['Wyoming', 'usa_federal'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeJurisdictionKey(input)).toBe(expected)
  })
})
