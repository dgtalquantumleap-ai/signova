# Delaware NDA Bundle — Quality Verification

**Bundle:** `usa_delaware` / `nda`
**Seeded:** 2026-05-06 via `scripts/seed-statute-bundle.mjs`
**Cache TTL:** 30 days (expires 2026-06-05)
**Verifier:** Olumide (olumide@ebenova.net), 2026-05-06
**Methodology:** All 4 entries verified against Delaware Code Online primary
source (delcode.delaware.gov, Title 6 Chapter 20).

This Delaware bundle covers the Delaware Uniform Trade Secrets Act (DUTSA),
6 Del. C. §§ 2001–2009. Seeded in Day 4 alongside the SOX/SEC federal
expansion. Delaware was added to `JURISDICTION_KEYS` in
`lib/jurisdiction-context.js` as part of Day 4.

**Routing note:** As of Day 4, `api/generate.js` does NOT yet route
Delaware-marked NDA requests to `usa_delaware` — Delaware text in the
prompt currently triggers `isUSA` and routes to `usa_federal`. The
Delaware bundle exists for future routing work; activating it requires
adding an `isDelaware` boolean detector in the consumer/v1/preview
endpoints. Day 4 is bundle expansion only per the brief constraints.

---

## Entry 1 — DUTSA-misappropriation

**Query:** Delaware Uniform Trade Secrets Act 6 Del C 2001 misappropriation definition remedies
**Content length:** 2338 chars · **Sources:** 0 (URL embedded in content text)
**Olostep answer ID:** `answer_zhoum9orpz`

### Sources
- (Olostep returned the URL inside the content text rather than the structured `sources_json` field.) Embedded source: https://delcode.delaware.gov/title6/c020/index.html

### Cached content (excerpt — full text in cache)

> **Misappropriation (6 Del. C. § 2001)**
>
> "Misappropriation" means:
> 1. Acquisition of a trade secret of another by a person who knows or has reason to know that the trade secret was acquired by improper means; **or**
> 2. Disclosure or use of a trade secret of another without express or implied consent by a person who:
>    - Used improper means to acquire knowledge of the trade secret; **or**
>    - At the time of disclosure or use, knew or had reason to know that his or her knowledge of the trade secret was: …
>
> **Remedies (6 Del. C. §§ 2002-2004)**
>
> - **Injunctive Relief (§ 2002):** Courts may enjoin actual or threatened misappropriation. An injunction ends when the trade secret ceases to exist, but may continue for a reasonable period to eliminate any remaining commercial advantage. In exceptional circumstances, a court may condition future use on payment of a reasonable royalty instead of a prohibitive injunction. Courts may also compel affirmative acts to protect a trade secret.
> - **Damages (§ 2003):** Plaintiffs may recover damages for misappropriation, including actual loss and unjust enrichment. Alternatively, damages may be measured by a reasonable royalty for the unauthorized disclosure or use of the trade secret. If the misappropriation is willful and malicious, exemplary damages up to twice the amount awarded under the primary damages provision may be granted.
> - **Attorneys' Fees (§ 2004):** The court may award reasonable attorney's fees to the prevailing party when a claim of misappropriation is made in bad faith, a motion to terminate or resist an injunction is made in bad faith, or when willful and malicious misappropriation exists.

### Verification

- **Verdict:** ✓ MATCH
- **Confidence:** high
- **Methodology:** primary-source comparison vs Delaware Code Online § 2001 (and §§ 2002-2004 recap)
- **Evidence:** Both prongs of misappropriation (acquisition by improper means; disclosure/use under improper-means/duty-of-secrecy/material-change conditions) match § 2001's UTSA-derived definition. The §§ 2002-2004 recap correctly captures injunctive relief, damages (actual + unjust enrichment + reasonable royalty + 2x exemplary), and attorney's fees.
- **Notes:** Olostep returned the source URL inside the content text rather than the structured `sources_json` field. The injection layer renders source from the structured field, so this entry will display "(no source URL)" in injected prompts. Substantively safe to inject. If display matters, Day 5+ can re-seed this single query.

---

## Entry 2 — DUTSA-injunctive-relief

**Query:** Delaware Uniform Trade Secrets Act 6 Del C 2002 injunctive relief actual threatened misappropriation
**Content length:** 367 chars · **Sources:** 1
**Olostep answer ID:** `answer_1y5oi3pwmx`

### Sources
- https://law.justia.com/codes/delaware/title-6/chapter-20/section-2002/ — *6 Delaware Code § 2002 (2025) — Injunctive relief*

### Cached content

> Injunctive relief. (a) Actual or threatened misappropriation may be enjoined. Upon application to the court, an injunction shall be terminated when the trade secret has ceased to exist, but the injunction may be continued for an additional reasonable period of time in order to eliminate commercial advantage that otherwise would be derived from the misappropriation.

### Verification

