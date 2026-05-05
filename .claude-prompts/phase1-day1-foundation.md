# Phase 1 Day 1 — Olostep Retrieval Foundation

> Saved 2026-05-05. Feed this file to Claude Code to execute the brief.

## GOAL
Build the infrastructure for statute-grounded document generation. Day 1 ships NOTHING to production — feature flag is OFF by default. Day 1 is foundation only: Supabase table, Olostep client, cache layer, tests.

Day 2 will define the first statute bundle and seed the cache.
Day 3 will wire one document type to use the bundle.
Day 4-5 will A/B test and expand to more jurisdictions.

---

## CONTEXT

Signova currently generates legal documents via Sonnet 4.6 with prompts that contain hand-coded jurisdiction guidance. The guidance is brittle — bugs include wrong statute citations, missing required clauses, and silent classification errors (NDPA→DPA substring bug shipped 2026-04-30).

Phase 1 introduces Olostep retrieval: at generation time, fetch verified statute text from authoritative sources (cert.gov.ng, justice.gc.ca, eCFR.gov, etc.), cache in Supabase, inject into the Sonnet system prompt as grounded context.

- Supabase project ID: snqzmlctnlzkvcssotzx
- Supabase URL: https://snqzmlctnlzkvcssotzx.supabase.co
- Service role key: in process.env.SUPABASE_SERVICE_ROLE_KEY (already in .env.local + Vercel)
- Olostep API key: in process.env.OLOSTEP_API_KEY (already in .env.local + Vercel)

---

## PART 0 — Read existing code (no changes)

Read in full:
1. lib/jurisdiction-context.js
2. api/generate.js lines 1-300 (configuration, jurisdiction detection, doc type routing)
3. lib/doc-registry.json — current registry shape
4. package.json — confirm @supabase/supabase-js is or is not already installed

Report findings:
   a. Is @supabase/supabase-js installed? (Y/N)
   b. Where in api/generate.js does jurisdiction context get injected into the system prompt? (line numbers)
   c. Are there any existing Supabase client wrappers in lib/? (file paths if yes)
   d. Confirm the .env.local has SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OLOSTEP_API_KEY (just confirm presence — do not print values)

If @supabase/supabase-js is not installed, install it: `npm install @supabase/supabase-js@latest`

---

## PART 1 — Supabase migration

Create file: `supabase/migrations/20260504_create_statute_cache.sql`

Contents:

```sql
-- Statute cache: stores verified statute text retrieved from 
-- authoritative sources via Olostep, keyed by 
-- (jurisdiction, doc_type, statute_ref).
-- 
-- Cache TTL: 30 days. After expiry, retrieval re-fetches 
-- and refreshes.
--
-- Created 2026-05-04 — Phase 1 Day 1 — Olostep retrieval 
-- foundation.

CREATE TABLE IF NOT EXISTS statute_cache (
  id BIGSERIAL PRIMARY KEY,
  jurisdiction TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  statute_ref TEXT NOT NULL,
  query TEXT NOT NULL,
  content TEXT NOT NULL,
  sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  olostep_answer_id TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  CONSTRAINT statute_cache_unique 
    UNIQUE (jurisdiction, doc_type, statute_ref)
);

CREATE INDEX IF NOT EXISTS idx_statute_cache_lookup 
  ON statute_cache (jurisdiction, doc_type, expires_at);

COMMENT ON TABLE statute_cache IS 
  'Olostep retrieval cache. Phase 1: Nigerian NDA + US Federal NDA. 30-day TTL. Idempotent on (jurisdiction, doc_type, statute_ref).';
```

Apply via Supabase dashboard: https://supabase.com/dashboard/project/snqzmlctnlzkvcssotzx/sql/new

Verify: `SELECT * FROM statute_cache LIMIT 1;` should return zero rows, no error.

---

## PART 2 — Olostep client + cache layer

Create file: `lib/statute-retrieval.js`

Public API:
- `retrieveStatute(jurisdiction, docType, statuteRef, query)` → Promise<{content, sources, fromCache, retrievedAt}>
- `getStatuteBundle(jurisdiction, docType)` → Promise<Array<{statuteRef, content, sources}>>

Kill switch: `process.env.STATUTE_RETRIEVAL_ENABLED === 'true'`
Olostep endpoint: `POST https://api.olostep.com/v1/answers`
Timeout: 30 seconds
Cache TTL: 30 days
Graceful fallback: return null on failure (do not throw to caller)

---

## PART 3 — Bundle registry skeleton

Create file: `lib/statute-bundles.js`

Registry of Phase 1 jurisdictions × doc types. Empty arrays for Day 1 — Day 2 fills them.

Jurisdictions: nigeria, usa-federal, usa-ca, usa-de, usa-ny, usa-tx, canada-federal, canada-on
Doc types per jurisdiction: nda (all), llc-operating (usa-de), partnership-agreement (canada-*)

---

## PART 4 — Environment + feature flags

Update `.env.example` to document:
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OLOSTEP_API_KEY (already in Vercel)
- STATUTE_RETRIEVAL_ENABLED=false (master kill switch)
- Per-jurisdiction toggles: STATUTE_RETRIEVAL_NIGERIA, STATUTE_RETRIEVAL_USA_FEDERAL, etc.

Do NOT add to Vercel yet. Day 3 wiring.

---

## PART 5 — Tests

Create file: `tests/lib/statute-retrieval.test.js`

~20 tests covering: cacheLookup, cacheWrite, callOlostep, retrieveStatute, getStatuteBundle, getBundleDefinition.
Mock all external calls (Supabase + Olostep). Do not hit real APIs.
Use vitest (existing test framework).

---

## CRITICAL CONSTRAINTS

- DO NOT modify api/generate.js, api/generate-preview.js, or api/v1/documents/generate.js in Day 1
- DO NOT seed the cache with real Olostep queries
- DO NOT enable any feature flags (defaults stay OFF)
- DO NOT commit .env.local or any file containing real secrets
- DO maintain existing test count baseline (331 tests)
- DO NOT push to git or deploy — report for approval first

---

## COMMIT MESSAGE (after approval)

```
feat(retrieval): Phase 1 Day 1 — Olostep + Supabase foundation

Adds infrastructure for statute-grounded document generation:
- Supabase statute_cache table (30-day TTL, unique on jurisdiction+doc_type+statute_ref)
- lib/statute-retrieval.js: Olostep client + cache layer with graceful fallback
- lib/statute-bundles.js: registry skeleton for Phase 1 jurisdictions × doc types
- Feature flag STATUTE_RETRIEVAL_ENABLED=false (default OFF, no production impact)
- 20+ new unit tests

Day 1 ships nothing to production. Day 2 will seed Nigerian NDA bundle. Day 3 will wire api/generate.js under flag.
```
