# Fixtures — SIG-CBDB6556 reproductions

These fixtures back the three failing tests in `tests/api/generate.test.js` and
`tests/api/v1-documents-generate.test.js` that reproduce Bugs A, B, and C
in the document generation pipeline.

## Why synthetic

Real input fields and generated text for `SIG-CBDB6556` are **not
retrievable** from any server-side store. By design:

- `lib/doc-hash.js:148–167` — the audit log stores `{sequence, prev_hash,
  entry_hash, receipt, stored_at}` only. The `receipt` carries the content
  hash and signature, not the document body.
- `api/generate.js` (the pipeline that issued `SIG-CBDB6556`) does not
  persist `prompt`, `fields`, or the generated `rawText` anywhere.
- Marketing copy on the landing page (verified, not aspirational) states
  "Your answers are used only to generate your document in real time —
  they are never saved to a database, logged, or shared."

The synthetic fixtures below are shape-identical to what the Generator.jsx
Service Agreement form would have produced on 2026-04-21 for a Nigerian
provider. They reproduce the same structural defects the real document
exhibited, with clause content simplified to the minimum needed to drive
the assertions.

## Files

| File | Purpose |
|---|---|
| `sig-cbdb6556-inputs.json` | Reconstructed input fields. Keys match `Generator.jsx:241–251` Service Agreement field ids. Governing law: Nigeria. |
| `sig-cbdb6556-truncated.txt` | Bug A — clauses 1 through a partial "**11." then ends. Contains a forward reference from clause 5.2 to clause 15 (Termination) that never arrives. Anthropic's `stop_reason` would have been `max_tokens`. |
| `sig-cbdb6556-title-mismatch.txt` | Bug B — document header reads "SERVICE AGREEMENT" but body repeatedly uses "CONTRACT OF EMPLOYMENT". Both phrases appear verbatim multiple times so a substring search will detect the conflict. |
| `sig-cbdb6556-classification-conflict.txt` | Bug C — clause 2.1 cites s.91 Labour Act worker-exemption ("the Consultant is not a 'worker' within the meaning of s.91") AND clause 4 enumerates full employment deductions (PAYE 7.5%, pension 10% employer / 8% employee, NSITF 1%, NHF 2.5%, ITF 1%). These are mutually exclusive under Nigerian law. |

## When the real document becomes available

If the real SIG-CBDB6556 PDF surfaces (e.g. the user uploads it), drop
the text into `sig-cbdb6556-real.txt` and update the three tests to
exercise it alongside the synthetic fixtures. Keep the synthetic set —
they are the controlled reproduction baseline for CI and should not be
deleted once real data exists.