- **Verdict:** ✓ MATCH
- **Confidence:** high
- **Methodology:** primary-source comparison vs Delaware Code Online § 2002(a)
- **Evidence:** Cached content is a verbatim quote of subsection (a). Subsections (b) (compelling affirmative acts) and (c) (reasonable royalty in lieu of prohibition) are not included in this entry but are summarised in Entry 1's recap.
- **Notes:** Coverage gap (subsections (b) and (c) absent here, present in Entry 1) is acceptable — Entry 1 provides comprehensive context and Entry 2 covers the most-cited subsection.

---

## Entry 3 — DUTSA-damages

**Query:** Delaware Uniform Trade Secrets Act 6 Del C 2003 damages exemplary damages willful malicious
**Content length:** 342 chars · **Sources:** 2
**Olostep answer ID:** `answer_u1bjgoy336`

### Sources
- https://law.justia.com/codes/delaware/title-6/chapter-20/section-2003/ — *6 Delaware Code § 2003 (2025) — Damages*
- https://delcode.delaware.gov/title6/c020/index.html — *Chapter 20. TRADE SECRETS — Delaware Code Online*

### Cached content

> Under the Delaware Uniform Trade Secrets Act (6 Del. C. § 2003), the court may award exemplary (punitive) damages when the misappropriation is found to be willful and malicious. Section 2003(b) provides that exemplary damages may be awarded in an amount not exceeding twice the amount of any compensatory damages awarded under subsection (a).

### Verification

- **Verdict:** ✓ MATCH
- **Confidence:** high
- **Methodology:** primary-source comparison vs Delaware Code Online § 2003
- **Evidence:** § 2003(b) statutory text: *"If wilful and malicious misappropriation exists, the court may award exemplary damages in an amount not exceeding twice any award made under subsection (a)."* Cached content captures the trigger ("willful and malicious") and cap ("twice the amount of any compensatory damages awarded under subsection (a)") accurately.
- **Notes:** Subsection (a) (actual loss, unjust enrichment, reasonable royalty alternative) is referenced but not quoted in detail; Entry 1 covers it.

---

## Entry 4 — DUTSA-attorney-fees

**Query:** Delaware Uniform Trade Secrets Act 6 Del C 2004 attorney fees bad faith willful
**Content length:** 243 chars · **Sources:** 1
**Olostep answer ID:** `answer_vteslb0uw1`

### Sources
- https://codes.findlaw.com/de/title-6-commerce-and-trade/de-code-sect-6-2004/ — *Delaware Code Title 6. Commerce and Trade § 2004. Attorneys' fees*

### Cached content

> If a claim of misappropriation is made in bad faith, a motion to terminate an injunction is made or resisted in bad faith, or wilful and malicious misappropriation exists, the court may award reasonable attorney's fees to the prevailing party.

### Verification

- **Verdict:** ✓ MATCH
- **Confidence:** high
- **Methodology:** primary-source comparison vs Delaware Code Online § 2004
- **Evidence:** Cached content is a verbatim quote of § 2004. All three triggers (bad-faith claim, bad-faith motion, willful-and-malicious misappropriation) are preserved in correct order.
- **Notes:** None.

---

## Summary

| Entry | Verdict | Confidence | Methodology | Key finding |
|-------|---------|------------|-------------|-------------|
| 1 — DUTSA-misappropriation | ✓ MATCH | high | primary-source vs delcode.delaware.gov § 2001 | Comprehensive coverage of §§ 2001-2004; sources_json empty (URL in content text) |
| 2 — DUTSA-injunctive-relief | ✓ MATCH | high | primary-source vs § 2002 | Verbatim quote of subsection (a) |
| 3 — DUTSA-damages | ✓ MATCH | high | primary-source vs § 2003 | Subsection (b) exemplary-damages provision accurately captured |
| 4 — DUTSA-attorney-fees | ✓ MATCH | high | primary-source vs § 2004 | Verbatim quote |

**Counts (of 4 seeded):** 4 ✓ MATCH · 0 ⚠ PARTIAL · 0 ✗ MISMATCH

**Decision:** ✓ Bundle production-ready for retrieval injection (once
Delaware routing is added to the endpoints). The Day 4 brief explicitly
scoped Delaware as bundle-only, with routing wiring deferred — see the
"Routing note" at top of this doc.

**Verifier signature:** Olumide (olumide@ebenova.net) — verified 2026-05-06

---

## Reference: SQL to re-inspect cache

```sql
SELECT
  jurisdiction,
  doc_type,
  statute_ref,
  LENGTH(content) AS content_length,
  jsonb_array_length(sources_json) AS source_count,
  retrieved_at,
  expires_at
FROM statute_cache
WHERE jurisdiction = 'usa_delaware' AND doc_type = 'nda'
ORDER BY statute_ref;
```

Run via Supabase SQL editor: https://supabase.com/dashboard/project/snqzmlctnlzkvcssotzx/sql/new
