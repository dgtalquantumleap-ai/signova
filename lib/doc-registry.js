// lib/doc-registry.js
//
// Single source of truth for document_type identity, routing, and
// consistency. Consumed by:
//   - lib/doc-completeness.js (validator + orchestrator)
//   - api/generate.js              (consumer endpoint)
//   - api/v1/documents/generate.js (developer API endpoint)
//
// No endpoint-level code may read lib/doc-registry.json directly — it
// must go through the typed accessors here. That keeps the registry's
// internal shape free to evolve without touching handlers.
//
// Invariant — assertRegistryConsistent() runs on module load and throws
// when the registry is structurally broken. Consequences:
//   - In prod serverless, a broken registry fails EVERY cold start. That
//     is the intended signal; bad merges do not silently ship.
//   - In tests, an import of any file that transitively imports this
//     module fails. That is also the intended signal.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY_PATH = join(__dirname, 'doc-registry.json')

function loadRegistryFile() {
  const raw = readFileSync(REGISTRY_PATH, 'utf8')
  return JSON.parse(raw)
}

const REGISTRY = loadRegistryFile()

// ─── Assertions ──────────────────────────────────────────────────────────────

/**
 * Consistency check that MUST hold for the registry to boot.
 *
 * For every docType × jurisdiction_variant:
 *   1. The variant's body_template_id resolves to an existing bodyTemplate.
 *   2. That bodyTemplate's declared_title equals the variant's title.
 *   3. The docType's top-level title matches at least the default variant.
 *   4. Every docType has all required keys.
 *
 * Throws the FIRST structural problem found, with enough detail that a
 * maintainer can locate + fix the offending JSON in one pass. Subsequent
 * issues are discoverable on the next boot after the first is fixed.
 *
 * Exposed as a free function so the parametrized CI test can call it
 * explicitly. Module-load auto-invocation appears below.
 */
export function assertRegistryConsistent(registry = REGISTRY) {
  if (!registry || typeof registry !== 'object') {
    throw new Error('[doc-registry] registry root is missing or not an object')
  }
  const bodyTemplates = registry.bodyTemplates || {}
  const docTypes = registry.docTypes || {}

  if (Object.keys(docTypes).length === 0) {
    throw new Error('[doc-registry] docTypes is empty — at least one entry required')
  }

  const requiredKeys = [
    'id',
    'title',
    'body_template_id',
    'required_clauses',
    'max_tokens',
    'jurisdiction_variants',
    'worker_classification_modes',
  ]

  for (const [docTypeId, entry] of Object.entries(docTypes)) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`[doc-registry] docTypes.${docTypeId} is not an object`)
    }
    for (const k of requiredKeys) {
      if (!(k in entry)) {
        throw new Error(`[doc-registry] docTypes.${docTypeId} is missing required field "${k}"`)
      }
    }
    if (entry.id !== docTypeId) {
      throw new Error(`[doc-registry] docTypes.${docTypeId}.id must equal "${docTypeId}" (got "${entry.id}")`)
    }
    if (!Array.isArray(entry.required_clauses)) {
      throw new Error(`[doc-registry] docTypes.${docTypeId}.required_clauses must be an array`)
    }
    if (!Array.isArray(entry.worker_classification_modes)) {
      throw new Error(`[doc-registry] docTypes.${docTypeId}.worker_classification_modes must be an array`)
    }
    if (!entry.jurisdiction_variants || typeof entry.jurisdiction_variants !== 'object') {
      throw new Error(`[doc-registry] docTypes.${docTypeId}.jurisdiction_variants must be an object`)
    }
    if (!('default' in entry.jurisdiction_variants)) {
      throw new Error(`[doc-registry] docTypes.${docTypeId}.jurisdiction_variants must include a "default" entry`)
    }

    // Per-variant consistency
    for (const [variantKey, variant] of Object.entries(entry.jurisdiction_variants)) {
      if (!variant || typeof variant !== 'object') {
        throw new Error(`[doc-registry] docTypes.${docTypeId}.jurisdiction_variants.${variantKey} is not an object`)
      }
      if (!variant.title || !variant.body_template_id) {
        throw new Error(`[doc-registry] docTypes.${docTypeId}.jurisdiction_variants.${variantKey} must have both "title" and "body_template_id"`)
      }
      const tmpl = bodyTemplates[variant.body_template_id]
      if (!tmpl) {
        throw new Error(
          `[doc-registry] docTypes.${docTypeId}.jurisdiction_variants.${variantKey}.body_template_id="${variant.body_template_id}" does not exist in bodyTemplates`
        )
      }
      if (tmpl.declared_title !== variant.title) {
        throw new Error(
          `[doc-registry] Title mismatch for docTypes.${docTypeId} (${variantKey}): ` +
          `variant.title="${variant.title}" but bodyTemplates.${variant.body_template_id}.declared_title="${tmpl.declared_title}"`
        )
      }
    }

    // Default-variant must match the docType-level title — ensures
    // accessors that skip the variant lookup still get a consistent title.
    const defaultVariant = entry.jurisdiction_variants.default
    if (defaultVariant.title !== entry.title) {
      throw new Error(
        `[doc-registry] docTypes.${docTypeId}.title="${entry.title}" but default variant title="${defaultVariant.title}" — must be equal`
      )
    }
  }
}

