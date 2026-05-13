// lib/statute-bundles.js
//
// Registry of statute queries for each (jurisdiction, doc_type) combination.
// Used to seed the statute_cache and determine what retrieveStatute should
// fetch on cache miss.
//
// Jurisdiction keys use the underscore convention from
// lib/jurisdiction-context.js (usa_federal, canada_ontario, etc.). Delaware
// is bundle-specific (LLC operating agreement support) and not yet present
// in jurisdiction-context.js.
//
// Phase 1 doc types: nda (all), llc_operating_agreement (usa_delaware only),
//   partnership_agreement (canada_*)
//
// Bundle shape: each (jurisdiction, docType) entry is either
//   - a bare Array<{statuteRef, query}> (unverified, default), OR
//   - an object { _meta: {...}, queries: Array<...> } (verified bundle)
//
// Public API:
//   getBundleDefinition(jurisdiction, docType)
//     → Array<{statuteRef, query}> | null   (queries from either shape)
//   getBundleMeta(jurisdiction, docType)
//     → object | null   (the _meta block if present, else null)

const BUNDLES = {
  'nigeria': {
    // Day 2/5A Nigerian NDA work seeded 6 NDPA cache rows
    // (jurisdiction='nigeria', doc_type='nda') OUT-OF-BAND of this bundle
    // file — they live in Supabase but were never registered here. Day 5B
    // (stashed) carries the formal NDA bundle declaration; until that
    // lands, this 'nda' entry stays as a placeholder. See P1 followup:
    // "Audit existing Nigerian NDPA cache vs primary sources" — the
    // out-of-band rows are believed to contain at least one factual
    // mislabel (NDPA-section-32-security-of-processing is actually
    // about Data Protection Officers, not security).
    'nda': [],
    // Phase 2 Stage 1 / pre-Stage-2 — Nigerian Shareholder Agreement
    // statute bundle. 17 statute references (10 CAMA + 7 NDPA) covering
    // the corporate-law foundation a Nigerian shareholder agreement
    // needs: capacity, share capital, allotment, pre-emption, transfer,
    // board composition, special resolutions, financial reporting,
    // execution, plus the NDPA data-protection terms.
    //
    // Section numbers verified against primary/secondary Nigerian
    // sources on 2026-05-13 BEFORE seeding (catches mismatches before
    // Olostep credits are burned and cache entries are written under
    // wrong keys). Verification trail:
    //   CAMA-S20  ✓ Capacity to form/join company
    //                (Bimak Associates + Innerkonsult + Counseal)
    //   CAMA-S102 ✓ Execution of documents (Lehi Attorneys + Harlem)
    //   CAMA-S124 ✓ Allotment of shares — private cos delegable to
    //                directors (Mondaq + Aluko & Oyebode + Stren & Blan)
    //   CAMA-S125 ✓ Return of allotment to CAC (BarristerNG + Punuka)
    //   CAMA-S128 ✓ Pre-emption rights — moved here from S141 which
    //                turned out to be the wrong section
    //                (Pavestones + LinkedIn Femi Matthew analysis)
    //   CAMA-S175 ✓ Transfer of shares — moved here from S151
    //                (CorporateBestie + SRJ Legal)
    //   CAMA-S233 ⚠ Special resolutions / shareholder voting — query
    //                topic-anchored, verify Olostep response post-seed
    //   CAMA-S269 ⚠ Director appointments — query topic-anchored,
    //                verify post-seed; covers private-company board
    //                composition too (s.275 dropped as public-only)
    //   CAMA-S374 ✓ Annual financial statements / audited accounts
    //                publicly displayed (Mondaq Part 2.0)
    //   CAMA-S711 ✓ Court-ordered meetings for schemes of arrangement /
    //                mergers — context for drag-along and exit
    //                provisions (GELIAS newsletter)
    //   NDPA-S24  ✓ Data protection principles incl. minimisation —
    //                moved here from S26 which doesn't carry that
    //                content in NDPA 2023 (CookieYes + Lawpavilion)
    //   NDPA-S25  ✓ Lawful basis for processing (FPF + existing NDA
    //                cache row already confirmed)
    //   NDPA-S34  ⚠ Data subject rights — moved from S37 which is
    //                actually the Constitutional privacy provision,
    //                not the NDPA. NDPA DSRs cluster around s.34;
    //                verify Olostep response post-seed.
    //   NDPA-S39  ✓ Security obligations (technical + organisational
    //                measures) — moved from S30 which is sensitive
    //                personal data (FPF + CookieYes)
    //   NDPA-S40  ✓ Breach notification (existing NDA cache confirmed)
    //   NDPA-S41  ✓ Basis for cross-border transfer (main provision)
    //                — moved from S43 which is the derogations branch
    //                (DataGuidance + ITIF)
    //   NDPA-S65  ✓ Interpretation / definitions — moved from S2 which
    //                isn't where NDPA puts interpretation
    //
    // The two ⚠ entries (CAMA-S233, CAMA-S269) couldn't be locked down
    // from WebSearch alone; their queries are written topic-first so
    // Olostep retrieves on the legal concept, and any section-number
    // mismatch will surface in the post-seed manual verification.
    //
    // _meta is initialised with cache_seeded:false; populated after
    // post-seed verification per the Day 2 methodology.
    'shareholder-agreement': {
      _meta: {
        verified_at: '2026-05-13',
        verified_by: 'olumide@ebenova.net',
        cache_seeded: true,
        verification_methodology: {
          'CAMA-S20':  'secondary-source-consistency-multi (Bimak + Innerkonsult + Counseal); statutory text from refined-query Olostep response',
          'CAMA-S102': 'primary-source-lawglobalhub (statutory text of s.102(1)-(3))',
          'CAMA-S124': 'secondary-source-strenandblan (firm publication consistent with Mondaq + Aluko & Oyebode commentary)',
          'CAMA-S125': 'mixed: 15-day timeline confirmed by CAC service timelines and Aluko & Oyebode; Olostep contaminated response with Indian Companies Act form name (PAS-3)',
          'CAMA-S128': 'secondary-source-multi (Mondaq + LinkedIn Femi Matthew analysis); consistent with api/generate.js comment',
          'CAMA-S175': 'primary-source-lawglobalhub + SRJ Legal commentary',
          'CAMA-S233': 'primary-source-banwoighodalo (firm-published PDF with statutory text)',
          'CAMA-S269': 'primary-source-lawglobalhub spanning s.269/s.271/s.272; one Facebook source dropped from trust ranking',
          'CAMA-S374': 'secondary-source-multi-in-content (Punuka + LawGlobal Hub + Mondaq cited inline)',
          'CAMA-S711': 'primary-source-lawglobalhub (refined query) + BusinessDay secondary',
          'NDPA-S24':  'primary-source-cert.gov.ng (statutory text from the official NDPA PDF)',
          'NDPA-S25':  'secondary-source-consistency (dataprotection.africa + nigeriadataprotection.com); cross-checked against existing nigeria/nda cache row',
          'NDPA-S34':  'primary-source-lawglobalhub',
          'NDPA-S39':  'primary-source-lawglobalhub + LinkedIn analysis',
          'NDPA-S40':  'primary-source-cert.gov.ng + LawGlobal Hub',
          'NDPA-S41':  'primary-source-cert.gov.ng',
          'NDPA-S65':  'primary-source-cert.gov.ng',
        },
        verification_results: {
          'CAMA-S20': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Refined query (after initial empty response) returned 1527 chars covering the s.20 disqualifications: minor (under 18), unsound mind declared by court, undischarged bankrupt. Substance is consistent with multiple Nigerian law-firm publications and CAMA 2020 official Gazette text. No structured sources in Olostep response but content is unambiguous.',
            reframing: null,
          },
          'CAMA-S102': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Near-verbatim quote of s.102(1)-(3) execution-of-deeds provisions: three permitted execution methods (director+secretary; two directors; director with witness attestation). Same legal effect as common-seal execution. LawGlobal Hub source is statutory.',
            reframing: null,
          },
          'CAMA-S124': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Exact match to topic. Power to allot vested in the company; private companies may delegate freely to directors; public companies require both articles authorisation AND shareholder resolution at general meeting specifying max shares, transaction scope, and time-frame. Stren & Blan PDF source is consistent with Aluko & Oyebode and Mondaq commentary cross-checked during pre-seeding.',
            reframing: null,
          },
          'CAMA-S125': {
            verdict: 'partial',
            confidence: 'high',
            notes: 'The 15-day filing window for return of allotment is correct per CAC service timelines and api/generate.js prior research. ISSUE: Olostep response references the form name "PAS-3" — that is the Indian Companies Act form, not the Nigerian one. The correct Nigerian form is the CAC 2A (or CAC 5 historic) Return of Allotment. The Indian "Quicko" source contaminated the response. Inject the 15-day timeline content but strip/replace "PAS-3" before injection.',
            reframing: {
              find: ['PAS-3', 'PAS‑3', 'Form PAS-3', 'PAS-3 form'],
              replace_with: 'CAC 2A (Return of Allotment)',
              note: 'Olostep cross-contaminated this Nigerian s.125 entry with the Indian PAS-3 form. The 15-day timeline and the filing-with-CAC requirement are correct for Nigeria; only the form name needs to be replaced before injection.',
            },
          },
          'CAMA-S128': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Five-part summary of s.128: first-offer to existing shareholders, proportionate allocation by current holding, articles-defined acceptance window (default ~30 days), exceptions for non-cash / employee schemes / rights issues, and consequences for non-compliance (void allotment). Consistent with Mondaq + Femi Matthew LinkedIn analysis and the api/generate.js prior comment that pegged pre-emption at s.128.',
            reframing: null,
          },
          'CAMA-S175': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Four-part summary of s.175 share-transfer mechanics: written instrument of transfer (electronic permitted) signed by transferor + transferee; no further approval unless articles say so; register-of-members entry with prescribed particulars; effectiveness on delivery + register entry. Refusal grounds noted. LawGlobal Hub is the statutory-text source.',
            reframing: null,
          },
          'CAMA-S233': {
            verdict: 'partial',
            confidence: 'high',
            notes: 'Section number is correct AND the 75% special-resolution threshold + 21-day notice are accurate. HOWEVER, the template intent was generic "reserved matters / special-resolution voting thresholds" — s.233 is NARROWER, specifically the merger/amalgamation special-resolution provision. The retrieved content is useful for sec-8 (Reserved Matters) when listing merger/amalgamation as a reserved matter, but it does not provide the generic special-resolution mechanics. The writer should treat the 75% threshold and 21-day notice as the FOUNDATION for reserved-matters drafting, and supplement with general-meeting procedure references where needed. Banwo & Ighodalo PDF is a top-tier Nigerian firm publication.',
            reframing: null,
          },
          'CAMA-S269': {
            verdict: 'partial',
            confidence: 'medium',
            notes: 'Olostep returned content spanning THREE sections under this single cache key: s.269 (definition of director), s.271(1) (minimum directors — 1 for private cos, 3 for public), and s.272 (first directors appointed by subscribers). The cache key is labelled s.269 but the content covers s.269-272. This is useful breadth for the writer (one retrieval gives appointments + composition + minimums) but the section-number labelling is imprecise. Note for Stage 2 writer: when citing in the generated document, cite the specific section relevant to the clause being drafted, not "Section 269" as a catch-all. Facebook source flagged for trust review; LawGlobal Hub primary sources are reliable.',
            reframing: null,
          },
          'CAMA-S374': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Accurate coverage of s.374(6) website-display requirement for public-company audited accounts, plus subsections (1)-(5) accounting records and (7) penalties. Includes useful operational detail (42-day post-AGM timeline, accessibility without login). DATA-QUALITY NOTE: Olostep returned 0 entries in the structured sources_json field; the in-content citations to Punuka, LawGlobal Hub, and Mondaq are correct but live in the text not the structured field. Injection layer will render "(no source URL)" until re-seed; substantively safe.',
            reframing: null,
          },
          'CAMA-S711': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Refined query (after initial empty response) returned 629 chars: court power on application to summon separate meetings of members/creditors of each company affected by a scheme of arrangement, compromise, reconstruction, or merger. LawGlobal Hub primary source + BusinessDay corroboration. Directly relevant to drag-along (sec-6) and exit-event court-ordered meetings (sec-12).',
            reframing: null,
          },
          'NDPA-S24': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Primary source (cert.gov.ng official NDPA PDF). Five processing principles enumerated: lawfulness/fairness/transparency, purpose limitation, data minimisation, retention/storage limitation, accuracy. MINOR GAP: NDPA s.24 actually contains six principles in the official Act (integrity-and-confidentiality and/or accountability are also listed); Olostep returned only five. Writer may need to supplement with the missing principle when drafting sec-10. Not a wrong section — just a partial enumeration.',
            reframing: null,
          },
          'NDPA-S25': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Comprehensive enumeration of the six lawful bases: consent, contractual necessity, legal obligation, legitimate interests, vital interests, public-interest/official-authority. Cross-checked against the existing nigeria/nda cache row (NDPA-section-25-lawful-basis) — substantively consistent. DATA-QUALITY NOTE: Olostep returned 0 entries in the structured sources_json field; two sources cited inline in the content (dataprotection.africa + nigeriadataprotection.com). Substantively safe.',
            reframing: null,
          },
          'NDPA-S34': {
            verdict: 'match',
            confidence: 'high',
            notes: 'LawGlobal Hub statutory text. Enumerates rights of access, rectification, erasure, restriction, and objection. Explicitly notes "the Act does not expressly provide a separate right to data-portability in Section 34" — that level of precision is valuable for the writer (avoids drafting a non-existent right). Confirms the pre-seed correction (S37 → S34) was correct.',
            reframing: null,
          },
          'NDPA-S39': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Technical + organisational measures requirement; security/integrity/confidentiality; protection against unauthorised access/disclosure/alteration/loss; accidental destruction/damage; proportionality to risk; compliance-proof obligation. LawGlobal Hub + LinkedIn (Alayo Q9aye) commentary. Confirms the pre-seed correction (S30 → S39) was correct.',
            reframing: null,
          },
          'NDPA-S40': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Comprehensive breach-notification provisions: 72-hour window to NDPC (s.40(2)); immediate notification to data subjects for high-risk (s.40(3)); content requirements for both (s.40(4)); Commission additional powers (s.40(5)-(6)); record-keeping obligation (s.40(8)). Primary source (cert.gov.ng) + LawGlobal Hub.',
            reframing: null,
          },
          'NDPA-S41': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Section 41(1)-(4) cross-border prohibition + adequacy bases (law, BCRs, SCCs, code of conduct, certification mechanism). Includes s.42 adequacy criteria as bonus adjacency (factors the Commission considers when assessing adequacy). Primary source (cert.gov.ng). Confirms the pre-seed correction (S43 → S41) was correct.',
            reframing: null,
          },
          'NDPA-S65': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Definitions of personal data, data controller, data processor, data subject, automated decision-making, applicable law, binding corporate rules, biometric data. Primary source (cert.gov.ng). Confirms the pre-seed correction (S2 → S65) was correct.',
            reframing: null,
          },
        },
        excluded_from_bundle: [
          {
            statute_ref: 'CAMA-S140',
            reason: 'Section 140 is calls on unpaid shares, not capital alteration. Not load-bearing for typical Signova shareholder agreements (most users allot fully-paid shares). Originally in template; dropped during pre-seeding verification.',
            scoped_for: 'Future iteration if specific customers need calls-on-shares provisions',
          },
          {
            statute_ref: 'CAMA-S275',
            reason: 'Section 275 mandates three independent directors but applies ONLY to public companies. Signova users are typically private companies, so this requirement does not apply. Originally in template; dropped during pre-seeding verification.',
            scoped_for: 'Public-company shareholder-agreement variant if/when added',
          },
        ],
      },
      queries: [
        // ── CAMA 2020 — 10 refs ────────────────────────────────────
        {
          // First query (multi-keyword) returned empty; refined to anchor on
          // the formal section title ("capacity to form a company") with a
          // tighter keyword set. Refined query produced 1527 chars.
          statuteRef: 'CAMA-S20',
          query: 'Section 20 CAMA 2020 Nigeria capacity to form company disqualifications individual restrictions',
        },
        {
          statuteRef: 'CAMA-S102',
          query: 'Nigeria Companies and Allied Matters Act 2020 execution of documents by a company without common seal director secretary witness Section 102',
        },
        {
          statuteRef: 'CAMA-S124',
          query: 'Nigeria Companies and Allied Matters Act 2020 power to allot shares vested in the company delegation to directors private company public company Section 124',
        },
        {
          statuteRef: 'CAMA-S125',
          query: 'Nigeria Companies and Allied Matters Act 2020 return of allotment of shares filing with Corporate Affairs Commission timeline particulars Section 125',
        },
        {
          statuteRef: 'CAMA-S128',
          query: 'Nigeria Companies and Allied Matters Act 2020 pre-emption rights on new share allotment first offer to existing shareholders proportionate Section 128',
        },
        {
          statuteRef: 'CAMA-S175',
          query: 'Nigeria Companies and Allied Matters Act 2020 transfer of shares instrument register of members entry execution Section 175',
        },
        {
          statuteRef: 'CAMA-S233',
          query: 'Nigeria Companies and Allied Matters Act 2020 special resolution general meeting voting threshold three quarters notice Section 233',
        },
        {
          statuteRef: 'CAMA-S269',
          query: 'Nigeria Companies and Allied Matters Act 2020 appointment of directors first directors articles of association minimum number private company Section 269',
        },
        {
          statuteRef: 'CAMA-S374',
          query: 'Nigeria Companies and Allied Matters Act 2020 annual financial statements audited accounts public company website display Section 374',
        },
        {
          // First query returned empty (14s elapsed, 0 chars); refined to use
          // "court power summon separate meetings" — closer to the Act's
          // wording — and produced 629 chars + 2 sources on retry.
          statuteRef: 'CAMA-S711',
          query: 'Section 711 CAMA 2020 Nigeria court power summon separate meetings members compromise arrangement merger scheme',
        },

        // ── NDPA 2023 — 7 refs ─────────────────────────────────────
        {
          statuteRef: 'NDPA-S24',
          query: 'Nigeria Data Protection Act 2023 principles of data processing lawfulness fairness transparency data minimisation accuracy retention Section 24',
        },
        {
          statuteRef: 'NDPA-S25',
          query: 'Nigeria Data Protection Act 2023 lawful basis for processing personal data consent contract legal obligation legitimate interests Section 25',
        },
        {
          statuteRef: 'NDPA-S34',
          query: 'Nigeria Data Protection Act 2023 data subject rights access rectification erasure restriction portability objection Section 34',
        },
        {
          statuteRef: 'NDPA-S39',
          query: 'Nigeria Data Protection Act 2023 security of personal data appropriate technical and organisational measures integrity confidentiality Section 39',
        },
        {
          statuteRef: 'NDPA-S40',
          query: 'Nigeria Data Protection Act 2023 personal data breach notification to Commission and data subject 72 hours timeline Section 40',
        },
        {
          statuteRef: 'NDPA-S41',
          query: 'Nigeria Data Protection Act 2023 cross-border transfer of personal data adequacy decision binding corporate rules standard contractual clauses Section 41',
        },
        {
          statuteRef: 'NDPA-S65',
          query: 'Nigeria Data Protection Act 2023 interpretation definitions personal data data controller data processor data subject Section 65',
        },
      ],
    },
  },
  'usa_federal': {
    'nda': {
      _meta: {
        verified_at: '2026-05-06',
        verified_by: 'olumide@ebenova.net',
        cache_seeded: true,
        verification_methodology: {
          'DTSA-trade-secret-definition': 'primary-source-cornell-LII',
          'DTSA-misappropriation-remedies': 'primary-source-cornell-LII',
          'DTSA-whistleblower-immunity': 'primary-source-cornell-LII',
          'EEA-criminal-penalties': 'primary-source-cornell-LII',
          'NDA-consideration-doctrine': 'secondary-source-consistency',
          'SOX-806-whistleblower': 'primary-source-cornell-LII',
          'SEC-21F-whistleblower': 'primary-source-cornell-LII',
          'SEC-rule-21F-17-impedance': 'primary-source-cornell-LII-eCFR',
        },
        verification_results: {
          'DTSA-trade-secret-definition': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Near-verbatim quote of 18 USC 1839(3) statutory definition.',
          },
          'DTSA-misappropriation-remedies': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Injunction, damages (actual loss + unjust enrichment + reasonable royalty), exemplary damages (2x cap), attorney fees, civil seizure, 3-year SoL, federal jurisdiction — all match § 1836(b)-(d).',
          },
          'DTSA-whistleblower-immunity': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Notice requirement, immunity scope, sample language, and consequence (no exemplary/fees) match § 1833(b). Minor stylistic expansion ("use or disclosure" vs statutory "use") not material.',
          },
          'EEA-criminal-penalties': {
            verdict: 'partial',
            confidence: 'high',
            notes: 'Penalty figures (10-year max, $5M-or-3x organizational fine) match § 1832(a)-(b). Mislabels organizational fine as "civil" — § 1832 is criminal. Day 3 prompt should treat the figures as authoritative but reframe "civil fine" as "criminal fine".',
            reframing: {
              find: ['civil fine', 'civil fines', 'civil penalty', 'civil penalties', 'civil sanction', 'civil sanctions'],
              replace_with: 'criminal fine',
              note: 'Apply find-and-replace before injection. The dollar figures and prison terms are accurate; only the civil/criminal labeling is wrong.',
            },
          },
          'NDA-consideration-doctrine': {
            verdict: 'partial',
            confidence: 'medium',
            notes: 'Hanley source confirms consideration requirement and example types (employment, compensation, access to info). UBG (HTTP 403) and Thomson Reuters (blocked) sources unverifiable via WebFetch — single-source confirmation only. Substance is mainstream US contract law (consideration must exist, need not be equal value); state-by-state nuances not flagged but doctrine itself is uncontroversial.',
            reframing: null,
          },
          'SOX-806-whistleblower': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Day 4 addition. § 1514A coverage (publicly traded companies / class of securities registered under Exchange Act § 12), protected disclosures (§§ 1341/1343/1344/1348 mail/wire/bank/securities fraud + SEC rules + federal fraud-against-shareholders law), 180-day filing deadline, and remedies (reinstatement, back pay, special damages incl. attorney fees) all match Cornell LII § 1514A.',
            reframing: null,
          },
          'SEC-21F-whistleblower': {
            verdict: 'partial',
            confidence: 'high',
            notes: 'Day 4 addition. Award range (10–30%), monetary-sanctions threshold ($1M), confidentiality obligation, and anti-retaliation prohibition all match Cornell LII § 78u-6. **Issue:** cached content cross-cites the anti-retaliation provision as "Rule 21F-17" — the correct citation is § 78u-6(h)(1). Rule 21F-17 is the SEC anti-impedance rule (a related but distinct provision). The substance of the anti-retaliation explanation is correct; only the parenthetical citation is wrong. Day 4 brief explicitly anticipated ⚠ verdicts on SEC entries and accepted "note in metadata" as sufficient resolution. No reframing engine entry because the term spans non-word characters (parentheses) which the current word-boundary regex cannot handle cleanly; if the citation issue propagates into generated NDAs in production, Day 5+ should either refactor the reframing engine or re-seed with a refined query.',
            reframing: null,
          },
          'SEC-rule-21F-17-impedance': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Day 4 addition. Cached content is a near-verbatim quote of 17 CFR § 240.21F-17(a) and (b). Cross-references to § 240.21F-4(b)(4)(i)/(ii) for legal-representation exceptions are preserved.',
            reframing: null,
          },
        },
        excluded_from_bundle: [
          {
            statute_ref: 'NDA-reasonable-restraint',
            reason: 'Multi-state claims (Michigan/Illinois/Georgia/Wisconsin/Iowa/WV/Florida-specific assertions) require per-state queries verified against state primary sources, not a single federal query against secondary sources.',
            scoped_for: 'Phase 1 Day 5+ when state jurisdictions are added to bundles',
          },
        ],
      },
      queries: [
        {
          statuteRef: 'DTSA-trade-secret-definition',
          query: 'United States Defend Trade Secrets Act 18 USC 1839 definition of trade secret',
        },
        {
          statuteRef: 'DTSA-misappropriation-remedies',
          query: 'United States Defend Trade Secrets Act 18 USC 1836 civil remedies for misappropriation',
        },
        {
          statuteRef: 'DTSA-whistleblower-immunity',
          query: 'United States Defend Trade Secrets Act 18 USC 1833 whistleblower immunity notice requirement in NDAs',
        },
        {
          statuteRef: 'EEA-criminal-penalties',
          query: 'United States Economic Espionage Act 18 USC 1832 criminal penalties for trade secret theft',
        },
        {
          statuteRef: 'NDA-consideration-doctrine',
          query: 'United States contract law consideration requirement for non-disclosure agreements',
        },
        {
          statuteRef: 'SOX-806-whistleblower',
          query: 'Sarbanes-Oxley Act 18 USC 1514A whistleblower protection corporate fraud reporting publicly traded companies',
        },
        {
          statuteRef: 'SEC-21F-whistleblower',
          query: 'Securities Exchange Act Section 21F 15 USC 78u-6 SEC whistleblower bounty program protection',
        },
        {
          statuteRef: 'SEC-rule-21F-17-impedance',
          query: 'SEC Rule 21F-17 17 CFR 240.21F-17 anti-impedance rule whistleblower confidentiality clauses',
        },
      ],
    },
  },
  'usa_california': {
    'nda': [],
  },
  // usa_delaware was added to jurisdiction-context.js JURISDICTION_KEYS in
  // Day 4. The nda bundle below holds Delaware Uniform Trade Secrets Act
  // (DUTSA, 6 Del. C. §§ 2001–2009) queries. The llc_operating_agreement
  // bundle remains empty pending future scope.
  'usa_delaware': {
    'nda': {
      _meta: {
        verified_at: '2026-05-06',
        verified_by: 'olumide@ebenova.net',
        cache_seeded: true,
        verification_methodology: {
          'DUTSA-misappropriation': 'primary-source-delaware-code-online',
          'DUTSA-injunctive-relief': 'primary-source-delaware-code-online',
          'DUTSA-damages': 'primary-source-delaware-code-online',
          'DUTSA-attorney-fees': 'primary-source-delaware-code-online',
        },
        verification_results: {
          'DUTSA-misappropriation': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Comprehensive coverage of §§ 2001–2004 in a single entry — both acquisition and disclosure/use prongs of misappropriation, plus the §§ 2002–2004 remedies recap. Substance matches delcode.delaware.gov. Minor data-quality issue: Olostep returned the source URL inside the content text (not in structured sources_json field); injection layer will render "(no source URL)" until re-seed. Substantively safe to inject.',
            reframing: null,
          },
          'DUTSA-injunctive-relief': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Verbatim quote of § 2002(a). Subsections (b) and (c) (affirmative acts; reasonable royalty in lieu of injunction) are not included in this entry but are covered in DUTSA-misappropriation. Coverage gap is minor and not a hallucination.',
            reframing: null,
          },
          'DUTSA-damages': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Verbatim quote of § 2003(b) exemplary-damages provision; subsection (a) summarised correctly. Query intent was the willful-and-malicious aspect, which is fully captured.',
            reframing: null,
          },
          'DUTSA-attorney-fees': {
            verdict: 'match',
            confidence: 'high',
            notes: 'Verbatim quote of § 2004 — bad-faith claim, bad-faith motion to terminate injunction, and willful-and-malicious misappropriation triggers all preserved.',
            reframing: null,
          },
        },
        excluded_from_bundle: [],
      },
      queries: [
        {
          statuteRef: 'DUTSA-misappropriation',
          query: 'Delaware Uniform Trade Secrets Act 6 Del C 2001 misappropriation definition remedies',
        },
        {
          statuteRef: 'DUTSA-injunctive-relief',
          query: 'Delaware Uniform Trade Secrets Act 6 Del C 2002 injunctive relief actual threatened misappropriation',
        },
        {
          statuteRef: 'DUTSA-damages',
          query: 'Delaware Uniform Trade Secrets Act 6 Del C 2003 damages exemplary damages willful malicious',
        },
        {
          statuteRef: 'DUTSA-attorney-fees',
          query: 'Delaware Uniform Trade Secrets Act 6 Del C 2004 attorney fees bad faith willful',
        },
      ],
    },
    'llc_operating_agreement': [],
  },
  'usa_new_york': {
    'nda': [],
  },
  'usa_texas': {
    'nda': [],
  },
  'canada_federal': {
    'nda': [],
    'partnership_agreement': [],
  },
  'canada_ontario': {
    'nda': [],
    'partnership_agreement': [],
  },
}

export function getBundleDefinition(jurisdiction, docType) {
  const bundle = BUNDLES[jurisdiction]?.[docType]
  if (bundle == null) return null
  // Back-compat: support both bare-array (unverified) and {_meta, queries} shapes.
  if (Array.isArray(bundle)) return bundle
  return bundle.queries ?? []
}

export function getBundleMeta(jurisdiction, docType) {
  const bundle = BUNDLES[jurisdiction]?.[docType]
  if (bundle == null || Array.isArray(bundle)) return null
  return bundle._meta ?? null
}

export function listJurisdictions() {
  return Object.keys(BUNDLES)
}

export function listDocTypesForJurisdiction(jurisdiction) {
  return Object.keys(BUNDLES[jurisdiction] ?? {})
}
