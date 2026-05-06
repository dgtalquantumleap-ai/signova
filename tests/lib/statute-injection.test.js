// Tests for lib/statute-injection.js
//
// buildStatuteContext is fully exercised here. getStatuteBundle and
// getBundleMeta are mocked so we test injection logic in isolation —
// Day 2's tests already cover the cache + bundle layer.

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockGetBundleMeta = vi.fn()
const mockGetStatuteBundle = vi.fn()

vi.mock('../../lib/statute-bundles.js', () => ({
  getBundleMeta: (...args) => mockGetBundleMeta(...args),
}))

vi.mock('../../lib/statute-retrieval.js', () => ({
  getStatuteBundle: (...args) => mockGetStatuteBundle(...args),
}))

let buildStatuteContext

beforeEach(async () => {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.stubEnv('STATUTE_RETRIEVAL_ENABLED', 'true')
  vi.stubEnv('STATUTE_RETRIEVAL_USA_FEDERAL', 'true')

  mockGetBundleMeta.mockReset()
  mockGetStatuteBundle.mockReset()

  const mod = await import('../../lib/statute-injection.js')
  buildStatuteContext = mod.buildStatuteContext
})

function makeMeta(overrides = {}) {
  return {
    cache_seeded: true,
    verified_by: 'olumide@ebenova.net',
    verification_results: {
      'REF-A': { verdict: 'match', confidence: 'high' },
    },
    ...overrides,
  }
}

function makeRow(statuteRef, content, sources = [{ url: 'https://example.com', title: 't' }]) {
  return { statuteRef, content, sources }
}

describe('buildStatuteContext — feature flag gating', () => {
  it('returns null when STATUTE_RETRIEVAL_ENABLED is not "true"', async () => {
    vi.stubEnv('STATUTE_RETRIEVAL_ENABLED', 'false')
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toBeNull()
    expect(mockGetBundleMeta).not.toHaveBeenCalled()
    expect(mockGetStatuteBundle).not.toHaveBeenCalled()
  })

  it('returns null when per-jurisdiction flag is not "true"', async () => {
    vi.stubEnv('STATUTE_RETRIEVAL_USA_FEDERAL', 'false')
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toBeNull()
    expect(mockGetBundleMeta).not.toHaveBeenCalled()
  })

  it('returns null when the per-jurisdiction flag is unset (undefined)', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('STATUTE_RETRIEVAL_ENABLED', 'true')
    // No STATUTE_RETRIEVAL_USA_FEDERAL set
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toBeNull()
  })
})

describe('buildStatuteContext — bundle/cache short-circuits', () => {
  it('returns null when no _meta on bundle (unverified)', async () => {
    mockGetBundleMeta.mockReturnValue(null)
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toBeNull()
    // Cache is not consulted when bundle is unverified.
    expect(mockGetStatuteBundle).not.toHaveBeenCalled()
  })

  it('returns null when cache returns empty array', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta())
    mockGetStatuteBundle.mockResolvedValue([])
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toBeNull()
  })

  it('returns null when cache returns non-array', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta())
    mockGetStatuteBundle.mockResolvedValue(null)
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toBeNull()
  })
})

describe('buildStatuteContext — formatting', () => {
  it('returns formatted string when cache has entries — includes header, refs, sources, verdict, footer', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta({
      verification_results: {
        'REF-A': { verdict: 'match', confidence: 'high' },
      },
    }))
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('REF-A', 'Statutory body of REF-A', [{ url: 'https://example.com/refA', title: 'A' }]),
    ])

    const result = await buildStatuteContext('usa_federal', 'nda')

    expect(result).toContain('--- VERIFIED STATUTE CONTEXT ---')
    expect(result).toContain('--- END VERIFIED STATUTE CONTEXT ---')
    expect(result).toContain('Reference: REF-A')
    expect(result).toContain('Source: https://example.com/refA')
    expect(result).toContain('Verification: ✓ MATCH')
    expect(result).toContain('Statutory body of REF-A')
    expect(result).toContain('cite ONLY the references above')
    expect(result).toContain('Do not invent additional statute citations')
  })

  it('separates multiple entries with the --- delimiter', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta({
      verification_results: {
        'REF-A': { verdict: 'match' },
        'REF-B': { verdict: 'match' },
      },
    }))
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('REF-A', 'A body'),
      makeRow('REF-B', 'B body'),
    ])

    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toContain('Reference: REF-A')
    expect(result).toContain('Reference: REF-B')
    // Inter-entry delimiter is a bare ---
    expect(result.match(/\n---\n/g)?.length ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('uses fallback when source URL is missing', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta())
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('REF-A', 'body', []),
    ])
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toContain('Source: (no source URL)')
  })
})

