# US Federal NDA Bundle — Quality Verification

**Bundle:** `usa_federal` / `nda`
**Seeded:** 2026-05-06 via `scripts/seed-statute-bundle.mjs`
**Cache TTL:** 30 days (expires 2026-06-05)
**Verifier:** Olumide (olumide@ebenova.net), 2026-05-06
**Methodology:** Entries 1-4 verified against Cornell LII (primary source).
Entry 5 (common-law doctrine) verified against secondary-source consistency.
Entry 6 deferred — see "Excluded from this bundle".

---

## Verification scoring

For each row, mark one of:
- ✓ **verified accurate** — statute citation correct, source authoritative, content matches query, no hallucination
- ⚠ **verified with minor issue** — usable but note the issue
- ✗ **rejected** — refine query and re-run

Pass criteria:
- 5+ ✓: bundle is production-ready → continue Part 7 (apply `_meta` block)
- 3-4 ✓: iterate on rejected queries before Day 3
- < 3 ✓: STOP — query design needs rework

---

## Cross-reference how to verify

For each entry, Olumide should confirm:
1. **Statute reference correctness.** Does the cited section number actually correspond to the topic? (e.g., is 18 USC 1839 actually the trade-secret definition?)
2. **Source authoritativeness.** `.gov`, `cornell.edu` (LII), `govinfo.gov`, established legal databases (Westlaw, Lexis), or recognised law firms with track record. Be skeptical of marketing-style legal blogs.
3. **Content fidelity.** Does the cached content actually answer the query? Anything that wasn't in the source (hallucinated)?
4. **Currency.** Was the statute amended after the source's publication date in a way that makes the content stale?

---

## Entry 1 — DTSA-trade-secret-definition

**Query:** United States Defend Trade Secrets Act 18 USC 1839 definition of trade secret
**Content length:** 803 chars · **Sources:** 1
**Olostep answer ID:** `answer_z74u8bsi36`

### Sources
- https://www.law.cornell.edu/uscode/text/18/1839 — *18 U.S. Code § 1839 - Definitions*

### Cached content

> The term "trade secret" means all forms and types of financial, business, scientific, technical, economic, or engineering information, including patterns, plans, compilations, program devices, formulas, designs, prototypes, methods, techniques, processes, procedures, programs, or codes, whether tangible or intangible, and whether or how stored, compiled, or memorialized physically, electronically, graphically, photographically, or in writing, if (A) the owner thereof has taken reasonable measures to keep such information secret; and (B) the information derives independent economic value, actual or potential, from not being generally known to, and not being readily ascertainable through proper means by, another person who can obtain economic value from the disclosure or use of the information.

### Verification

- **Verdict:** ✓ MATCH
- **Confidence:** high
- **Methodology:** primary-source comparison vs Cornell LII § 1839(3)
- **Evidence:** Cached content is a near-verbatim quote of statutory text. Cornell § 1839(3) reads: *"all forms and types of financial, business, scientific, technical, economic, or engineering information, including patterns, plans, compilations, program devices, formulas, designs, prototypes, methods, techniques, processes, procedures, programs, or codes, whether tangible or intangible, and whether or how stored, compiled, or memorialized physically, electronically, graphically, photographically, or in writing if— (A) the owner thereof has taken reasonable measures to keep such information secret; and (B) the information derives independent economic value..."* The cached version prefixes with "The term 'trade secret' means" matching the statutory phrasing.
- **Notes:** None.

---

## Entry 2 — DTSA-misappropriation-remedies

**Query:** United States Defend Trade Secrets Act 18 USC 1836 civil remedies for misappropriation
**Content length:** 1732 chars · **Sources:** 2
**Olostep answer ID:** `answer_if1yno71il`

### Sources
- https://www.law.cornell.edu/uscode/text/18/1836 — *18 U.S. Code § 1836 - Civil proceedings - Cornell Law School*
- https://www.govinfo.gov/link/uscode/18/1836 — *§ 1836. – Civil proceedings*

### Cached content

