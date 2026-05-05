// Tests for lib/statute-retrieval.js and lib/statute-bundles.js
//
// All external dependencies (Supabase, fetch) are mocked — no real API calls.
// vi.resetModules() is used in beforeEach to flush the module-level _client
// singleton between tests, ensuring isolation.

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — set up before any dynamic imports so the hoisted vi.mock()
// applies when statute-retrieval.js calls createClient() inside the module.
// ---------------------------------------------------------------------------

const mockMaybeSingle = vi.fn()
const mockUpsert = vi.fn()
const mockGt = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockSupabaseFrom = vi.fn()

// Build a fluent chain object that every supabase method returns.
const queryChain = {
  select: mockSelect,
  eq: mockEq,
  gt: mockGt,
  maybeSingle: mockMaybeSingle,
  upsert: mockUpsert,
}

mockSelect.mockReturnValue(queryChain)
mockEq.mockReturnValue(queryChain)
mockGt.mockReturnValue(queryChain)
mockSupabaseFrom.mockReturnValue(queryChain)

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}))

// ---------------------------------------------------------------------------
// Shared state — re-assigned each beforeEach after dynamic import.
// ---------------------------------------------------------------------------

let retrieveStatute
let getStatuteBundle
let StatuteRetrievalError

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Future ISO timestamp. */
function futureISO(daysFromNow = 30) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString()
}

/** Past ISO timestamp. */
function pastISO(daysAgo = 1) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
}

/** Minimum cache row shape returned by the DB. */
function makeCacheRow(overrides = {}) {
  return {
    jurisdiction: 'nigeria',
    doc_type: 'nda',
    statute_ref: 'NDPA-2023-s25',
    content: 'Cached statute text.',
    sources_json: [{ url: 'https://example.com/ndpa' }],
    olostep_answer_id: 'ans-001',
    expires_at: futureISO(30),
    retrieved_at: new Date().toISOString(),
    ...overrides,
  }
}

/** Default Olostep API response body. */
function olostepResponse(overrides = {}) {
  return {
    answer: 'Statute text from Olostep.',
    sources: [{ url: 'https://olostep.com/source/1' }],
    id: 'olostep-id-42',
    ...overrides,
  }
}

/** Make global.fetch resolve with a JSON response. */
function mockFetchOk(body) {
  global.fetch = vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve(body),
  })
}

/** Make global.fetch resolve with a given HTTP status (no body needed). */
function mockFetchStatus(status) {
  global.fetch = vi.fn().mockResolvedValue({
    status,
    ok: status < 400,
    json: () => Promise.resolve({}),
  })
}

// ---------------------------------------------------------------------------
// beforeEach — reset modules + env + mocks for a clean slate every test.
// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.resetModules()
  vi.unstubAllEnvs()

  // Default: feature is enabled and env vars are present.
  vi.stubEnv('STATUTE_RETRIEVAL_ENABLED', 'true')
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  vi.stubEnv('OLOSTEP_API_KEY', 'test-olostep-key')

  // Reset ALL chain mocks (call history + return values) for full isolation.
  mockMaybeSingle.mockReset()
  mockUpsert.mockReset()
  mockGt.mockReset()
  mockEq.mockReset()
  mockSelect.mockReset()
  mockSupabaseFrom.mockReset()

  // Restore default return values after reset.
  mockSelect.mockReturnValue(queryChain)
  mockEq.mockReturnValue(queryChain)
  mockGt.mockReturnValue(queryChain)
  mockSupabaseFrom.mockReturnValue(queryChain)

  // Default: no cache hit; upsert succeeds.
  mockMaybeSingle.mockResolvedValue({ data: null, error: null })
  mockUpsert.mockResolvedValue({ error: null })

  // Default: fetch not called (tests opt in).
  global.fetch = vi.fn()

  // Re-import module to pick up fresh singleton state.
  const mod = await import('../../lib/statute-retrieval.js')
  retrieveStatute = mod.retrieveStatute
  getStatuteBundle = mod.getStatuteBundle
  StatuteRetrievalError = mod.StatuteRetrievalError
})

