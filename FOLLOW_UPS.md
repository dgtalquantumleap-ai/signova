# FOLLOW_UPS.md — Post-Rosemary Audit Tracking

This file tracks open items arising from the Rosemary Onu-Okeke NDPA 2023 / GAID 2025 compliance audit
(conducted 2026-04-20, delivered 2026-04-22, implemented in the Nigerian NDA generation pipeline).

---

## Immediate (this week)

- [ ] Send revised Nigerian NDA to Rosemary within 5-7 days with
      concise changelog mapping each of her 9 recommendations to
      specific updates. Single validation pass — one clean review.
- [ ] Stage 1 sign-off call scheduled [DATE TBD] 4pm WAT / 9am MDT.
- [ ] After Rosemary signs off: get her final approval on attribution
      wording and placement across (a) product page, (b) generated
      NDA PDF footer, (c) Nigerian NDA Generator.jsx surface, (d)
      public announcement.
- [ ] After approval: set ROSEMARY_ATTRIBUTION_APPROVED=true in
      `lib/compliance-attribution.js`, obtain confirmed LinkedIn URL,
      deploy attribution across approved surfaces.
- [ ] Only after attribution is live AND Rosemary has explicitly
      approved: post LinkedIn announcement tagging her.

---

## Medium-term (next 4-8 weeks)

- [ ] Preview latency optimization. Post-Haiku migration, cold-start
      previews take ~30-40s (warm: ~15-25s). Options to reduce perceived
      latency:
      (a) Stream preview generation to client (SSE or chunked response)
          — feels fast within 2-3s
      (b) Pre-warm preview function via Vercel cron on a 10-minute interval
      (c) Lower preview max_tokens from 6000 to 4000 — faster generation,
          preview already truncated server-side by 40%
      Recommended: (a) streaming, then measure real-user conversion
      impact before optimizing further.

---

## A — Rosemary Onu-Okeke Review Playbook

**Reviewer:** Barrister Rosemary Onu-Okeke (Esq. LL.B, B.L, MSc)  
**Firm:** Joint Heirs Chambers / DataLex Consulting, Abuja  
**Audit brief saved at:** `docs/compliance/rosemary-audit.txt`  
**PR brief saved at:** `.claude-prompts/nigerian-nda-rosemary-audit-fixes.md`

### Stage 1 Review (CURRENT)

Send Rosemary the two generated outputs from Part 4 for her primary review:

- `.audit-outputs/nigerian-nda-rosemary-fixes-test-01.txt` — Consumer endpoint
- `.audit-outputs/nigerian-nda-rosemary-fixes-test-02.txt` — V1 API endpoint

**What she is reviewing:** That all 9 gaps she identified are now covered by substantive clauses,
not just headings. Her sign-off criteria: the generated NDA must be "operationally compliant",
not merely "baseline-compliant".

Items flagged for her confirmation (tagged `[VERIFY with Rosemary]`):

- Gap 3 (Retention): default period "duration + 2 years OR 30 days post-purpose"
- Gap 9 (Confidentiality duration): default period "3 years from termination"

### Stage 2 Review (AFTER Stage 1 sign-off)

After she confirms the clause content, request her to review the section numbers
that reference specific NDPA 2023 statutes (all tagged `[VERIFY]`):

- NDPA 2023 Section 65 — Personal Data definition
- NDPA 2023 Section 30 — Sensitive Personal Data
- NDPA 2023 Section 25 — Lawful Basis
- NDPA 2023 Section 24(1)(c) — Data Minimisation
- NDPA 2023 Section 39 — Security Measures
- NDPA 2023 Sections 33–38 — Data Subject Rights
- NDPA 2023 Section 40 — Breach Notification
- NDPA 2023 Section 41 — Post-Termination obligations
- NDPA 2023 Section 48 — Penalty provision
- NDPA 2023 Section 43 — Cross-Border Transfer

Replace `[VERIFY]` tags with confirmed citations after her sign-off.

---

## B — Architecture: Jurisdiction-Aware required_clauses in doc-registry.json

**Priority:** HIGH  
**Blocked by:** Nothing (standalone PR)  
**Rationale:** Decision 1 from Part 0 review.

### Problem

`lib/doc-completeness.js:findMissingClauses(text, docType)` has no `jurisdiction` parameter.
`doc-registry.json`'s `required_clauses` is doc-type-level — any clause ID added to
`nda.required_clauses` would incorrectly be required in UK, US, and CA NDAs.

Adding the 9 Nigerian NDA compliance clause IDs (lawful-basis-processing, data-minimisation,
retention-deletion, security-measures-specific, data-subject-rights, audit-verification,
cross-border-transfer-gaid, breach-notification-hierarchy, duration-survival-data-protection)
would cause false negatives for non-Nigerian NDAs and force unwanted continuation retries.

### Required Architecture Change

1. Extend the registry schema:

   ```json
   "jurisdiction_required_clauses": {
     "nigeria": ["lawful-basis-processing", "data-minimisation", "..."]
   }
   ```

2. Extend `findMissingClauses(text, docType, jurisdiction)` to merge
   `required_clauses` + `jurisdiction_required_clauses[jurisdiction]`.
3. Thread `jurisdiction` through `generateWithCompletenessCheck` (already in
   the signature; ensure the registry lookup uses it).
4. Add regex patterns for the 9 Nigerian NDA clauses to `lib/doc-completeness.js`.
5. Update `api/generate.js` and `api/v1/documents/generate.js` to pass
   `jurisdiction: 'nigeria'` (or the normalised key) into the orchestrator.

**Scope:** This is a cross-cutting architectural change that affects all Nigerian
document types, not just the NDA. Must be reviewed separately so it does not
widen the blast radius of the Rosemary audit PR.

---

## C — max_tokens: Monitor Complex Nigerian NDA Scenarios ✅ RESOLVED at 20000

**Resolved in:** Part 6 fix (2026-04-22)  
**Current value:** `docTypes.nda.max_tokens = 20000`

### What happened

At `max_tokens=16000`, the V1 API endpoint generated a 69,437-character Nigerian NDA
for a complex data-analytics outsourcing scenario (Olamide Bakare-Akintoye / DataBridge
Analytics Ltd), truncating the receiving party's signature block.

Bumped to 20000. Re-run confirmed: both endpoints returned `stop_reason=end_turn` with
complete signature blocks (V1: 69,774 chars, consumer: 57,323 chars).

### Watch item

If future complex scenarios (multi-party + cross-border + sector-specific annexes) push
past 20000 tokens, the next step is jurisdiction-aware max_tokens in the registry schema:

```json
"jurisdiction_max_tokens": { "nigeria": 24000 }
```

rather than a further global bump.

---

## D — Section [VERIFY] Tags: Statute Verification Pass

**Priority:** MEDIUM (blocks Rosemary Stage 2 sign-off)

All `[VERIFY]` section citations are placeholders per Rosemary's audit brief.
After Stage 1 sign-off, commission a statutory verification pass to confirm
each NDPA 2023 and GAID 2025 section number is correct before removing the tags.

Files to update after verification:

- `api/generate.js` — `nigeriaNDAClause` (item (ii) + 9 numbered blocks)
- `api/v1/documents/generate.js` — `v1NigeriaNDAClause` (identical content)
- `lib/jurisdiction-context.js` — Nigeria block (existing Section 25/34/41/43 citations)
- `tests/scripts/gen-test-nigerian-nda.mjs` — `NIGERIAN_NDA_CLAUSE` constant

---

Last updated: 2026-04-23 | Author: Claude (supervised by Olumide Akinsola)