> Under the Defend Trade Secrets Act (DTSA) – 18 U.S.C. § 1836 – a civil action for misappropriation may provide the following remedies:
>
> 1. **Injunctive relief** – a court may issue an injunction (including temporary restraining orders) to stop actual or threatened misappropriation, with limited restrictions on employment relationships and state law restraints.
> 2. **Damages** –
>    - **Actual loss** caused by the misappropriation;
>    - **Unjust enrichment** attributable to the misappropriation that is not captured by the actual-loss measure;
>    - **Reasonable royalty** in lieu of other damages, based on the value of the trade secret to the misappropriator.
> 3. **Exemplary (punitive) damages** – up to twice the amount of the damages awarded when the trade secret is willfully and maliciously misappropriated.
> 4. **Attorney's fees and costs** – reasonable fees may be awarded to the prevailing party when the claim is made in bad faith, a motion to terminate an injunction is made or opposed in bad faith, or the misappropriation is willful and malicious.
> 5. **Civil seizure** – in extraordinary circumstances, a court may, ex parte, order the seizure of property (including electronic media) necessary to prevent further dissemination of the trade secret. The seizure must meet strict factual requirements and is subject to a prompt hearing.
> 6. **Other equitable relief** – the court may order affirmative actions to protect the trade secret and may award damages for wrongful or excessive seizure.
>
> These remedies are available in federal district courts, which have original jurisdiction over DTSA civil actions, and the action must be filed within three years of discovery (or reasonable diligence) of the misappropriation.

### Verification