// Run the invariant check on module load. See comment at top of file.
assertRegistryConsistent()

// ─── Jurisdiction key normalisation ──────────────────────────────────────────

// Map freeform jurisdiction strings ("Nigeria", "nigeria", "NDPA", "Lagos")
// to registry variant keys. Returns 'default' when no specific variant
// matches — so an uncovered jurisdiction falls back gracefully.
export function resolveJurisdictionKey(jurisdiction) {
  if (!jurisdiction || typeof jurisdiction !== 'string') return 'default'
  const j = jurisdiction.toLowerCase()
  if (j.includes('nigeria') || j.includes('ndpa') || j.includes('lagos')) return 'nigeria'
  // Extend here as variants get added to the registry.
  return 'default'
}

// ─── Accessors ───────────────────────────────────────────────────────────────

export function listDocTypes() {
  return Object.keys(REGISTRY.docTypes || {})
}

export function hasDocType(id) {
  return Boolean(REGISTRY.docTypes && REGISTRY.docTypes[id])
}

export function getDocType(id) {
  return REGISTRY.docTypes?.[id] || null
}

function resolveVariant(id, jurisdiction) {
  const entry = getDocType(id)
  if (!entry) return null
  const key = resolveJurisdictionKey(jurisdiction)
  return entry.jurisdiction_variants[key] || entry.jurisdiction_variants.default || null
}

export function getTitle(id, jurisdiction) {
  const v = resolveVariant(id, jurisdiction)
  return v ? v.title : null
}

export function getBodyTemplateId(id, jurisdiction) {
  const v = resolveVariant(id, jurisdiction)
  return v ? v.body_template_id : null
}

export function getBodyTemplate(id, jurisdiction) {
  const tid = getBodyTemplateId(id, jurisdiction)
  if (!tid) return null
  return REGISTRY.bodyTemplates?.[tid] || null
}

export function getRequiredClauses(id) {
  const entry = getDocType(id)
  return Array.isArray(entry?.required_clauses) ? entry.required_clauses : []
}

export function getMaxTokens(id) {
  const entry = getDocType(id)
  if (entry && typeof entry.max_tokens === 'number') return entry.max_tokens
  return REGISTRY.defaults?.max_tokens ?? 8000
}

export function getForbiddenTitles(id) {
  const entry = getDocType(id)
  return Array.isArray(entry?.forbidden_titles) ? entry.forbidden_titles : []
}

export function getWorkerClassificationModes(id) {
  const entry = getDocType(id)
  return Array.isArray(entry?.worker_classification_modes) ? entry.worker_classification_modes : []
}

/**
 * Phase 5 — accessor for the rule-based classifier configuration. Each
 * rule names a classification mode and the field-summary anchors that
 * trigger it. Consumed by lib/doc-classification.js. Empty array when
 * the doc_type does not participate in classification.
 */
export function getWorkerClassificationRules(id) {
  const entry = getDocType(id)
  return Array.isArray(entry?.worker_classification_rules) ? entry.worker_classification_rules : []
}

/**
 * Phase 5 — per-mode system-prompt instruction block. The orchestrator
 * injects this ahead of clause-assembly so Claude receives one
 * unambiguous routing directive per generation. Returns null when no
 * instruction is registered for the (doc_type, mode) pair.
 */
export function getWorkerClassificationPrompt(id, mode) {
  const entry = getDocType(id)
  const prompts = entry?.worker_classification_prompts
  if (!prompts || typeof prompts !== 'object') return null
  return typeof prompts[mode] === 'string' ? prompts[mode] : null
}

/**
 * Phase 5 — post-generation validator input. Each forbidden-combination
 * declares a set of anchors whose co-occurrence in the body is illegal
 * under the doc_type's controlling law. Registry is authoritative; the
 * validator NEVER hardcodes patterns.
 */
export function getForbiddenCombinations(id) {
  const entry = getDocType(id)
  return Array.isArray(entry?.forbidden_combinations) ? entry.forbidden_combinations : []
}

/**
 * Phase 5 — convenience predicate. True when the doc_type requires the
 * caller to declare a worker_classification (dev API) or have one
 * inferred (consumer).
 */
export function isWorkerClassificationRequired(id) {
  return getWorkerClassificationModes(id).length > 0
}

export function getJurisdictionVariants(id) {
  const entry = getDocType(id)
  return entry?.jurisdiction_variants || {}
}

// Exposed for tests only — not imported by any endpoint.
export function _getRawRegistry() {
  return REGISTRY
}