afterEach(() => {
  vi.useRealTimers()
})

// ===========================================================================
// cacheLookup behaviour (exercised via retrieveStatute)
// ===========================================================================

describe('cacheLookup — via retrieveStatute', () => {
  it('test 1: returns null when no matching row exists — proceeds to call Olostep', async () => {
    // DB returns nothing.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    // Olostep returns null (graceful).
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(olostepResponse()),
    })

    // Make upsert succeed silently.
    mockUpsert.mockResolvedValue({ error: null })

    const result = await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'test query')

    // Olostep was reached (fetch was called).
    expect(global.fetch).toHaveBeenCalledOnce()
    // Result has fromCache: false.
    expect(result).not.toBeNull()
    expect(result.fromCache).toBe(false)
  })

  it('test 2: returns null when row is expired (expires_at in past) — Olostep is called', async () => {
    // The .gt('expires_at', ...) filter means the DB returns nothing for expired rows.
    // We simulate this by having maybeSingle return null (the DB filtered it out).
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    mockFetchOk(olostepResponse())
    mockUpsert.mockResolvedValue({ error: null })

    const result = await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'test query')

    expect(global.fetch).toHaveBeenCalledOnce()
    expect(result).not.toBeNull()
    expect(result.fromCache).toBe(false)
  })

  it('test 3: returns fromCache: true and does NOT call fetch when row is fresh', async () => {
    const row = makeCacheRow()
    mockMaybeSingle.mockResolvedValue({ data: row, error: null })

    const result = await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'test query')

    // fetch must NOT have been called.
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      content: row.content,
      sources: row.sources_json,
      fromCache: true,
      retrievedAt: row.retrieved_at,
    })
  })
})

// ===========================================================================
// cacheWrite behaviour (exercised via retrieveStatute on cache miss)
// ===========================================================================

describe('cacheWrite — via retrieveStatute on cache miss', () => {
  beforeEach(() => {
    // Ensure cache miss.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockFetchOk(olostepResponse())
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('test 4: calls upsert with onConflict: "jurisdiction,doc_type,statute_ref"', async () => {
    await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'my query')

    expect(mockUpsert).toHaveBeenCalledOnce()
    const [_data, options] = mockUpsert.mock.calls[0]
    expect(options).toMatchObject({ onConflict: 'jurisdiction,doc_type,statute_ref' })
  })

  it('test 5: sets expires_at approximately 30 days in the future (within ±60 seconds)', async () => {
    const beforeCall = Date.now()
    await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'my query')
    const afterCall = Date.now()

    expect(mockUpsert).toHaveBeenCalledOnce()
    const [upsertData] = mockUpsert.mock.calls[0]

    const expiresAt = new Date(upsertData.expires_at).getTime()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

    expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + thirtyDaysMs - 60_000)
    expect(expiresAt).toBeLessThanOrEqual(afterCall + thirtyDaysMs + 60_000)
  })
})

// ===========================================================================
// callOlostep behaviour (exercised via retrieveStatute on cache miss)
// ===========================================================================

