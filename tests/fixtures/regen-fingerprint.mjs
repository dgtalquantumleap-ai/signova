// One-shot regeneration helper for tests/fixtures/registry-schema-fingerprint.json.
//
// Run when you INTENTIONALLY remove a previously-present field from a
// doc_type — run this, review the diff, commit the regenerated
// fingerprint alongside the registry change. The schema-drift test
// will pass once both land together.
//
// Usage: node tests/fixtures/regen-fingerprint.mjs
//
// DO NOT add this to npm scripts. Regeneration should be a deliberate,
// reviewable act, not something CI or a pre-commit hook does
// automatically.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY = join(__dirname, '..', '..', 'lib', 'doc-registry.json')
const OUT = join(__dirname, 'registry-schema-fingerprint.json')

const r = JSON.parse(readFileSync(REGISTRY, 'utf8'))
const out = { _note: '', generatedAt: new Date().toISOString().slice(0, 10), docTypes: {} }
out._note = 'Schema-drift fingerprint. Generated from lib/doc-registry.json. Records which optional fields each doc_type had at baseline. tests/lib/schema-drift.test.js fails when a previously-present field disappears. To intentionally remove a field across a doc_type, regenerate this file via: node tests/fixtures/regen-fingerprint.mjs'

for (const [id, entry] of Object.entries(r.docTypes)) {
  const topKeys = Object.keys(entry).filter(k => !k.startsWith('_')).sort()
  const variantKeys = {}
  for (const [vk, vv] of Object.entries(entry.jurisdiction_variants || {})) {
    variantKeys[vk] = Object.keys(vv || {}).sort()
  }
  out.docTypes[id] = { fields: topKeys, jurisdiction_variants: variantKeys }
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`Wrote ${Object.keys(out.docTypes).length} docType fingerprints to ${OUT}`)
