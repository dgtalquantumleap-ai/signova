// tests/lib/doc-registry-invariants.test.js
//
// Phase 0 stopgap invariants (added 2026-05-12). Locks down the global
// 21,000-token max_tokens cap so future edits can't silently:
//   - lower the default below a usable floor (16,000)
//   - raise the default above the Vercel-300s-timeout-safe ceiling (21,000)
//   - introduce a doc-type with an out-of-range explicit value
//   - let any doc-type's effective cap exceed the Vercel ceiling
//
// Note: the registry JSON key for the doc-type map is `docTypes` (not
// `types`); the brief's example used `types` which doesn't exist in the
// file. The four invariants below are exactly as specified in the brief,
// adapted to the real key name and read via readFileSync to avoid the
// deprecated import-assertion syntax.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const registry = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'lib', 'doc-registry.json'), 'utf8')
)

describe('doc-registry invariants', () => {
  it('default max_tokens is at least 16000', () => {
    expect(registry.defaults.max_tokens).toBeGreaterThanOrEqual(16000)
  })

  it('default max_tokens does not exceed Vercel-safe ceiling', () => {
    // 21000 is the empirically-determined safe cap for the 300s Vercel
    // timeout at Sonnet 4.6 streaming rates.
    expect(registry.defaults.max_tokens).toBeLessThanOrEqual(21000)
  })

  it('all doc types either inherit default or have valid explicit value', () => {
    for (const [, docType] of Object.entries(registry.docTypes)) {
      if (docType.max_tokens === null || docType.max_tokens === undefined) {
        // Inherits default — fine.
        continue
      }
      expect(typeof docType.max_tokens).toBe('number')
      expect(docType.max_tokens).toBeGreaterThanOrEqual(8000)
      expect(docType.max_tokens).toBeLessThanOrEqual(21000)
    }
  })

  it('no doc type silently exceeds the Vercel ceiling', () => {
    for (const [, docType] of Object.entries(registry.docTypes)) {
      const effective = docType.max_tokens ?? registry.defaults.max_tokens
      expect(effective).toBeLessThanOrEqual(21000)
    }
  })
})