describe('callOlostep — via retrieveStatute on cache miss', () => {
  beforeEach(() => {
    // Always a cache miss so callOlostep is reached.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('test 6: sends POST to Olostep endpoint with Authorization and Content-Type headers', async () => {
    mockFetchOk(olostepResponse())

    await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'test query')

    expect(global.fetch).toHaveBeenCalledOnce()
    const [url, init] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.olostep.com/v1/answers')
    expect(init.method).toBe('POST')
    expect(init.headers['Authorization']).toBe('Bearer test-olostep-key')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('test 7: sends body: { question: query }', async () => {
    mockFetchOk(olostepResponse())

    await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'my statute query')

    const [, init] = global.fetch.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ question: 'my statute query' })
  })

  it('test 8: parses response.answer → content, sources → sources, id → answerId; returns them', async () => {
    const body = olostepResponse({
      answer: 'Parsed statute content.',
      sources: [{ url: 'https://source.example.com' }],
      id: 'parsed-id-99',
    })
    mockFetchOk(body)

    const result = await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'query')

    expect(result).toMatchObject({
      content: 'Parsed statute content.',
      sources: [{ url: 'https://source.example.com' }],
      fromCache: false,
    })

    // answerId should be stored via cacheWrite — verify it was passed to upsert.
    const [upsertData] = mockUpsert.mock.calls[0]
    expect(upsertData.olostep_answer_id).toBe('parsed-id-99')
  })

  it('test 9: throws StatuteRetrievalError on HTTP 5xx — retrieveStatute re-throws it', async () => {
    mockFetchStatus(503)

    await expect(
      retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'query')
    ).rejects.toThrow(StatuteRetrievalError)
  })

  it('test 10: returns null on HTTP 4xx — graceful fallback, no throw', async () => {
    mockFetchStatus(404)

    const result = await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'query')

    expect(result).toBeNull()
  })

  it('test 11: respects 30-second timeout — AbortController signals abort → returns null', async () => {
    vi.useFakeTimers()

    // Simulate fetch that honours the AbortSignal — rejects with AbortError when signalled.
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })

    const resultPromise = retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'query')

    // Advance time past the 30-second abort threshold.
    await vi.advanceTimersByTimeAsync(30_001)

    const result = await resultPromise

    // The AbortController fired, fetch threw an AbortError, callOlostep
    // caught it as a network error (not StatuteRetrievalError) and returned null.
    expect(result).toBeNull()
  })
})

// ===========================================================================
// retrieveStatute — higher-level integration tests
// ===========================================================================

describe('retrieveStatute', () => {
  it('test 12: returns null immediately when STATUTE_RETRIEVAL_ENABLED !== "true" — no DB or fetch calls', async () => {
    vi.resetModules()
    vi.stubEnv('STATUTE_RETRIEVAL_ENABLED', 'false')

    const mod = await import('../../lib/statute-retrieval.js')
    const fn = mod.retrieveStatute

    const result = await fn('nigeria', 'nda', 'NDPA-2023-s25', 'query')

    expect(result).toBeNull()
    expect(mockSupabaseFrom).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('test 13: returns { content, sources, fromCache: true, retrievedAt } on cache hit', async () => {
    const row = makeCacheRow({
      content: 'Cached content.',
      sources_json: [{ url: 'https://cache.example.com' }],
      retrieved_at: '2026-01-01T00:00:00.000Z',
    })
    mockMaybeSingle.mockResolvedValue({ data: row, error: null })

    const result = await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'query')

    expect(result).toEqual({
      content: 'Cached content.',
      sources: [{ url: 'https://cache.example.com' }],
      fromCache: true,
      retrievedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('test 14: calls Olostep on cache miss, writes to cache, returns { content, sources, fromCache: false, retrievedAt }', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockFetchOk(olostepResponse({
      answer: 'Fresh statute text.',
      sources: [{ url: 'https://fresh.example.com' }],
      id: 'fresh-id-01',
    }))
    mockUpsert.mockResolvedValue({ error: null })

    const result = await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'query')

    // Olostep was called.
    expect(global.fetch).toHaveBeenCalledOnce()
    // Cache write happened.
    expect(mockUpsert).toHaveBeenCalledOnce()
    // Returned object shape.
    expect(result).toMatchObject({
      content: 'Fresh statute text.',
      sources: [{ url: 'https://fresh.example.com' }],
      fromCache: false,
    })
    expect(typeof result.retrievedAt).toBe('string')
  })

  it('test 15: returns null and logs warning when Olostep returns null — no throw', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    // Olostep 4xx → callOlostep returns null.
    mockFetchStatus(422)

    const result = await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'query')

    expect(result).toBeNull()
    // No throw — test simply resolves.
  })

  it('test 16: returns null and logs error on unexpected internal error (e.g. JSON parse fails)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    // fetch succeeds at transport level but json() throws.
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => { throw new SyntaxError('Unexpected token < in JSON') },
    })

    const result = await retrieveStatute('nigeria', 'nda', 'NDPA-2023-s25', 'query')

    // Should return null, not throw.
    expect(result).toBeNull()
  })
})

