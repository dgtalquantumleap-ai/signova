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

  -- Compound key: each (jurisdiction, doc_type,
  -- statute_ref) is unique
  CONSTRAINT statute_cache_unique
    UNIQUE (jurisdiction, doc_type, statute_ref)
);

-- Index for the primary query path:
-- "give me all unexpired entries for this jurisdiction + doc"
CREATE INDEX IF NOT EXISTS idx_statute_cache_lookup
  ON statute_cache (jurisdiction, doc_type, expires_at);

-- Comment for future maintainers
COMMENT ON TABLE statute_cache IS
  'Olostep retrieval cache. Phase 1: Nigerian NDA + US Federal NDA. 30-day TTL. Idempotent on (jurisdiction, doc_type, statute_ref).';
