# Deferred work — next-week pickup

Items surfaced during the doc-pipeline bug-fix sprint (Phases 1–7) that
landed out of scope for the sprint itself. Not urgent; not action items
for this week. Reviewed and prioritised by the founder.

## 1. Doc count reconciliation (registry 28 vs catalog 34)

`lib/doc-registry.json` currently has **28** doc types. `src/pages/Generator.jsx`'s
`DOC_CONFIGS` (the product catalog the marketing site references) has **34**.
The six registered in the UI but missing from the registry:

- `founders-agreement`
- `ip-assignment-agreement`
- `advisory-board-agreement`
- `vesting-agreement`
- `term-sheet`
- `safe-agreement`

All six are equity / corporate-law documents. Either register them (with
appropriate `required_clauses`, `jurisdiction_variants`, and
`worker_classification_modes` where relevant — most of these won't
participate in classification), or correct the "34 document types"
language in marketing copy. Recommend: register them. The equity doc
family is legally coherent and benefits from the same title/body +
truncation checks the other 28 get.

## 2. `data-processing-agreement` 0/3 clean pass in risk report

`tests/fixtures/risk-report.md` ranks DPA worst-first with a 0/3 clean
pass rate. The DPA path in `api/v1/documents/generate.js` takes a
bespoke branch through `buildKeyObligationsSummary` +
`buildDataFlowMappingTemplate` before the Anthropic call. The harness's
generic synthetic fields likely don't satisfy those builders.

Confirm this is harness fidelity rather than a latent bug:
- Run the regen script against a real DPA payload and verify the
  output passes all validators.
- If it does, extend the harness with a DPA-specific field stub.
- If it doesn't, treat as a separate bug with its own phased fix.

Low priority — no in-flight user reports against DPA.

## 3. `service-agreement` 9/12 negative catch rate (harness sample fidelity)

The "missing-required-clause" sample in `doc-pipeline-harness.test.js`
removes only the first `anyOf` alias of the first required clause.
Other aliases (e.g. `"services"` / `"engagement"` as fallbacks for
`"scope of services"`) remain in the synthetic body, so completeness
still passes. This is a **sample** fidelity issue, not a validator
bug. Low priority — the validator itself works in isolation (verified
by Phase 3 tests).

Fix when convenient: remove ALL aliases of the selected clause rather
than just the first.

## 4. Registry population for the 26 doc_types with empty Phase-4/5 fields

Most of the 28 registered doc_types have:
- `required_clauses: []`
- `forbidden_titles: []`
- `worker_classification_modes: []`

This means those doc_types get no completeness check, no title/body
validation, and no classification routing — they fall back to bare
`stop_reason: max_tokens` detection.

Prioritise population by **usage volume** (check Redis stats via the
`scope_guard:$key:$month:$stat` pattern or the production analytics
channel). The top handful of doc_types by month-to-date generations
should get populated first. Legal review required per doc_type.

## 5. Classification routing for jurisdictions beyond Nigeria

`worker_classification_prompts` currently cover Nigeria only. Kenya,
Ghana, UK, and US have analogous but distinct legal frameworks:
- Kenya — Employment Act 2007, NHIF, NSSF
- Ghana — Labour Act 2003 (Act 651), SSNIT
- UK — Employment Rights Act 1996, IR35, PAYE
- US — FLSA, ABC test (per state), 1099 vs W-2

**Do NOT draft these routing prompts without founder-signed-off local-law
review.** Same statutory-precision bar Phase 5 hit for Nigeria (s.91 ≠
tax exemption). Wrong routing under any of these produces
tax-authority-breach-grade errors, same class as the bug this sprint
fixed.

## 6. Branch protection — ✅ DONE

Founder has flipped **Require status checks to pass before merging**
on `main` with the following required checks:
- Lint & Test (20.x)
- Lint & Test (22.x)
- Production Build
- Security Audit

Harness failures now block merge. No further action needed.

## 7. SIG-CBDB6556 user outreach

Once the founder reviews `tmp/SIG-CBDB6556-regenerated.txt` and
confirms the regeneration is acceptable, email the original reporter
with:
- Summary of the three fixes (copy from `CHANGELOG.md`).
- The regenerated document attached.
- An invitation to regenerate any other docs they've created against
  the fixed pipeline at no charge.

Not automated. Founder-sent, founder-voice.
