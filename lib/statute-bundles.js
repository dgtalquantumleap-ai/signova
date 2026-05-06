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
      ],
    },
  },
  'usa_california': {
    'nda': [],
  },
  // usa_delaware is intentional even though jurisdiction-context.js currently
  // only has usa_florida among US states beyond federal/CA/NY/TX. Delaware is
  // the canonical US jurisdiction for LLC operating agreements, so the bundle
  // tracks it. Day 3 will reconcile by either (a) adding usa_delaware to
  // jurisdiction-context.js or (b) introducing a bundle→context translation.
  'usa_delaware': {
    'nda': [],
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
