# Execution-block false-positive sweep — 2026-05-07

## ⚠ Secondary finding: audit chain has been silent

The most recent audit entry is dated **2026-04-28T23:23:49.295Z** (8 days ago).
The customer-impact case SIG-858825A9 generated 2026-05-07 is NOT in the chain.
This means the chain stopped accepting new entries before the prior
sig-block fix shipped — possibly due to a Redis credential/connectivity
issue, env-var rotation, or a non-fatal exception path in
`appendToAuditLog` (the call is wrapped in try/catch and logs a warning
but does not block generation, so the silence is invisible to users).

**Implication for this sweep:** the time-window filter returns ZERO
candidates not because no documents were affected, but because the
chain itself has no entries to filter. The customer remediation for
SIG-858825A9 must be handled directly (the customer is already known
via the African founders community). Other affected customers cannot
be identified through the audit chain until the chain is restored.

**Separate follow-up:** investigate why audit appends stopped around
2026-04-28T23:23:49.295Z. Check Vercel logs for "/generate" entries with the
`Audit log append failed (non-fatal)` warning. Restore audit chain
function before relying on this sweep for future incidents.

---

## Context

On 2026-05-07 customer SIG-858825A9 reported a truncated MOU stamped
`ok:true`. Root cause: `hasExecutionBlock()` in `lib/doc-completeness.js`
matched the lowercase substring "signed by" in body-prose Section 3.9
("...amendment signed by authorised representatives..."). The fix
tightens the detector to require uppercase `SIGNED` at line start AND
a structural anchor (signature underline / `Date:` / `Title:` /
`Print Name:`) within ±100 chars.

## Audit-chain sweep

**Time window:** entries with `stored_at` >= 2026-05-02T00:00:00Z (date the prior
sig-block fix landed; earlier entries pre-date the regression class).

**Filter:** premium-tier receipts only (paid generations); preview-tier
is excluded because previews are intentionally short.

**Truncation thresholds:**
- `likely_truncated`: word_count < 2500 (NDAs/MOUs are usually 4000+ words when complete)
- `possibly_short`: word_count < 4000 (could be a legitimate short doc, eg. a 2-party simple NDA)
- `unknown_word_count`: legacy receipts where the field was not populated

## Trust-model limitations of this sweep

The audit chain stores **fingerprint only**, not document body. Direct
string-matching against shipped documents is therefore not possible from
the audit chain alone. The sweep flags **truncation candidates** by
word count; identifying the exact subset that hit the false-positive
class requires either (a) cross-referencing flagged fingerprints with
payment records to contact customers and ask for a copy of their doc,
or (b) re-running each affected request from saved input prompts (not
currently retained server-side either).

SIG-XXXX reference IDs are minted client-side at render time
([src/pages/Preview.jsx:248](src/pages/Preview.jsx#L248)) and do not
persist to the audit chain. The chain stores Ed25519-signed fingerprints
and content hashes only.

## Summary

- Total audit entries scanned: 8
- Entries since 2026-05-02T00:00:00Z: 0 flagged
- `likely_truncated`: 0
- `possibly_short`: 0
- `unknown_word_count`: 0

## Flagged entries (redacted — no body, no customer info)

### likely_truncated

_(none)_

### possibly_short

_(none)_

### unknown_word_count

_(none)_

## Recommended remediation

1. **For each `likely_truncated` fingerprint**: cross-reference Stripe
   and Oxapay records by `issued_at` timestamp to identify the
   customer email. Reach out proactively offering free regeneration
   with the fix in place.
2. **For known case SIG-858825A9** (African founders community customer):
   already known. Offer regeneration directly.
3. **For `possibly_short`**: review case-by-case. Some may be
   legitimate short docs (eg. a one-page Letter of Intent). Use the
   doc tier + word count + customer feedback channel to decide.
4. **Frontend follow-up**: the warning at
   `src/pages/Preview.jsx:se` uses the same loose check
   (`/IN WITNESS WHEREOF|EXECUTED AS A DEED|SIGNED by/i`). Tighten it
   in a separate PR — same regex strategy, lower stakes (UX warning,
   not a gate).
