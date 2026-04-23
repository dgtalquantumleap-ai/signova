# TASK — Apply Rosemary Onu-Okeke NDPA/GAID audit to Nigerian NDA generation pipeline.

## CONTEXT

On 2026-04-20, Barrister Rosemary Onu-Okeke (Esq. LL.B, B.L, MSc — Joint Heirs Chambers / DataLex Consulting, Abuja) conducted an NDPA 2023 / GAID 2025 compliance audit of Signova's generated Nigerian NDA. She delivered the formal written audit on 2026-04-22 via email.

She identified 9 specific gaps that expose users to Section 48 NDPA 2023 penalty of up to ₦10,000,000 or 2% of annual gross revenue, whichever is greater. Her overall assessment: the current document reflects "baseline compliance awareness, not operational compliance readiness."

This PR implements ALL 9 of her gaps in the Nigerian NDA generation pipeline, so she can sign off on the revised output in her Stage 1 review.

Reference source: `docs/compliance/rosemary-audit.txt` (extracted from her DOCX).

## SCOPE

STRICT: this PR touches Nigerian NDA generation ONLY.
- Do NOT modify non-NDA doc types.
- Do NOT modify non-Nigeria jurisdiction variants.
- Do NOT add new doc types.
- Do NOT touch marketing copy, landing pages, pricing logic, or the 6 equity docs shipped yesterday.
- Do NOT modify `lib/jurisdiction-context.js` beyond the Nigeria block. If a needed change is architectural (affects all Nigerian doc types), STOP and ask.

## THE 9 GAPS

### Gap 1 — Lawful Basis for Processing
Fix: (a) Expand personal data definition per NDPA 2023 Section 65 [VERIFY] + sensitive personal data category. (b) Dedicated clause requiring lawful basis declaration under NDPA 2023 Section 25 [VERIFY].

### Gap 2 — Data Minimisation
Fix: Dedicated clause limiting data sharing to only what is strictly necessary for the defined Purpose.

### Gap 3 — Data Retention & Deletion
Fix: (a) Defined retention periods. Default: "duration of agreement plus 2 years, otherwise 30 days post-purpose" [VERIFY with Rosemary]. (b) Secure deletion OR anonymization. (c) Reference GAID 2025 retention directive.

### Gap 4 — Security Measures (Technical & Organisational)
Fix: (a) AES-256 or equivalent encryption at rest AND in transit. (b) Role-based access controls. (c) Internal data governance processes. (d) Reference NDPA 2023 Section 39 [VERIFY].

### Gap 5 — Data Subject Rights
Fix: Clause for access, rectification, erasure, objection, portability; NDPC complaint right; 30-day response; designated contact. Reference Sections 33-38 [VERIFY].

### Gap 6 — Audit & Compliance Verification
Fix: Right to request compliance evidence; reasonable audits or independent audit reports; 14-day notice; each party bears own costs unless breach found.

### Gap 7 — Cross-Border Data Transfer (GAID 2025 Safeguards)
Fix: (a) Approved transfer mechanisms under GAID 2025. (b) Contractual safeguards for non-adequate jurisdictions. (c) Adequacy considerations. (d) Explicit consent where no adequacy mechanism. (e) Data subject notification.

### Gap 8 — Breach Notification Hierarchy
Fix: (a) KEEP 72-hour NDPC notification. (b) ADD immediate party-to-party notification BEFORE regulatory escalation. (c) Required content. (d) Reference NDPA 2023 Section 40 [VERIFY].

### Gap 9 — Duration of Confidentiality + Survival
Fix: (a) Explicit confidentiality duration. Default: "3 years from termination" [VERIFY with Rosemary]. (b) Survival clause for data protection obligations. (c) Reference NDPA 2023 Section 41 [VERIFY].

### GAID 2025 Primacy Shift
Within the Nigerian NDA prompt block ONLY:
- Before: `NDPA 2023 Section X`
- After: `GAID 2025 (implementing NDPA 2023 Section X)`

---

## PART 0 — DIAGNOSTIC (READ-ONLY, NO CHANGES)

Read these files and report findings:
1. `docs/compliance/rosemary-audit.txt`
2. `lib/jurisdiction-context.js` — Nigeria block
3. `api/generate.js` — nigeriaNDAClause and related handling
4. `api/v1/documents/generate.js` — Nigerian NDA handling
5. `lib/doc-registry.json` — NDA entry
6. `lib/doc-completeness.js` — findMissingClauses
7. Any Nigerian NDA body template or prompt file

STOP CONDITIONS: NDA has no Nigeria variant AND creating one is architectural; max_tokens insufficient; prompt in unexpected location.

STOP at end of Part 0. Wait for approval.

---

## PART 1 — EXTEND NIGERIAN NDA PROMPT BLOCK

In BOTH `api/generate.js` AND `api/v1/documents/generate.js`, add new section:

`NIGERIAN NDA — NDPA/GAID COMPLIANCE REQUIREMENTS (REVIEWED BY DATALEX CONSULTING)`

9 MANDATORY numbered instruction blocks, one per gap. Preserve [VERIFY] tags. GAID 2025 primacy shift in Nigerian NDA prompt only.

Closing line: "This Nigerian NDA has been reviewed for NDPA 2023 / GAID 2025 compliance gaps. Every instruction above is MANDATORY. Do not skip, summarize, or weaken any of the 9 numbered requirements. Where [VERIFY] tags appear, retain the exact statute citation provided — do NOT invent section numbers."

---

## PART 2 — REGISTRY required_clauses UPDATE

Scenario A (nigeria variant exists): add 9 clause IDs to it.
Scenario B (no nigeria variant): STOP and ask.

9 clause IDs: lawful-basis-processing, data-minimisation, retention-deletion, security-measures-specific, data-subject-rights, audit-verification, cross-border-transfer-gaid, breach-notification-hierarchy, duration-survival-data-protection

---

## PART 3 — COMPLETENESS CHECKER PATTERNS

Add regex patterns for each of the 9 new clauses to `lib/doc-completeness.js`.

---

## PART 4 — GENERATION VERIFICATION (STOP CHECKPOINT)

1. npm run build — clean pass
2. npm test — all 246 baseline tests pass
3. Generate Nigerian NDA via consumer endpoint — save to .audit-outputs/nigerian-nda-rosemary-fixes-test-01.txt
4. Generate via Ebenova API endpoint — save to .audit-outputs/nigerian-nda-rosemary-fixes-test-02.txt
5. Per-clause table (YES/NO, excerpt, quality) for both outputs
6. GAID 2025 primacy check
7. Overall audit-grade score 1-10

STOP at end of Part 4. Wait for approval.

---

## PART 5 — TESTS

it.each block covering all 9 clauses + GAID 2025 primacy + Section 48 penalty awareness.

---

## PART 6 — FINAL VERIFICATION

Build, test, generate two more NDAs with different scenarios, confirm both endpoints equivalent.

---

## PART 7 — FOLLOW_UPS.md

Create/append follow-up tracking at repo root.

---

## CRITICAL CONSTRAINTS

1. Do NOT commit. Do NOT push.
2. PRESERVE [VERIFY] tags in the prompt.
3. Do NOT invent statute sections.
4. Do NOT modify non-NDA doc types or non-Nigeria variants.
5. Do NOT weaken existing NDA clauses (additive only).
6. Preserve existing 72-hour NDPC notification.
7. Match style of nigeriaEquityClause.
8. If max_tokens tight, flag at Part 0.
9. Final output reviewable by Rosemary without reading code.
