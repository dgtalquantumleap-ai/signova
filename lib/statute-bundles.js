// lib/statute-bundles.js
//
// Registry of statute queries for each (jurisdiction, doc_type) combination.
// Used to seed the statute_cache and determine what retrieveStatute should
// fetch on cache miss.
//
// Phase 1 jurisdictions: nigeria, usa-federal, usa-ca, usa-de, usa-ny,
//   usa-tx, canada-federal, canada-on
//
// Phase 1 doc types: nda (all), llc-operating (usa-de only),
//   partnership-agreement (canada-*)
//
// Public API:
//   getBundleDefinition(jurisdiction, docType)
//     → Array<{statuteRef, query}> | null

const BUNDLES = {
  'nigeria': {
    'nda': [
      // Day 2 will populate — example shape:
      // {
      //   statuteRef: 'NDPA-2023-s25',
      //   query: 'Nigeria NDPA 2023 Section 25 lawful basis for processing personal data'
      // },
    ],
  },
  'usa-federal': {
    'nda': [],
  },
  'usa-ca': {
    'nda': [],
  },
  'usa-de': {
    'nda': [],
    'llc-operating': [],
  },
  'usa-ny': {
    'nda': [],
  },
  'usa-tx': {
    'nda': [],
  },
  'canada-federal': {
    'nda': [],
    'partnership-agreement': [],
  },
  'canada-on': {
    'nda': [],
    'partnership-agreement': [],
  },
}

export function getBundleDefinition(jurisdiction, docType) {
  return BUNDLES[jurisdiction]?.[docType] ?? null
}

export function listJurisdictions() {
  return Object.keys(BUNDLES)
}

export function listDocTypesForJurisdiction(jurisdiction) {
  return Object.keys(BUNDLES[jurisdiction] ?? {})
}
