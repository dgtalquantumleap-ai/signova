// Registry consistency tests.
//
// Two concerns:
//   1. The canonical registry loaded from lib/doc-registry.json must be
//      structurally consistent (assertRegistryConsistent must not throw).
//      This mirrors the startup assertion the server runs on boot.
//   2. A parametrized sweep asserts every (doc_type × jurisdiction_variant)
//      pair explicitly so a bad merge fails CI with a precise message
//      rather than a vague module-load crash.

import { describe, it, expect } from 'vitest'
import {
  assertRegistryConsistent,
  listDocTypes,
  getDocType,
  getTitle,
  getBodyTemplateId,
  getBodyTemplate,
  getRequiredClauses,
  getMaxTokens,
  getWorkerClassificationModes,
  getForbiddenTitles,
  getJurisdictionVariants,
  hasDocType,
  _getRawRegistry,
  getWorkerClassificationRules,
  getWorkerClassificationPrompt,
  getForbiddenCombinations,
  isWorkerClassificationRequired,
} from '../../lib/doc-registry.js'

describe('lib/doc-registry.json — canonical registry', () => {
  it('assertRegistryConsistent() passes on the canonical registry (same check run at module load)', () => {
    expect(() => assertRegistryConsistent()).not.toThrow()
  })

  it('listDocTypes() returns a non-empty list', () => {
    expect(listDocTypes().length).toBeGreaterThan(0)
  })

  it('every doc_type has the seven required fields (id, title, body_template_id, required_clauses, max_tokens, jurisdiction_variants, worker_classification_modes)', () => {
    for (const id of listDocTypes()) {
      const entry = getDocType(id)
      expect(entry, `registry entry for ${id} must exist`).toBeTruthy()
      expect(entry.id, `docTypes.${id}.id must equal the key`).toBe(id)
      expect(typeof entry.title, `docTypes.${id}.title must be a string`).toBe('string')
      expect(typeof entry.body_template_id, `docTypes.${id}.body_template_id must be a string`).toBe('string')
      expect(Array.isArray(entry.required_clauses), `docTypes.${id}.required_clauses must be an array`).toBe(true)
      expect('max_tokens' in entry, `docTypes.${id}.max_tokens must be present (null is allowed)`).toBe(true)
      expect(typeof entry.jurisdiction_variants, `docTypes.${id}.jurisdiction_variants must be an object`).toBe('object')
      expect(Array.isArray(entry.worker_classification_modes), `docTypes.${id}.worker_classification_modes must be an array`).toBe(true)
    }
  })
})

describe('lib/doc-registry.json — (doc_type × jurisdiction_variant) sweep', () => {
  const rows = []
  for (const id of listDocTypes()) {
    const variants = getJurisdictionVariants(id)
    for (const [variantKey] of Object.entries(variants)) {
      rows.push({ id, variantKey })
    }
  }

  it.each(rows)('$id × $variantKey — body_template_id exists and declared_title matches variant title', ({ id, variantKey }) => {
    const variants = getJurisdictionVariants(id)
    const variant = variants[variantKey]
    expect(variant, `variant ${variantKey} on ${id} must be an object`).toBeTruthy()
    expect(typeof variant.title).toBe('string')
    expect(typeof variant.body_template_id).toBe('string')

    const tmpl = _getRawRegistry().bodyTemplates?.[variant.body_template_id]
    expect(tmpl, `body_template_id "${variant.body_template_id}" referenced by ${id}/${variantKey} must exist in bodyTemplates`).toBeTruthy()
    expect(
      tmpl.declared_title,
      `bodyTemplates.${variant.body_template_id}.declared_title ("${tmpl.declared_title}") must equal ${id}/${variantKey}.title ("${variant.title}")`
    ).toBe(variant.title)
  })

  it('every doc_type has a "default" jurisdiction variant', () => {
    for (const id of listDocTypes()) {
      const variants = getJurisdictionVariants(id)
      expect(variants.default, `docTypes.${id} must have a "default" variant`).toBeTruthy()
    }
  })

  it('default variant title equals the docType-level title for every doc_type', () => {
    for (const id of listDocTypes()) {
      const entry = getDocType(id)
      const defaultVariant = entry.jurisdiction_variants.default
      expect(
        defaultVariant.title,
        `default variant title for ${id} must equal the top-level title "${entry.title}"`
      ).toBe(entry.title)
    }
  })
})

