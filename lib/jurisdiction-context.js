// lib/jurisdiction-context.js
//
// Shared jurisdiction enum + system-prompt context assembler.
//
// This is the bridge between:
//   - The 18 jurisdictions Scope Guard markets ("18 jurisdictions" claim in
//     api/scope-guard-checkout.js + the launch blog post)
//   - The statute libraries baked into api/generate.js (built across PRs
//     #18-#25) that drive the document-generation product
//
// Until this module landed, Scope Guard accepted a freeform `jurisdiction`
// string but never injected jurisdiction-specific context into its prompts —
// the "18 jurisdictions" claim was unbacked. This module fixes that.
//
// Used by:
//   - api/v1/scope/analyze.js (Pro tier, Claude Sonnet)
//   - api/v1/scope/change-order.js (Pro tier, Claude Sonnet)
//   - api/scope-guard-analyze.js (free tier, Claude Haiku 4.5)
//   - mcp-servers/scope-guard/index.js (passes through to upstream)
//
// Also used by validators.js for Zod enum validation.

// ── Canonical jurisdiction enum ─────────────────────────────────────────────
// Snake-case keys for stable API contracts. Display names are user-visible
// labels for documents and UI.
export const JURISDICTION_KEYS = [
  'nigeria',
  'kenya',
  'ghana',
  'south_africa',
  'uk',
  'usa_federal',
  'usa_california',
  'usa_new_york',
  'usa_texas',
  'usa_florida',
  'canada_federal',
  'canada_ontario',
  'canada_bc',
  'canada_quebec',
  'eu',
  'india',
  'uae',
  'singapore',
]

const JURISDICTION_DISPLAY = {
  nigeria: 'Nigeria',
  kenya: 'Kenya',
  ghana: 'Ghana',
  south_africa: 'South Africa',
  uk: 'United Kingdom (England & Wales)',
  usa_federal: 'United States (federal)',
  usa_california: 'United States — California',
  usa_new_york: 'United States — New York',
  usa_texas: 'United States — Texas',
  usa_florida: 'United States — Florida',
  canada_federal: 'Canada (federal)',
  canada_ontario: 'Canada — Ontario',
  canada_bc: 'Canada — British Columbia',
  canada_quebec: 'Canada — Quebec',
  eu: 'European Union',
  india: 'India',
  uae: 'United Arab Emirates',
  singapore: 'Singapore',
}