- **Verdict:** ✓ MATCH
- **Confidence:** high
- **Methodology:** primary-source comparison vs Cornell LII § 1836(b)–(d)
- **Evidence:**
    - Cached "Injunctive relief" matches § 1836(b)(3)(A): *"grant an injunction…to prevent any actual or threatened misappropriation"*
    - Cached "Damages" (actual loss + unjust enrichment + reasonable royalty) matches § 1836(b)(3)(B): *"damages for actual loss caused by the misappropriation"* + *"damages for any unjust enrichment"* + *"liability for a reasonable royalty"*
    - Cached "Exemplary damages — up to twice the amount" matches § 1836(b)(3)(C): *"exemplary damages in an amount not more than 2 times the amount of the damages awarded"*
    - Cached "Attorney's fees" matches § 1836(b)(3)(D): *"reasonable attorney's fees to the prevailing party"*
    - Cached "Civil seizure" corresponds to § 1836(b)(2) (DTSA's distinctive ex-parte seizure remedy — real and accurately described)
    - Cached "3-year statute of limitations" matches § 1836(d): *"may not be commenced later than 3 years after the date on which the misappropriation…is discovered"*
    - Cached "federal district courts have original jurisdiction" matches § 1836(c): *"The district courts of the United States shall have original jurisdiction"*
- **Notes:** All listed remedies and procedural rules are present in the statute. No fabricated provisions.

---

## Entry 3 — DTSA-whistleblower-immunity

**Query:** United States Defend Trade Secrets Act 18 USC 1833 whistleblower immunity notice requirement in NDAs
**Content length:** 2202 chars · **Sources:** 2
**Olostep answer ID:** `answer_8cvfx2dp7t`

### Sources
- https://katten.com/The-Notice-Provision-of-the-Defend-Trade-Secrets-Act — *The Notice Provision of the Defend Trade Secrets Act (DTSA) – Katten*
- https://www.law.cornell.edu/uscode/text/18/1833 — *18 U.S. Code § 1833 – Exceptions to prohibitions (Cornell Law School)*

### Cached content

> Under the Defend Trade Secrets Act (DTSA), 18 U.S.C. § 1833(b) requires every employer to give a written notice of whistle-blower immunity in any contract or agreement (including employment contracts, consulting agreements, restrictive-covenant agreements, and non-disclosure agreements) that governs the use or disclosure of a trade secret or other confidential information. The notice must state that an individual cannot be held criminally or civilly liable for disclosing a trade secret (i) in confidence to a federal, state, or local government official or to an attorney, solely for the purpose of reporting or investigating a suspected violation of law, or (ii) in a complaint or other court filing made under seal. It should also explain that, in an anti-retaliation lawsuit, the individual may disclose the trade secret to counsel and use it in court so long as any document containing the secret is filed under seal and the secret is not disclosed except by court order. Failure to provide this notice may bar the employer from recovering exemplary damages or attorney-fees in a trade-secret action.
>
> Employers can satisfy the requirement by inserting the DTSA notice directly into the agreement or by cross-referencing a written policy that contains the notice language.
>
> **Sample notice language** (as suggested by Katten and the Cornell U.S. Code):
>
> > "Pursuant to 18 U.S.C. § 1833(b), an individual may not be held criminally or civilly liable under any federal or state trade-secret law for the disclosure of a trade secret that is made (i) in confidence to a federal, state, or local government official, or to an attorney, solely for the purpose of reporting or investigating a suspected violation of law; or (ii) in a complaint or other document filed in a lawsuit or other proceeding, if such filing is made under seal. An individual who files a lawsuit for retaliation for reporting a suspected violation of law may disclose the trade secret to his or her attorney and use the trade-secret information in the court proceeding, provided any document containing the trade secret is filed under seal and the trade secret is not disclosed except pursuant to a court order."

### Verification

- **Verdict:** ✓ MATCH
- **Confidence:** high
- **Methodology:** primary-source comparison vs Cornell LII § 1833(b)
- **Evidence:**
    - Cached "§ 1833(b) requires…a written notice…in any contract or agreement…that governs the use or disclosure of a trade secret" tracks § 1833(b)(3)(A): *"An employer shall provide notice of the immunity set forth in this subsection in any contract or agreement with an employee that governs the use of a trade secret or other confidential information."*
    - Cached immunity description (i)(government/attorney for reporting violations) and (ii)(filing under seal) matches § 1833(b)(1): *"made in confidence to a Federal, State, or local government official…and solely for the purpose of reporting or investigating a suspected violation of law"* and *"made in a complaint or other document filed in a lawsuit or other proceeding, if such filing is made under seal."*
    - Cached cross-reference compliance option matches § 1833(b)(3)(B): *"a cross-reference to a policy document provided to the employee that sets forth the employer's reporting policy."*
    - Cached "failure to provide this notice may bar the employer from recovering exemplary damages or attorney-fees" matches § 1833(b)(3)(C): *"the employer may not be awarded exemplary damages or attorney fees under subparagraph (C) or (D) of section 1836(b)(3)."*
- **Notes:** Minor stylistic expansion — cached writes "use or disclosure" where statute says "use." Common practice in legal commentary; not material. The illustrative list ("employment contracts, consulting agreements, restrictive-covenant agreements, NDAs") is consistent with § 1833(b)(4)'s definition of "employee" (which expressly includes contractors and consultants).

---

## Entry 4 — EEA-criminal-penalties

**Query:** United States Economic Espionage Act 18 USC 1832 criminal penalties for trade secret theft
**Content length:** 1093 chars · **Sources:** 1
**Olostep answer ID:** `answer_sb2veiel2y`

### Sources
- https://www.law.cornell.edu/uscode/text/18/1832 — *18 U.S. Code § 1832 - Theft of trade secrets | Cornell LII*

### Cached content

> Under 18 U.S.C. § 1832 (Theft of Trade Secrets), a person who steals, misappropriates, or otherwise converts a trade secret for the economic benefit of anyone other than the owner can be punished by a fine and/or imprisonment of up to 10 years.  The statute states that the offender "shall, except as provided in subsection (b), be fined under this title or imprisoned not more than 10 years, or both."
>
> For corporate or organizational offenders, the penalty is a civil fine of the greater of $5,000,000 or three times the value of the stolen trade secret (including avoided research and development costs).  This fine applies to any organization that commits an offense described in subsection (a).
>
> In summary:
> - **Individuals:** Up to 10 years in federal prison and/or a fine (the amount of the fine is not specified in the statute and is determined under Title 18).
> - **Organizations:** Fine of the greater of $5 million or three times the value of the trade secret that was stolen.
>
> These penalties are in addition to any restitution, forfeiture, or other sanctions the court may impose.

### Verification

- **Verdict:** ⚠ PARTIAL
- **Confidence:** high
- **Methodology:** primary-source comparison vs Cornell LII § 1832(a)–(b)
- **Evidence (figures match):**
    - Cached "Up to 10 years in federal prison" matches § 1832(a): *"be fined under this title or imprisoned not more than 10 years, or both."*
    - Cached "$5,000,000 or three times the value" matches § 1832(b): *"fined not more than the greater of $5,000,000 or 3 times the value of the stolen trade secret to the organization."*
    - Cached "(including avoided research and development costs)" matches § 1832(b): *"including expenses for research and design and other costs of reproducing the trade secret that the organization has thereby avoided."*
- **Specific discrepancy:**
    - Cached: *"For corporate or organizational offenders, the penalty is a **civil fine** of the greater of $5,000,000…"*
    - Statute: § 1832 sits in Title 18 Chapter 90 ("Protection of Trade Secrets") which is **criminal** law. Fines under § 1832 are imposed in criminal proceedings, not civil. Civil penalties for trade secret misappropriation are addressed in § 1836 (Entry 2).
- **Severity:** Material wording issue. The penalty figures are correct, but characterizing § 1832 fines as "civil" understates severity (criminal prosecution carries different procedural protections, evidentiary standards, and reputational consequences than civil enforcement). When this cached content is used as Day 3 context for NDA drafting, the system prompt should reframe "civil fine" as "criminal fine" before injection.
- **Action:** Bundle metadata `verification_results['EEA-criminal-penalties']` records this as `partial` with a note flagging the "civil fine" misnomer. Day 3 wiring (or a future re-seed with refined query) can address.

---

## Entry 5 — NDA-consideration-doctrine

**Query:** United States contract law consideration requirement for non-disclosure agreements
**Content length:** 1448 chars · **Sources:** 3
**Olostep answer ID:** `answer_56w3g4zo8x`

**Note:** Doctrinal entry — no single statute. Sources are secondary (law firms + Thomson Reuters). Common-law consideration is state-by-state; verify whether content matches mainstream US doctrine.

### Sources
- https://www.hanley-law.com/blog/what-makes-a-non-disclosure-agreement-legally-enforceable/ — *What Makes a Non-Disclosure Agreement Legally Enforceable?*
- https://www.ubglaw.com/news-and-media/ndas-and-contracts-how-to-structure-an-enforceable-non-disclosure-agreement — *NDAs and Contracts: How to Structure an Enforceable Non-Disclosure Agreement*
- https://legal.thomsonreuters.com/en/insights/articles/4-things-to-know-about-non-disclosure-agreements — *4 things you should know about non-disclosure agreements*

### Cached content

> Under U.S. contract law an NDA is treated like any other contract and therefore must be supported by consideration.  Consideration is the bargained-for exchange of something of legal value.  In practice courts accept a wide range of consideration for NDAs, including:
> • A promise of employment, a salary, a bonus, a raise, or other compensation (e.g., the job offer itself is sufficient consideration).
> • Access to confidential information or trade secrets that the receiving party will be allowed to use.
> • A promise to refrain from disclosing the information in exchange for a monetary payment, a release of liability, or other benefits.
> • Mutual promises where each party gives up a legal right (e.g., the disclosing party promises confidentiality and the receiving party promises not to use the information).
> If no consideration is present—such as a one-sided promise to keep information confidential without any benefit to the receiving party—the NDA is generally deemed unenforceable.  The consideration need not be equal in value, but it must have some legal value in the eyes of the law.
>
> Key points from U.S. authorities:
> 1. An NDA must include consideration, mutual assent, and definite terms (UBG Law).
> 2. Fair consideration can be employment, compensation, or the exchange of valuable information (Hanley Law).
> 3. Courts look for a "bargain for exchange" and will enforce NDAs when such consideration is evident (Thomson Reuters).

### Verification

- **Verdict:** ⚠ PARTIAL (verification gap, not content concern)
- **Confidence:** medium
- **Methodology:** secondary-source consistency check
- **Source-fetch results:**
    - ✓ **hanley-law.com** — fetched successfully. Confirms: *"A legally binding NDA requires fair consideration"* and lists *"employment, compensation, or access to valuable information"* as consideration examples. Consistent with cached content.
    - ✗ **ubglaw.com** — HTTP 403 (Forbidden) when fetched. Cannot verify the specific UBG-attributed claim ("consideration, mutual assent, and definite terms") against source.
    - ✗ **thomsonreuters.com** — fetch blocked. Cannot verify the "bargain for exchange" attribution.
- **Substance assessment:**
    - The general doctrine (NDAs require consideration; common forms include employment, compensation, mutual exchange; one-sided promises without benefit are unenforceable; consideration need not be equal in value) is mainstream, uncontroversial US contract law (Restatement (Second) of Contracts §§ 71–81; *Hamer v. Sidway* 124 N.Y. 538 (1891) for "legal value not equal value").
    - Risk: cached content does not flag that consideration doctrine has state-by-state nuances (e.g., past consideration treated differently in some states, employer-imposed post-hire NDAs may face fresh-consideration challenges in CA/MA/IL).
- **Severity:** Verification gap (2/3 sources unreachable from this environment), not a content fabrication. The single accessible source is consistent with cached claims.
- **Action:** Bundle metadata records this as `partial` (medium confidence). Day 3 may want to manually re-confirm UBG and Thomson Reuters attributions before relying on those specific source citations downstream. Substantively the doctrine is safe to use.

---

## Day 4 additions — Entries 6, 7, 8

Day 4 expanded the bundle with three federal whistleblower statutes after
Day 3 smoke testing showed retrieval-ON omitted SOX/SEC content that
Sonnet's training-memory output included. Closing this gap was the
specific motivation: add the statutes to the verified bundle so the
"cite only verified" instruction stops suppressing accurate content.

### Entry 6 — SOX-806-whistleblower

**Query:** Sarbanes-Oxley Act 18 USC 1514A whistleblower protection corporate fraud reporting publicly traded companies
**Content length:** 1160 chars · **Sources:** 3
**Olostep answer ID:** `answer_b9cfyylwlp`

**Sources**
- https://www.law.cornell.edu/uscode/text/18/1514A — *18 U.S. Code § 1514A — Civil action to protect against retaliation in...*
- https://www.justia.com/employment/retaliation/sarbanes-oxley-act/ — *The Sarbanes-Oxley Act and Whistleblowers' Legal Rights — Justia*
- https://www.govinfo.gov/link/uscode/18/1514A — *18 U.S.C. § 1514A — Civil action to protect against retaliation in fraud cases.*

**Cached content**

> Section 806 of the Sarbanes-Oxley Act, codified at 18 U.S.C. § 1514A, gives employees of publicly-traded companies a civil cause of action when they are retaliated against for reporting corporate fraud. The statute protects whistle-blowers who disclose violations of mail, wire, bank, or securities fraud (including violations of the Securities Exchange Act, the Federal Securities Laws, or any related SEC regulations). To invoke the protection, a whistle-blower must file a complaint in federal court within 180 days of the alleged retaliation. The law covers a range of fraudulent conduct — from accounting manipulation and false financial statements to insider trading and other securities violations — and requires employers not to discharge, demote, suspend, threaten, harass, or otherwise discriminate against an employee for making a protected disclosure. Remedies include reinstatement, back pay, compensatory damages, and attorney's fees. The statute is intended to break the "corporate code of silence" that contributed to major accounting scandals and to encourage reporting of corporate misconduct by providing robust anti-retaliation protections.

**Verification**

- **Verdict:** ✓ MATCH
- **Confidence:** high
- **Methodology:** primary-source comparison vs Cornell LII § 1514A
- **Evidence:**
    - Cached "publicly-traded companies" matches § 1514A(a): *"No company with a class of securities registered under section 12 of the Securities Exchange Act of 1934..."*
    - Cached protected disclosures (mail/wire/bank/securities fraud + SEC regulations + federal fraud-against-shareholders law) matches § 1514A(a)(1): *"a violation of section 1341, 1343, 1344, or 1348, any rule or regulation of the Securities and Exchange Commission, or any provision of Federal law relating to fraud against shareholders"*
    - Cached "180 days" filing deadline matches § 1514A(b)(2)(D): *"An action under paragraph (1) shall be commenced not later than 180 days after the date on which the violation occurs"*
    - Cached prohibited conduct list ("discharge, demote, suspend, threaten, harass, or otherwise discriminate") is verbatim from § 1514A(a)
    - Cached remedies (reinstatement, back pay, compensatory damages, attorney's fees) align with § 1514A(c): *"reinstatement with the same seniority status... back pay, with interest... compensation for any special damages... including litigation costs, expert witness fees, and reasonable attorney fees"*
- **Notes:** None.

---

### Entry 7 — SEC-21F-whistleblower

**Query:** Securities Exchange Act Section 21F 15 USC 78u-6 SEC whistleblower bounty program protection
**Content length:** 1383 chars · **Sources:** 2
**Olostep answer ID:** `answer_cl0bb8mipi`

**Sources**
- https://www.sec.gov/enforcement-litigation/whistleblower-program/whistleblower-protections — *Whistleblower Protections — SEC.gov*
- https://www.law.cornell.edu/uscode/text/15/78u-6 — *15 U.S. Code § 78u-6 — Securities whistleblower incentives and protection*

**Cached content**

> Section 21F of the Securities Exchange Act of 1934 (codified at 15 U.S.C. § 78u-6) creates the SEC's whistleblower bounty program. It authorizes the Commission to award eligible whistleblowers a percentage (typically 10 %–30 %) of monetary sanctions collected in a covered action that exceeds $1 million. The statute also provides robust protections for whistleblowers:
>
> 1. **Anti-retaliation** — it is unlawful for any person to take adverse action against an employee for reporting a possible securities-law violation to the SEC (Rule 21F-17).
> 2. **Confidentiality** — the SEC must keep the identity of the whistleblower confidential, except as required by law.
> 3. **Eligibility and award criteria** — the whistleblower must provide original information that leads to a successful enforcement action; the award is calculated on penalties, fines, disgorgement, interest, and settlement payments, but excludes forfeiture, restitution, or victim compensation.
> 4. **Procedural safeguards** — the whistleblower may receive a notice of eligibility, can request a hearing on the award, and may be protected from employer retaliation through the Commission's enforcement powers.

**Verification**

- **Verdict:** ⚠ PARTIAL
- **Confidence:** high
- **Methodology:** primary-source comparison vs Cornell LII § 78u-6
- **Evidence (substance correct):**
    - Cached award range (10–30%) matches § 78u-6(b)(1): *"not less than 10 percent... not more than 30 percent"*
    - Cached threshold ($1M) matches § 78u-6(a)(1): *"monetary sanctions exceeding $1,000,000"*
    - Cached confidentiality matches § 78u-6(h)(2)(A): *"the Commission... shall not disclose any information... which could reasonably be expected to reveal the identity of a whistleblower"*
    - Cached anti-retaliation prohibition matches § 78u-6(h)(1)(A): *"No employer may discharge, demote, suspend, threaten, harass, directly or indirectly, or in any other manner discriminate against, a whistleblower"*
- **Specific discrepancy (citation only):**
    - Cached attributes anti-retaliation to *"(Rule 21F-17)"*. The correct citation is § 78u-6(h)(1) — Rule 21F-17 is the SEC anti-impedance rule (a related but distinct provision, covered separately as Entry 8).
- **Severity:** Citation error, not a substantive error. The anti-retaliation explanation is correct; only the parenthetical citation is wrong.
- **Action:** Bundle metadata records this as `partial` (high confidence). No reframing engine entry — the find term spans non-word characters (parens) which the current word-boundary regex can't match cleanly. If the smoke-test shows this propagating into generated NDAs, Day 5+ should refactor the engine OR re-seed with a refined query that doesn't trip this confusion. Day 4 brief explicitly anticipated ⚠ on SEC entries.

---

### Entry 8 — SEC-rule-21F-17-impedance

**Query:** SEC Rule 21F-17 17 CFR 240.21F-17 anti-impedance rule whistleblower confidentiality clauses
**Content length:** 797 chars · **Sources:** 1
**Olostep answer ID:** `answer_mt3m8laom6`

**Sources**
- https://www.law.cornell.edu/cfr/text/17/240.21F-17 — *17 CFR § 240.21F-17 — Staff communications with individuals reporting possible securities law violations*

**Cached content**

> (a) No person may take any action to impede an individual from communicating directly with the Commission staff about a possible securities law violation, including enforcing, or threatening to enforce, a confidentiality agreement (other than agreements dealing with information covered by § 240.21F-4(b)(4)(i) and § 240.21F-4(b)(4)(ii) of this chapter related to the legal representation of a client) with respect to such communications.
>
> (b) If you are a director, officer, member, agent, or employee of an entity that has counsel, and you have initiated communication with the Commission relating to a possible securities law violation, the staff is authorized to communicate directly with you regarding the possible securities law violation without seeking the consent of the entity's counsel.

**Verification**

- **Verdict:** ✓ MATCH
- **Confidence:** high
- **Methodology:** primary-source comparison vs Cornell LII (eCFR-equivalent) 17 CFR § 240.21F-17
- **Evidence:** Subsection (a) and subsection (b) are verbatim quotes from the regulation. The cross-reference to § 240.21F-4(b)(4)(i)/(ii) for legal-representation exceptions is preserved.
- **Notes:** None. This entry directly enables generated NDAs to comply with the SEC anti-impedance rule by explicitly addressing the confidentiality-agreement carve-out.

---

## Excluded from this bundle

**Entry 6 — NDA-reasonable-restraint** was deferred from Day 2 and removed from
the cache. State-specific claims about NDA enforceability (Michigan/Illinois/
Georgia/Wisconsin/Iowa/West Virginia/Florida) require per-state queries
verified against state primary statute sources (e.g., legis.state.tx.us for
Texas), not a single federal-level query against secondary sources.

Scoped for refinement in Phase 1 Day 5+ when state-level jurisdictions are
added to bundles. To delete the cached row from the seeding run:

```sql
DELETE FROM statute_cache
WHERE jurisdiction = 'usa_federal'
  AND doc_type = 'nda'
  AND statute_ref = 'NDA-reasonable-restraint';
```

Run via Supabase SQL editor: https://supabase.com/dashboard/project/snqzmlctnlzkvcssotzx/sql/new

---

## Summary

| Entry | Verdict | Confidence | Methodology | Key finding |
|-------|---------|------------|-------------|-------------|
| 1 — DTSA-trade-secret-definition | ✓ MATCH | high | primary-source vs Cornell § 1839 | Near-verbatim quote of statutory definition |
| 2 — DTSA-misappropriation-remedies | ✓ MATCH | high | primary-source vs Cornell § 1836 | All listed remedies + 3-year SoL + federal jurisdiction match |
| 3 — DTSA-whistleblower-immunity | ✓ MATCH | high | primary-source vs Cornell § 1833 | Notice requirement, immunity scope, sample language all match |
| 4 — EEA-criminal-penalties | ⚠ PARTIAL | high | primary-source vs Cornell § 1832 | Figures correct; mislabels organisational fine as "civil" — § 1832 is criminal. Reframing applied at injection |
| 5 — NDA-consideration-doctrine | ⚠ PARTIAL | medium | secondary-source consistency | Hanley confirmed; UBG/Thomson Reuters unfetchable. Doctrine is mainstream US contract law |
| 6 — SOX-806-whistleblower (Day 4) | ✓ MATCH | high | primary-source vs Cornell § 1514A | All key provisions (coverage, protected disclosures, 180-day deadline, remedies) match |
| 7 — SEC-21F-whistleblower (Day 4) | ⚠ PARTIAL | high | primary-source vs Cornell § 78u-6 | Substance correct (10-30% range, $1M threshold, anti-retaliation). Citation error: anti-retaliation wrongly attributed to Rule 21F-17 — correct citation is § 78u-6(h)(1) |
| 8 — SEC-rule-21F-17-impedance (Day 4) | ✓ MATCH | high | primary-source vs Cornell 17 CFR § 240.21F-17 | Verbatim quote of (a) and (b) |
| 9 (formerly 6) — NDA-reasonable-restraint | — | — | — | **Excluded from bundle. See "Excluded from this bundle" section.** |

**Counts (of 8 seeded):** 5 ✓ MATCH · 3 ⚠ PARTIAL · 0 ✗ MISMATCH

**Decision:** ✓ Bundle production-ready. The Day 4 additions close the SOX/SEC
gap surfaced by Day 3 smoke testing. Three ⚠ PARTIAL entries are recorded
in `_meta.verification_results` with detailed notes for the injection
layer to consume. Reframing engine applied for Entry 4 (EEA civil/criminal);
Entries 5 and 7 carry no reframing because their issues are non-mechanical.

**Verifier signature:** Olumide (olumide@ebenova.net) — verified 2026-05-06 (Day 2 entries 1-5) + 2026-05-06 (Day 4 entries 6-8)

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
WHERE jurisdiction = 'usa_federal' AND doc_type = 'nda'
ORDER BY statute_ref;
```

Run via Supabase SQL editor: https://supabase.com/dashboard/project/snqzmlctnlzkvcssotzx/sql/new