describe('lib/doc-registry.js — accessor behaviour', () => {
  it('hasDocType returns true for a known id and false for an unknown one', () => {
    expect(hasDocType('service-agreement')).toBe(true)
    expect(hasDocType('totally-fake-doc-type')).toBe(false)
  })

  it('getTitle / getBodyTemplateId / getBodyTemplate respect jurisdiction variant resolution', () => {
    // Nigeria variant on service-agreement routes to the NG-specific body template.
    expect(getTitle('service-agreement', 'Nigeria')).toBe('Service Agreement')
    expect(getBodyTemplateId('service-agreement', 'Nigeria')).toBe('service_agreement_ng_v1')
    const tmpl = getBodyTemplate('service-agreement', 'Nigeria')
    expect(tmpl?.declared_title).toBe('Service Agreement')
    // Unknown jurisdiction → default variant.
    expect(getBodyTemplateId('service-agreement', 'Atlantis')).toBe('service_agreement_v1')
  })

  it('getMaxTokens respects per-doctype override and falls back to default', () => {
    expect(getMaxTokens('service-agreement')).toBe(16000)
    // A doc type with max_tokens: null → falls back to defaults.max_tokens (8000)
    expect(getMaxTokens('privacy-policy')).toBe(8000)
  })

  it('getForbiddenTitles and getWorkerClassificationModes return arrays (empty when unset)', () => {
    expect(Array.isArray(getForbiddenTitles('service-agreement'))).toBe(true)
    expect(getForbiddenTitles('service-agreement')).toContain('Contract of Employment')
    expect(Array.isArray(getWorkerClassificationModes('service-agreement'))).toBe(true)
    expect(Array.isArray(getForbiddenTitles('purchase-agreement'))).toBe(true)
    expect(getForbiddenTitles('totally-fake-doc-type')).toEqual([])
  })

  it('getRequiredClauses returns the configured array for service-agreement (populated) and empty for unpopulated types', () => {
    const sa = getRequiredClauses('service-agreement')
    expect(sa.length).toBeGreaterThan(0)
    expect(sa.find(c => c.id === 'termination')).toBeTruthy()
    expect(getRequiredClauses('purchase-agreement')).toEqual([])
  })

  // ─── Phase 5 accessors ─────────────────────────────────────────────────

  it('isWorkerClassificationRequired reflects whether the doc_type has registered modes', () => {
    expect(isWorkerClassificationRequired('service-agreement')).toBe(true)
    expect(isWorkerClassificationRequired('employment-offer-letter')).toBe(true)
    expect(isWorkerClassificationRequired('purchase-agreement')).toBe(false)
  })

  it('getWorkerClassificationRules returns the populated rule set for service-agreement', () => {
    const rules = getWorkerClassificationRules('service-agreement')
    expect(Array.isArray(rules)).toBe(true)
    expect(rules.length).toBeGreaterThan(0)
    const independent = rules.find(r => r.mode === 'independent_contractor')
    expect(independent, 'independent_contractor rule must exist').toBeTruthy()
    expect(Array.isArray(independent.require_any_of)).toBe(true)
    expect(Array.isArray(independent.forbid_any_of)).toBe(true)
  })

  it('getWorkerClassificationPrompt returns the registered instruction block per mode', () => {
    const ic = getWorkerClassificationPrompt('service-agreement', 'independent_contractor')
    expect(typeof ic).toBe('string')
    expect(ic).toMatch(/INDEPENDENT CONTRACTOR/i)
    const exempt = getWorkerClassificationPrompt('service-agreement', 'exempt_worker_s91')
    expect(typeof exempt).toBe('string')
    expect(exempt).toMatch(/s\.91/i)
    // Unknown mode → null
    expect(getWorkerClassificationPrompt('service-agreement', 'no_such_mode')).toBeNull()
  })

  it('getForbiddenCombinations returns the registered combinations for service-agreement', () => {
    const combos = getForbiddenCombinations('service-agreement')
    expect(Array.isArray(combos)).toBe(true)
    expect(combos.length).toBeGreaterThan(0)
    const s91 = combos.find(c => c.id === 's91_with_paye_stack')
    expect(s91, 'expected s91_with_paye_stack combination').toBeTruthy()
    expect(Array.isArray(s91.anchors)).toBe(true)
    expect(s91.anchors.length).toBeGreaterThanOrEqual(2)
  })
})