describe('buildStatuteContext — reframing', () => {
  it('applies reframing find/replace_with for ⚠ PARTIAL entries — covers singular and plural', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta({
      verification_results: {
        'EEA': {
          verdict: 'partial',
          reframing: {
            find: ['civil fine', 'civil fines', 'civil penalties'],
            replace_with: 'criminal fine',
          },
        },
      },
    }))
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('EEA', 'Organisations face a civil fine, civil fines, and civil penalties under § 1832.'),
    ])

    const result = await buildStatuteContext('usa_federal', 'nda')
    // Find each replaced position in the Content line specifically.
    const contentMatch = result.match(/Content: ([^\n]+)/)
    expect(contentMatch).not.toBeNull()
    const contentLine = contentMatch[1]
    expect(contentLine).not.toMatch(/\bcivil fines?\b/i)
    expect(contentLine).not.toContain('civil penalties')
    expect(contentLine).toContain('criminal fine')
    // Annotated as reframed in the verification line.
    expect(result).toContain('⚠ PARTIAL')
    expect(result).toContain('verification note applied before injection')
  })

  it('does not apply reframing when reframing is null on a partial entry', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta({
      verification_results: {
        'DOC': { verdict: 'partial', reframing: null },
      },
    }))
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('DOC', 'Original content stays.'),
    ])
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toContain('Original content stays.')
    // Verification note: partial without "applied before injection" suffix.
    expect(result).toContain('⚠ PARTIAL')
  })

  it('reframing is case-insensitive and word-boundary scoped', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta({
      verification_results: {
        'X': {
          verdict: 'partial',
          reframing: { find: ['civil fine'], replace_with: 'criminal fine' },
        },
      },
    }))
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('X', 'A CIVIL FINE applies. The uncivilfinedebt does not.'),
    ])
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toContain('A criminal fine applies')
    // Word-boundary: "uncivilfinedebt" should not be touched.
    expect(result).toContain('uncivilfinedebt')
  })
})

describe('buildStatuteContext — verdict-based filtering', () => {
  it('skips entries with ✗ MISMATCH verdict', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta({
      verification_results: {
        'GOOD': { verdict: 'match' },
        'BAD': { verdict: 'mismatch' },
      },
    }))
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('GOOD', 'Good content'),
      makeRow('BAD', 'Bad content (should be filtered)'),
    ])
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toContain('Reference: GOOD')
    expect(result).toContain('Good content')
    expect(result).not.toContain('Reference: BAD')
    expect(result).not.toContain('Bad content')
  })

  it('skips entries with rejected verdict', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta({
      verification_results: {
        'X': { verdict: 'rejected' },
      },
    }))
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('X', 'rejected content'),
    ])
    const result = await buildStatuteContext('usa_federal', 'nda')
    // Only entry was filtered → null
    expect(result).toBeNull()
  })

  it('injects entries with no verification_results entry as unverified (legacy bundles)', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta({
      verification_results: {},
    }))
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('REF-LEGACY', 'legacy content'),
    ])
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toContain('Reference: REF-LEGACY')
    expect(result).toContain('Verification: unverified')
    expect(result).toContain('legacy content')
  })

  it('skips rows with empty content', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta())
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('REF-A', ''),
      makeRow('REF-B', 'real content'),
    ])
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).not.toContain('Reference: REF-A')
    expect(result).toContain('Reference: REF-B')
  })
})

describe('buildStatuteContext — null when all entries filtered', () => {
  it('returns null when every cache row is filtered (verdict, empty content)', async () => {
    mockGetBundleMeta.mockReturnValue(makeMeta({
      verification_results: {
        'BAD1': { verdict: 'mismatch' },
        'BAD2': { verdict: 'rejected' },
      },
    }))
    mockGetStatuteBundle.mockResolvedValue([
      makeRow('BAD1', 'x'),
      makeRow('BAD2', 'y'),
      makeRow('BAD3', ''), // no content
    ])
    const result = await buildStatuteContext('usa_federal', 'nda')
    expect(result).toBeNull()
  })
})