// ── Per-jurisdiction context blocks ────────────────────────────────────────
// Each entry returns the system-prompt fragment that scope-guard analysis +
// change-order generation should append BEFORE the generic instructions.
// Kept compact (< 600 tokens each) for the free-tier Haiku path.
//
// Sources match the depth in api/generate.js's clause assembly — every cited
// statute / authority is the same one document generation relies on, so the
// two products stay in sync. When updating either set, mirror the change in
// the corresponding api/generate.js clause.
const CONTEXTS = {
  nigeria: `JURISDICTION CONTEXT — NIGERIA
Governing-law framework: Federal Republic of Nigeria. Apply Nigerian common-law contract principles (Sagay's Nigerian Law of Contract; offer/acceptance/consideration with Nigerian gloss).
Key statutes for breach analysis:
- Companies and Allied Matters Act (CAMA) 2020 — corporate capacity, director duties, share-issuance
- Labour Act (Cap. L1 LFN 2004) — applies to "workers" only (s.91 scope); s.7 written particulars; s.11 minimum termination notice (1 day to 1 month by length of service); managerial / professional staff fall under common-law employment principles, not Labour Act
- Pension Reform Act 2014 + ECA 2010 + NHIA Act 2022 + NHF Act — statutory employer contributions
- Investments and Securities Act (ISA) 2025 — securities, private placement
- Lagos State Tenancy Law 2011 (excluded areas: Apapa / Ikeja GRA / Ikoyi / Victoria Island fall under Recovery of Premises Act Cap. R7 LFN 2004); s.13 statutory notice periods
- Land Use Act 1978 s.22 — Governor's consent for land alienation
- Stamp Duties Act + Finance Act 2019 — instrument duty
- Hire Purchase Act 1965 + FCCPA 2018 — consumer credit
- Federal Competition and Consumer Protection Act (FCCPA) 2018 ss.116, 127 — unfair terms / misleading conduct
- Arbitration and Mediation Act 2023 — repealed ACA 2004; default arbitration framework
- Nigeria Data Protection Act 2023 (NDPA) — data subject rights, 72-hour breach notification (s.41), cross-border transfer (s.43); regulator NDPC
Authorities for breach of contract: Best Children's International School v Adamu Yusuf [2016] LPELR-41152 (SC); Adetoun Oladeji v N.B. Plc [2007] 5 NWLR (Pt.1027) 415 on breach of confidence.
Forum: Federal High Court (corporate/IP/tax); State High Court (general contract); National Industrial Court (employment, exclusive under Constitution s.254C). Arbitration: AMA 2023, Lagos seat.
Currency for damages: Naira (NGN ₦). Use Commonwealth English spelling.`,

  kenya: `JURISDICTION CONTEXT — KENYA
Governing-law framework: Republic of Kenya. English common law via Judicature Act (Cap. 8) + Law of Contract Act (Cap. 23).
Key statutes for breach analysis:
- Employment Act 2007 — s.9 written contract (illiterate-employee jurat); s.10 written particulars within 2 months; s.35 termination notice (daily=close of day, weekly=1wk, bi-weekly=2wk, monthly=28 days); s.36 pay in lieu; s.41 / s.45 / s.49 procedural fairness + remedies (up to 12 months gross salary); s.5 post-termination restraints reasonable only
- Companies Act 2015 (Cap. 486) — share allotment (s.327), pre-emption (s.338)
- Capital Markets Act (Cap. 485A) — securities, private-placement exemption
- Banking Act (Cap. 488) + In Duplum Rule s.44A — interest cannot exceed principal in default
- Movable Property Security Rights Act 2017 + Registry — collateral
- Sale of Goods Act (Cap. 31) — implied terms ss.14-17
- Consumer Protection Act 2012 — unfair practices, 5-day cooling-off
- Competition Act 2010 — restrictive practices, merger control
- Data Protection Act 2019 (Cap. 411C) — ODPC; lawful basis, breach notification
- Land Registration Act 2012 + Land Act 2012 — land transactions; Land Control Act Cap. 302 for agricultural land consents
- WIBA 2007 — work-injury employer strict liability
Authorities: Nordenfelt v Maxim Nordenfelt applied for restraint-of-trade; ELRC + High Court precedent.
Forum: Employment & Labour Relations Court (employment, exclusive ELRC Act 2011 s.12); High Court Nairobi (Commercial); Environment & Land Court (land). Arbitration Act 1995 / NCIA seat.
Currency: KES.`,

  ghana: `JURISDICTION CONTEXT — GHANA
Governing-law framework: Republic of Ghana. Contracts Act 1960 (Act 25) — codified common-law contract doctrine.
Key statutes for breach analysis:
- Labour Act 2003 (Act 651) — s.12 written contract for employment ≥6 months; s.13 written particulars within 2 months (Schedule 1); s.17 termination notice (3+ years = 1 month, <3 years = 2 weeks, weekly = 7 days); s.20 annual leave (15 working days); s.57 maternity (12 weeks paid); s.63 termination; s.65 redundancy; National Labour Commission for unfair termination claims
- Companies Act 2019 (Act 992) — no-par-value shares + stated capital (s.43-50)
- Securities Industry Act 2016 (Act 929) — private placement
- Borrowers and Lenders Act 2020 (Act 1052) — Collateral Registry (28-day registration)
- Banks and Specialised Deposit-Taking Institutions Act 2016 (Act 930)
- Sale of Goods Act 1962 (Act 137) — implied terms
- Hire Purchase Act 1974 (NRCD 292) — consumer-credit protections
- Land Act 2020 (Act 1036) — replaced earlier land statutes; Lands Commission registration
- Stamp Duty Act 2005 (Act 689) — 0.5% ad valorem
- Data Protection Act 2012 (Act 843) — Data Protection Commission
- Rent Act 1963 (Act 220) — controlled tenancies; s.25A 6-month advance-rent cap
Forum: National Labour Commission (employment); High Court Accra Commercial Division; Land Division. ADR Act 2010 (Act 798) / GAAC arbitration.
Currency: GHS.`,

  south_africa: `JURISDICTION CONTEXT — SOUTH AFRICA
Governing-law framework: Republic of South Africa. Roman-Dutch common law (no codified contract statute).
Key statutes for breach analysis:
- Basic Conditions of Employment Act 75 of 1997 (BCEA) — s.29 written particulars at commencement; s.37 notice (1 wk ≤6 mo / 2 wk 6 mo–1 yr / 4 wk 1+ yr); s.20 annual leave (21 days); s.22-23 sick leave (30 days per 36-month cycle); s.25 maternity (4 months unpaid); s.27 family responsibility leave
- Labour Relations Act 66 of 1995 (LRA) — unfair dismissal Chapter VIII; CCMA referral within 30 days
- Employment Equity Act 55 of 1998 — anti-discrimination, affirmative action
- National Minimum Wage Act 9 of 2018 — current rate per hour (verify gazette)
- Companies Act 71 of 2008 — no-par-value shares, CTC; ss.38-41 share issuance; s.95 securities register
- Consumer Protection Act 68 of 2008 — s.14 fixed-term cancellation, ss.48-52 unfair terms, s.16 cooling-off
- National Credit Act 34 of 2005 — affordability assessment, s.103(5) In Duplum, s.121 cooling-off
- POPIA 4 of 2013 — Information Regulator; 8 conditions for lawful processing
- Rental Housing Act 50 of 1999 + Rental Housing Regulations 2001 — interest-bearing deposit, 14-day refund
- PIE Act 19 of 1998 — court order required for eviction (no self-help)
- UIF / SDL / COIDA — payroll levies
Authorities: Magna Alloys v Ellis [1984] 4 SA 874 (A) — restraint of trade prima facie VALID, employee bears burden; Basson v Chilwan [1993] 3 SA 742 (A) reasonableness test; McKinley v BC Tel for just cause.
Forum: CCMA (employment first stop); Labour Court / Labour Appeal Court; High Court Divisions (Gauteng, Western Cape, KZN); Bargaining Council where applicable; AFSA arbitration.
Currency: ZAR.`,

  uk: `JURISDICTION CONTEXT — UNITED KINGDOM (ENGLAND & WALES)
Governing-law framework: laws of England and Wales (use Scotland / NI variants only if explicitly named).
Key statutes for breach analysis:
- Employment Rights Act 1996 (ERA 1996) — s.86 minimum notice (1 wk for 1 mo–2 yr service; +1 wk per year up to 12 wk); s.1 written statement of particulars (must be given on or before first day of employment per amendment); 2-year qualifying period for unfair dismissal claims
- National Minimum Wage Act 1998 + National Living Wage Regulations
- Working Time Regulations 1998 — 48-hour week; 28 days paid annual leave
- Late Payment of Commercial Debts (Interest) Act 1998 — statutory interest at Bank of England base + 8%; £40-£100 fixed compensation per invoice
- Consumer Rights Act 2015 — implied terms (satisfactory quality, fitness, as described, digital content); 14-day cancellation for distance contracts
- Sale of Goods Act 1979 (B2B) + Supply of Goods and Services Act 1982 — implied terms
- Unfair Contract Terms Act 1977 — controls exclusion clauses
- Misrepresentation Act 1967 — innocent / negligent / fraudulent misrep remedies
- Companies Act 2006 — capacity, ss.549-551 allotment, s.561 pre-emption; SH01 filing within 1 month at Companies House
- UK GDPR (retained EU GDPR) + Data Protection Act 2018 — ICO; 72-hour breach notification (Art. 33); data-subject rights (Arts. 15-22)
- FSMA 2000 + UK Prospectus Regulation — securities; private-placement exemption
- Arbitration Act 1996 — modern English arbitration framework; LCIA seat default
Authorities: Hadley v Baxendale damages remoteness; Ruxley v Forsyth measure of damages; Henthorn v Fraser postal-acceptance rule; Williams v Roffey practical-benefit consideration.
Forum: County Court (claims ≤£100k); High Court King's Bench / Chancery / Commercial; Employment Tribunal (employment); Arbitration Act 1996 / LCIA.
Currency: GBP. British English spelling.`,

  usa_federal: `JURISDICTION CONTEXT — UNITED STATES (FEDERAL)
Governing-law framework: federal law + the named US state. Avoid defaulting to California or Delaware unless the user named them.
Key federal statutes:
- Fair Labor Standards Act (FLSA) 29 USC §§201+ — federal minimum wage $7.25/hr; overtime 1.5x for non-exempt over 40 hrs/wk; exemption duties tests
- Family and Medical Leave Act (FMLA) 29 USC §2601+ — 12 weeks unpaid for covered employers (50+ employees)
- Title VII Civil Rights Act 1964 / ADEA / ADA — anti-discrimination
- Federal Arbitration Act 9 USC §§1-16 — arbitration enforceability (pre-empts most state limits)
- Uniform Commercial Code (UCC) Article 2 — sale of goods (state-adopted)
- CAN-SPAM Act + TCPA — commercial communications
- AT-WILL EMPLOYMENT DOCTRINE — applies in every state EXCEPT Montana (Wrongful Discharge from Employment Act 1987 — just cause required after probationary period)
- IRS worker classification — 20-factor test (federal); ABC test in CA / MA / NJ etc.
Forum: federal court (federal-question, diversity, FAA); state court otherwise; EEOC for discrimination claims.
Currency: USD.
Note: state-specific employment / consumer / privacy law often overrides — name the state.`,

  usa_california: `JURISDICTION CONTEXT — UNITED STATES — CALIFORNIA
All federal context above PLUS California-specific:
- Cal. Bus. & Prof. Code §16600 — non-compete clauses are VOID. Do not enforce post-employment non-competes; even non-solicitation restricted to trade-secret protection
- Cal. Labor Code §2802 — employer reimburses all necessary employee expenses
- AB 5 (Cal. Labor Code §2750.3) — ABC Test for independent-contractor classification: free from control + outside usual business + independently established trade
- Meal/rest breaks (Cal. Labor Code §§512, 226.7) — 30-min unpaid meal break for shifts >5 hr; 10-min paid rest per 4 hr; premium pay for missed
- WARN / CalWARN — Cal. Labor Code §§1400-1408 — 60-day notice for plant closing / mass layoff at 75+ employees
- SB 1162 (2023) — pay-transparency in job postings (employers 15+)
- PAGA — Private Attorneys General Act for Labor Code violations (recent reform AB 2288 2024)
- CCPA / CPRA (Cal. Civ. Code §§1798.100-1798.199.100) — consumer rights, sensitive PI, service-provider/contractor restrictions; CPPA + Attorney General
- CLRA (Cal. Civ. Code §§1750+) — consumer-facing terms
Forum: California Superior Court (county-named for venue) or federal Northern/Central/Southern/Eastern District; CA Labor Commissioner for wage claims.`,

  usa_new_york: `JURISDICTION CONTEXT — UNITED STATES — NEW YORK
All federal context above PLUS NY-specific:
- NYLL §191 — frequency of pay: manual workers weekly, clerical / other semi-monthly
- WTPA / NYLL §195(1) — written notice of pay rate, pay date, allowances, employer name/address at hire and on rate change ($50/day damages capped $5,000)
- NYSHRL — broader anti-discrimination than federal Title VII; applies to all employers (any size); includes gender identity, sexual orientation, predisposing genetic characteristics
- NY Pay Transparency (NY Labor Law §194-b, effective Sept 2023) — job postings for positions performed in NY must disclose compensation range
- NY Paid Family Leave — up to 12 weeks paid; employee-funded payroll deduction (~0.45%)
- NY Gen. Bus. Law §899-aa — data-breach notification statute
Forum: NY Supreme Court (state) or SDNY/EDNY (federal); NY Division of Human Rights for NYSHRL.`,

  usa_texas: `JURISDICTION CONTEXT — UNITED STATES — TEXAS
All federal context above PLUS Texas-specific:
- At-will doctrine — broadly applied; few public-policy exceptions (Sabine Pilot narrow)
- Tex. Labor Code §61 (Texas Payday Law) — wages due on next regular pay day; final pay: discharge = within 6 days, voluntary quit = next regular pay date
- Tex. Bus. & Com. Code §15.50 — non-competes ENFORCEABLE if (a) ancillary to otherwise enforceable agreement, (b) reasonable time/geography/scope (Marsh USA v Cook [2011])
- Tex. Bus. & Com. Code §521.053 — data-breach notification statute
- No state minimum wage above federal — defaults to FLSA
- No state-mandated meal/rest breaks
Forum: Texas state district court or federal Northern/Eastern/Southern/Western District; Texas Workforce Commission for unemployment / wage claims.`,

  usa_florida: `JURISDICTION CONTEXT — UNITED STATES — FLORIDA
All federal context above PLUS Florida-specific:
- At-will doctrine — strongly applied; very few exceptions
- Fla. Stat. §542.335 — non-competes ENFORCEABLE if employer demonstrates legitimate business interest AND restraint reasonable (presumed reasonable: ≤6 months for non-customer-relationship cases, ≤2 years for customer-relationship cases) — one of the most employer-friendly non-compete jurisdictions in the US
- Fla. Const. Art. X §24 — minimum wage rising to $15/hr by Sept 2026
- Fla. Stat. §501.171 — data-breach notification statute
- Florida Civil Rights Act 1992 — anti-discrimination mirroring Title VII
- No state-mandated meal/rest breaks; no state requirement for prompt final wages
Forum: Florida circuit court or federal Northern/Middle/Southern District; Florida Commission on Human Relations.`,

  canada_federal: `JURISDICTION CONTEXT — CANADA (FEDERAL)
Governing-law framework: federal law + named province. Most employment is provincially regulated; federally regulated industries (banks, telcos, inter-provincial transport, federal agencies) use the Canada Labour Code (R.S.C. 1985, c. L-2).
Key statutes:
- PIPEDA (Personal Information Protection and Electronic Documents Act) — privacy; OPC; breach reporting per s.10.1
- CASL (Canada Anti-Spam Legislation) — express/implied consent for commercial electronic messages
- Competition Act (federal) — anti-competitive agreements
- CBCA (Canada Business Corporations Act) — corporate; ss.25, 27, 42 solvency test
- Sale of Goods (provincial enactments based on English SGA 1893)
- Income Tax Act — withholding, T4 reporting
- Common-law REASONABLE NOTICE (Bardal v Globe & Mail [1960] OR 1102) — age, length of service, character of employment, availability of similar work; typically ~1 month per year, capped ~24 months; Waksdale [2020] ONCA 391 — non-compliant for-cause clause voids without-cause clause
- McKinley v BC Tel [2001] 2 SCR 161 — high bar for just-cause termination
Forum: provincial Superior Court of Justice / Supreme Court / Court of King's Bench. Use Canadian English spelling (labour, organisation, cheque). CAD currency.`,

  canada_ontario: `JURISDICTION CONTEXT — CANADA — ONTARIO
All federal context above PLUS Ontario-specific:
- Ontario Employment Standards Act 2000 (S.O. 2000, c. 41) — s.57 termination notice (1 wk for 3 mo–1 yr; 2 wk for 1–3 yr; +1 wk per year up to 8 wk); s.64 severance pay where employer payroll ≥$2.5M AND employee 5+ years (1 wk per year, capped 26 wk)
- Ontario Residential Tenancies Act 2006 — Landlord and Tenant Board exclusive jurisdiction for residential
- Ontario Human Rights Code — protected grounds
- Ontario Health Premium (Taxation Act 2007) — payroll deduction
- 9 paid public holidays under ESA
- Min wage ON: $17.20/hr (2024-25, verify gazette)
Forum: Ontario Superior Court of Justice / Small Claims Division; Landlord and Tenant Board (residential); Human Rights Tribunal of Ontario.`,

  canada_bc: `JURISDICTION CONTEXT — CANADA — BRITISH COLUMBIA
All federal context above PLUS BC-specific:
- BC Employment Standards Act (R.S.B.C. 1996, c. 113) — s.63 length-of-service compensation
- Personal Information Protection Act (BC PIPA) — provincial privacy
- BC Residential Tenancy Act (SBC 2002, c. 78) — Residential Tenancy Branch
- Min wage BC: $17.40/hr (2024-25, verify gazette)
- Employer Health Tax (1.95% / 2.925%)
- 10 paid statutory holidays
Forum: BC Supreme Court / Provincial Court (Small Claims Division); RTB for residential tenancy; BC Human Rights Tribunal.`,

  canada_quebec: `JURISDICTION CONTEXT — CANADA — QUEBEC
All federal context above PLUS Quebec-specific (CIVIL LAW jurisdiction, not common law):
- Civil Code of Québec (CCQ) — codified contract law; reference CCQ articles, NOT common-law doctrines
- Charter of the French Language — contracts of adhesion / standard-form B2C contracts must be drawn up in French; French version prevails unless parties expressly choose otherwise in a separate clause
- Quebec Law 25 (Act respecting the protection of personal information in the private sector, as amended) — strict consent, Privacy by Default (s.9.1), PIA for transfers outside Quebec (s.17), data portability (s.27), de-indexing (s.28.1), automated-decision review (s.12.1), confidentiality-incident notification to the CAI (ss.3.5-3.8)
- Act respecting labour standards — termination notice + holiday/leave provisions (Quebec-specific, NOT ESA)
- 8 paid holidays + Fête nationale (24 June)
- Min wage QC: $15.75/hr
- QPIP (Quebec Parental Insurance Plan) — separate from federal EI
Forum: Quebec Superior Court / Court of Quebec; CAI for privacy complaints; Tribunal administratif du travail. Use Canadian French legal terminology where applicable.`,

  eu: `JURISDICTION CONTEXT — EUROPEAN UNION
Governing-law framework: applicable EU regulation + the named Member State's law for matters not harmonised.
Key EU instruments:
- GDPR (Regulation (EU) 2016/679) — data subject rights (Arts. 15-22), 72-hour breach notification (Art. 33), DPO designation (Art. 37), DPIA (Art. 35), international transfers (Arts. 44-49); national supervisory authority + EDPB
- Late Payment Directive (2011/7/EU) — statutory interest at refinancing rate + 8% on commercial debt
- Consumer Rights Directive (2011/83/EU) — 14-day withdrawal for distance contracts
- Unfair Contract Terms Directive (93/13/EEC) — controls B2C unfair terms
- Brussels Ia Regulation (1215/2012) — civil/commercial jurisdiction within EU
- Rome I Regulation (593/2008) — choice of law in contractual obligations
- Digital Services Act (2022/2065) + Digital Markets Act (2022/1925) — platform liability + gatekeeper obligations
Forum: courts of the named EU Member State. Currency: EUR.
Note: name the specific Member State (Germany, France, Netherlands, Spain, etc.) for non-harmonised matters.`,

  india: `JURISDICTION CONTEXT — INDIA
Governing-law framework: laws of India.
Key statutes:
- Indian Contract Act 1872 — codified contract law; offer/acceptance/consideration/free consent/lawful object/capacity
- Specific Relief Act 1963 (as amended 2018) — specific performance now the rule, not the exception, for contracts (post-2018 amendment)
- Sale of Goods Act 1930 — implied terms
- Industrial Disputes Act 1947 — workman dismissal procedure (chapter V-A 50+ employees, V-B 100+ employees); retrenchment compensation
- Industrial Employment (Standing Orders) Act 1946
- Code on Wages 2019 — minimum wage, equal remuneration
- Information Technology Act 2000 + Digital Personal Data Protection Act (DPDP Act) 2023 — data protection, Data Protection Board of India
- Companies Act 2013 — corporate; share capital; CSR (s.135); director duties
- Negotiable Instruments Act 1881 s.138 — cheque dishonour criminal liability
- GST Acts (CGST 2017, IGST 2017, SGST) — indirect tax
- Arbitration and Conciliation Act 1996 (as amended 2015, 2019, 2021) — arbitration framework
Forum: civil court of original jurisdiction (Munsiff / Civil Judge / District Court); High Court of the relevant State; Supreme Court for SLP / appeal. NCLT for corporate matters. Tax tribunals (ITAT, GSTAT). Currency: INR.`,

  uae: `JURISDICTION CONTEXT — UNITED ARAB EMIRATES
Governing-law framework: federal UAE law + Emirate-specific law (Dubai vs Abu Dhabi); plus financial-free-zones (DIFC, ADGM) which apply English-style common law.
Key statutes (federal mainland):
- Federal Decree-Law No. 47 of 2022 (Corporate Tax Law) — 9% corporate tax on profits >AED 375,000 (effective 1 June 2023)
- Federal Decree-Law No. 33 of 2021 (Labour Law) — replaced 1980 Labour Law; written contracts mandatory; limited-term contracts default; end-of-service gratuity; non-compete reasonable in time/scope
- Federal Decree-Law No. 32 of 2021 (Commercial Companies Law) — corporate; 100% foreign ownership now permitted in many activities
- Federal Decree-Law No. 14 of 2023 (Civil Procedure)
- Federal Decree-Law No. 31 of 2021 (Penal Code)
- Federal Decree-Law No. 45 of 2021 (Personal Data Protection Law) — UAE PDPL; UAE Data Office
- VAT Federal Decree-Law No. 8 of 2017 — 5%
DIFC / ADGM: separate civil & commercial regimes (DIFC Contract Law / Employment Law; ADGM Application of English Law Regulations 2015 — direct application of English common law subject to local enactments). Use DIFC / ADGM if user names them.
Forum: federal/local courts of the relevant Emirate; DIFC Courts (Dubai International Financial Centre); ADGM Courts (Abu Dhabi Global Market); DIAC / ADCCAC arbitration. Currency: AED.`,

  singapore: `JURISDICTION CONTEXT — SINGAPORE
Governing-law framework: laws of the Republic of Singapore. English-derived common law, modernised.
Key statutes:
- Employment Act (Cap. 91, 2009 Rev Ed; as amended) — applies to employees earning ≤S$4,500/month basic; written contract / KETs (Key Employment Terms) within 14 days; minimum termination notice; maternity / childcare / shared parental leave per Child Development Co-Savings Act
- Industrial Relations Act (Cap. 136)
- Companies Act (Cap. 50, 2006 Rev Ed)
- Sale of Goods Act 1979 (UK) (incorporated into Singapore law, with SOGA modifications)
- Unfair Contract Terms Act 1977 (UK) (UCTA — adopted with local variations)
- Misrepresentation Act (Cap. 390)
- Personal Data Protection Act 2012 (PDPA) — PDPC; consent obligations; data breach notification (mandatory for >500 affected data subjects or significant harm)
- Goods and Services Tax Act (Cap. 117A) — 9% GST (from 1 Jan 2024)
- Arbitration Act (Cap. 10) for domestic; International Arbitration Act (Cap. 143A) for international (SIAC default seat)
- Companies (Amendment) Act 2017 — small-company audit exemption
Forum: State Courts (≤S$250k); General Division of the High Court; Court of Appeal; SIAC arbitration (Singapore International Arbitration Centre). Currency: SGD.`,
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Build a system-prompt context block for a given jurisdiction key.
 *
 * If the key is missing or unrecognised, returns a Commonwealth common-law
 * baseline that explicitly forbids defaulting to US/California/Delaware law.
 * The fallback is intentional — it is better to be jurisdictionally vague
 * with a "do not US-default" instruction than to silently apply US law.
 *
 * @param {string} [jurisdictionKey] — one of JURISDICTION_KEYS
 * @returns {string} — the prompt-ready context block (no leading/trailing
 *   newlines; caller decides spacing)
 */
export function buildJurisdictionContext(jurisdictionKey) {
  if (jurisdictionKey && CONTEXTS[jurisdictionKey]) {
    return CONTEXTS[jurisdictionKey]
  }
  // Commonwealth fallback — never default to US.
  return `JURISDICTION CONTEXT — COMMONWEALTH COMMON-LAW BASELINE (no specific jurisdiction selected)
Apply Commonwealth common-law contract principles: offer, acceptance, consideration, intention to create legal relations, capacity, legality. Use English-derived doctrines (Hadley v Baxendale damages remoteness; Donoghue v Stevenson tort duty of care; restraint-of-trade per Nordenfelt v Maxim Nordenfelt).
*** DO NOT DEFAULT TO U.S. LAW ***: do not invoke California, Delaware, New York, the UCC, the American Arbitration Association, or any U.S. court unless the user explicitly named one.
For breach analysis, cite general common-law principles (e.g. "the doctrine of fundamental breach", "the implied duty of good faith where recognised") and recommend that the user have the response reviewed by a locally qualified practitioner before sending. For governing-law clauses, fall back to "the laws of the jurisdiction the parties have chosen" and the most senior commercial court of the user's stated jurisdiction.
Currency: use the local currency of the user's stated jurisdiction (or USD if expressly chosen).`
}

/**
 * Resolve a jurisdiction key to a human-readable display name for use in
 * generated documents (governing-law clauses, change-order headers, etc.).
 *
 * @param {string} [jurisdictionKey]
 * @returns {string}
 */
export function jurisdictionDisplayName(jurisdictionKey) {
  return (jurisdictionKey && JURISDICTION_DISPLAY[jurisdictionKey]) || 'the jurisdiction selected by the parties'
}