describe('lib/doc-registry.js — assertRegistryConsistent on synthetic broken inputs', () => {
  it('throws when body_template_id references an unknown bodyTemplate', () => {
    const broken = {
      defaults: { max_tokens: 8000 },
      bodyTemplates: {},
      docTypes: {
        foo: {
          id: 'foo',
          title: 'Foo',
          body_template_id: 'foo_v1',
          required_clauses: [],
          max_tokens: null,
          jurisdiction_variants: {
            default: { title: 'Foo', body_template_id: 'this_does_not_exist' },
          },
          worker_classification_modes: [],
        },
      },
    }
    expect(() => assertRegistryConsistent(broken)).toThrow(/body_template_id="this_does_not_exist"/)
  })

  it('throws when variant title does not match bodyTemplate.declared_title', () => {
    const broken = {
      defaults: { max_tokens: 8000 },
      bodyTemplates: {
        foo_v1: { declared_title: 'Foo' },
        bar_v1: { declared_title: 'Bar' },
      },
      docTypes: {
        foo: {
          id: 'foo',
          title: 'Foo',
          body_template_id: 'foo_v1',
          required_clauses: [],
          max_tokens: null,
          jurisdiction_variants: {
            default: { title: 'Foo', body_template_id: 'foo_v1' },
            // Intentional cross-wire — title says Foo, but body template's declared_title is Bar.
            custom: { title: 'Foo', body_template_id: 'bar_v1' },
          },
          worker_classification_modes: [],
        },
      },
    }
    expect(() => assertRegistryConsistent(broken)).toThrow(/Title mismatch/)
  })

  it('throws when a doc_type is missing a required field', () => {
    const broken = {
      defaults: { max_tokens: 8000 },
      bodyTemplates: { foo_v1: { declared_title: 'Foo' } },
      docTypes: {
        foo: {
          id: 'foo',
          title: 'Foo',
          body_template_id: 'foo_v1',
          // required_clauses intentionally missing
          max_tokens: null,
          jurisdiction_variants: { default: { title: 'Foo', body_template_id: 'foo_v1' } },
          worker_classification_modes: [],
        },
      },
    }
    expect(() => assertRegistryConsistent(broken)).toThrow(/required_clauses/)
  })

  it('throws when a doc_type has no default jurisdiction variant', () => {
    const broken = {
      defaults: { max_tokens: 8000 },
      bodyTemplates: { foo_v1: { declared_title: 'Foo' } },
      docTypes: {
        foo: {
          id: 'foo',
          title: 'Foo',
          body_template_id: 'foo_v1',
          required_clauses: [],
          max_tokens: null,
          jurisdiction_variants: { nigeria: { title: 'Foo', body_template_id: 'foo_v1' } },
          worker_classification_modes: [],
        },
      },
    }
    expect(() => assertRegistryConsistent(broken)).toThrow(/must include a "default" entry/)
  })
})
