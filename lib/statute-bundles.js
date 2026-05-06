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
    'nda': [],
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