// ===========================================================================
// getStatuteBundle
// ===========================================================================

describe('getStatuteBundle', () => {
  it('test 17: returns empty array when STATUTE_RETRIEVAL_ENABLED !== "true"', async () => {
    vi.resetModules()
    vi.stubEnv('STATUTE_RETRIEVAL_ENABLED', 'false')

    const mod = await import('../../lib/statute-retrieval.js')
    const fn = mod.getStatuteBundle

    const result = await fn('nigeria', 'nda')

    expect(result).toEqual([])
    expect(mockSupabaseFrom).not.toHaveBeenCalled()
  })

  it('test 18: returns empty array for jurisdiction+docType combo with no cache entries', async () => {
    // gt() returns the chain; when awaited as a full query, mock the final value.
    // getStatuteBundle does not call maybeSingle — it awaits the chain directly.
    // We need gt() to return { data: [], error: null } for the bundle query.
    mockGt.mockResolvedValueOnce({ data: [], error: null })

    const result = await getStatuteBundle('usa-de', 'llc-operating')

    expect(result).toEqual([])
  })

  it('test 19: returns all unexpired entries mapped to { statuteRef, content, sources }', async () => {
    const rows = [
      { statute_ref: 'REF-A', content: 'Content A', sources_json: [{ url: 'https://a.com' }] },
      { statute_ref: 'REF-B', content: 'Content B', sources_json: [] },
    ]
    mockGt.mockResolvedValueOnce({ data: rows, error: null })

    const result = await getStatuteBundle('canada-on', 'partnership-agreement')

    expect(result).toEqual([
      { statuteRef: 'REF-A', content: 'Content A', sources: [{ url: 'https://a.com' }] },
      { statuteRef: 'REF-B', content: 'Content B', sources: [] },
    ])
  })

  it('test 20: excludes expired entries — DB enforces via .gt("expires_at", ...) filter, mock returns only fresh items', async () => {
    // Simulate the DB having already filtered out expired rows (only fresh ones returned).
    const freshRows = [
      { statute_ref: 'FRESH-1', content: 'Fresh text', sources_json: [] },
    ]
    mockGt.mockResolvedValueOnce({ data: freshRows, error: null })

    const result = await getStatuteBundle('nigeria', 'nda')

    // Only the fresh row is present.
    expect(result).toHaveLength(1)
    expect(result[0].statuteRef).toBe('FRESH-1')
  })
})

// ===========================================================================
// Bundle registry — getBundleDefinition and listJurisdictions
// ===========================================================================

describe('Bundle registry (statute-bundles.js)', () => {
  // These tests import statute-bundles.js directly — no mocking needed.
  let getBundleDefinition
  let listJurisdictions

  beforeEach(async () => {
    const mod = await import('../../lib/statute-bundles.js')
    getBundleDefinition = mod.getBundleDefinition
    listJurisdictions = mod.listJurisdictions
  })

  it('test 21: getBundleDefinition returns an array for known jurisdiction+docType combos', () => {
    expect(Array.isArray(getBundleDefinition('nigeria', 'nda'))).toBe(true)
    expect(Array.isArray(getBundleDefinition('usa-de', 'llc-operating'))).toBe(true)
    expect(Array.isArray(getBundleDefinition('canada-on', 'partnership-agreement'))).toBe(true)
  })

  it('test 22: getBundleDefinition returns null for unknown combos', () => {
    expect(getBundleDefinition('atlantis', 'nda')).toBeNull()
    // nigeria has no llc-operating entry.
    expect(getBundleDefinition('nigeria', 'llc-operating')).toBeNull()
  })

  it('test 23: listJurisdictions returns exactly the 8 expected jurisdiction keys', () => {
    const expected = [
      'nigeria',
      'usa-federal',
      'usa-ca',
      'usa-de',
      'usa-ny',
      'usa-tx',
      'canada-federal',
      'canada-on',
    ]
    expect(listJurisdictions()).toEqual(expected)
    expect(listJurisdictions()).toHaveLength(8)
  })
})
