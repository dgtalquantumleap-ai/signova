// Phase 6 — schema-drift test.
//
// Catches the class of bug where a field silently disappears from a
// doc_type entry during an unrelated edit (the exact bug that dropped
// forbidden_titles from service-agreement mid-Phase-5).
//
// Contract:
//   1. A baseline fingerprint is committed at tests/fixtures/registry-schema-fingerprint.json.
//      The fingerprint records, per doc_type, which field keys existed
//      at baseline — VALUES are not recorded, only key presence.
//   2. This test regenerates the fingerprint from the current registry
//      and asserts every previously-present field is still present.
//   3. NEW fields are allowed and need no fingerprint update.
//   4. DELETIONS must be explicit — regenerate via
//      `node tests/fixtures/regen-fingerprint.mjs`, review the diff,
//      commit the regeneration alongside the removal.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FINGERPRINT_PATH = join(__dirname, '..', 'fixtures', 'registry-schema-fingerprint.json')
const REGISTRY_PATH = join(__dirname, '..', '..', 'lib', 'doc-registry.json')

const baseline = JSON.parse(readFileSync(FINGERPRINT_PATH, 'utf8'))
const current = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'))

function currentFingerprint() {
  const out = {}
  for (const [id, entry] of Object.entries(current.docTypes)) {
    const topKeys = Object.keys(entry).filter(k => !k.startsWith('_')).sort()
    const variantKeys = {}
    for (const [vk, vv] of Object.entries(entry.jurisdiction_variants || {})) {
      variantKeys[vk] = Object.keys(vv || {}).sort()
    }
    out[id] = { fields: topKeys, jurisdiction_variants: variantKeys }
  }
  return out
}

describe('Phase 6 — schema-drift (tests/fixtures/registry-schema-fingerprint.json)', () => {
  const now = currentFingerprint()

  it('every doc_type in the baseline still exists in the current registry', () => {
    for (const id of Object.keys(baseline.docTypes)) {
      expect(
        current.docTypes[id],
        `doc_type "${id}" existed in the baseline fingerprint but is missing from lib/doc-registry.json. Removing a doc_type is destructive — if intentional, run \`node tests/fixtures/regen-fingerprint.mjs\` and commit the regenerated fingerprint alongside the removal.`
      ).toBeDefined()
    }
  })

  it.each(Object.entries(baseline.docTypes).map(([id, fp]) => ({ id, fp })))(
    '$id retains every top-level field present at baseline',
    ({ id, fp }) => {
      const nowEntry = now[id]
      if (!nowEntry) return // covered by the previous test
      for (const field of fp.fields) {
        expect(
          nowEntry.fields,
          `doc_type "${id}" previously had field "${field}" but it has disappeared from lib/doc-registry.json. This is the same class of bug that dropped forbidden_titles mid-Phase-5. If the removal is intentional, regenerate the fingerprint.`
        ).toContain(field)
      }
    }
  )

  it.each(
    Object.entries(baseline.docTypes).flatMap(([id, fp]) =>
      Object.entries(fp.jurisdiction_variants).map(([variantKey, variantFields]) => ({ id, variantKey, variantFields }))
    )
  )(
    '$id / jurisdiction_variants.$variantKey retains every field present at baseline',
    ({ id, variantKey, variantFields }) => {
      const nowEntry = now[id]
      if (!nowEntry) return
      const nowVariant = nowEntry.jurisdiction_variants[variantKey]
      expect(
        nowVariant,
        `doc_type "${id}" previously had jurisdiction_variants.${variantKey} but it has disappeared. Removing a jurisdiction variant is destructive.`
      ).toBeDefined()
      if (!nowVariant) return
      for (const field of variantFields) {
        expect(
          nowVariant,
          `doc_type "${id}".jurisdiction_variants.${variantKey} previously had field "${field}" but it has disappeared.`
        ).toContain(field)
      }
    }
  )

  it('additions to the registry are allowed (fingerprint acts as a floor, not a ceiling)', () => {
    // Quiet confirmation that this test suite's contract is one-directional:
    // additions do not require a fingerprint regeneration. If the registry
    // grows — new fields, new variants, new doc_types — the baseline still
    // holds and the suite passes.
    expect(Object.keys(now).length).toBeGreaterThanOrEqual(Object.keys(baseline.docTypes).length)
  })
})
