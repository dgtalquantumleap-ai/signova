// lib/doc-classification.js
//
// Phase 5 — deterministic rule-based worker-classification resolver for
// the consumer endpoint, and shared prompt-instruction assembler for
// BOTH endpoints.
//
// Scope:
//   - Consumer path calls inferWorkerClassification(text, docType) to
//     resolve the classification from the already-assembled prompt
//     (no new UI fields, no LLM calls, deterministic rules only).
//   - Dev API path receives worker_classification explicitly from the
//     request; it does not call the classifier.
//   - Both paths call buildClassificationInstruction(docType, mode) to
//     get the system-prompt instruction block to inject before
//     clause-assembly.
//
// Amendment D compliance: this module does not edit or move any legal
// clause text. It reads pre-registered routing instructions from
// lib/doc-registry.json and emits them into the system prompt.

import {
  getWorkerClassificationRules,
  getWorkerClassificationPrompt,
  getWorkerClassificationModes,
} from './doc-registry.js'

export const WORKER_CLASSIFICATION_REQUIRED = 'WORKER_CLASSIFICATION_REQUIRED'
export const WORKER_CLASSIFICATION_AMBIGUOUS = 'WORKER_CLASSIFICATION_AMBIGUOUS'
export const WORKER_CLASSIFICATION_INVALID = 'WORKER_CLASSIFICATION_INVALID'

/**
 * Apply the doc_type's registered classification rules against a prompt
 * or field summary string. Each rule is:
 *   {
 *     mode: string,
 *     require_any_of: string[],   // must match ANY
 *     forbid_any_of:  string[],   // must match NONE
 *   }
 *
 * Return shapes:
 *   { ok: true,   mode, triggering_anchors }
 *   { ok: false,  code: WORKER_CLASSIFICATION_AMBIGUOUS, candidates, matched_triggers }
 *
 * Ambiguity cases:
 *   - Zero rules matched  → ambiguous, candidates = []
 *   - Two or more matched → ambiguous, candidates = modes that matched
 *
 * Deterministic, case-insensitive substring matching only. No LLM calls.
 */
export function inferWorkerClassification(text, docType) {
  const rules = getWorkerClassificationRules(docType)
  if (rules.length === 0) {
    // docType has no rule configuration — caller should skip the
    // classification step entirely. Represented as a synthetic
    // "no modes" outcome to let callers branch on it cleanly.
    return { ok: true, mode: null, triggering_anchors: [], reason: 'doc_type_has_no_classification_rules' }
  }

  const lower = String(text || '').toLowerCase()
  const matches = []

  for (const rule of rules) {
    const requireAnyOf = Array.isArray(rule.require_any_of) ? rule.require_any_of : []
    const forbidAnyOf  = Array.isArray(rule.forbid_any_of)  ? rule.forbid_any_of  : []

    const triggeredBy = requireAnyOf.filter(a => lower.includes(String(a).toLowerCase()))
    const forbiddenHit = forbidAnyOf.find(a => lower.includes(String(a).toLowerCase()))

    if (triggeredBy.length > 0 && !forbiddenHit) {
      matches.push({ mode: rule.mode, triggering_anchors: triggeredBy })
    }
  }

  if (matches.length === 1) {
    return { ok: true, mode: matches[0].mode, triggering_anchors: matches[0].triggering_anchors }
  }

  // Ambiguous: zero or multiple rules matched.
  return {
    ok: false,
    code: WORKER_CLASSIFICATION_AMBIGUOUS,
    candidates: matches.map(m => m.mode),
    matched_triggers: matches,
    reason: matches.length === 0
      ? 'no_classification_rule_matched_the_input'
      : 'multiple_classification_rules_matched_the_input',
  }
}

/**
 * Return the registered prompt instruction block for (docType, mode).
 * Empty string when the doc_type has no classification configuration —
 * means "do not inject a routing instruction", callers should proceed
 * with the generic prompt.
 */
export function buildClassificationInstruction(docType, mode) {
  if (!mode) return ''
  const block = getWorkerClassificationPrompt(docType, mode)
  return typeof block === 'string' ? block : ''
}

/**
 * Validate a caller-supplied worker_classification against the doc_type's
 * registered modes. Used by the dev API before accepting the request.
 * Returns null when valid, or an error descriptor otherwise.
 */
export function validateWorkerClassification(docType, classification) {
  const modes = getWorkerClassificationModes(docType)
  if (modes.length === 0) {
    // doc_type does not participate — classification is irrelevant.
    return classification
      ? { code: WORKER_CLASSIFICATION_INVALID, reason: 'doc_type_does_not_accept_worker_classification', valid_values: [] }
      : null
  }
  if (!classification) {
    return { code: WORKER_CLASSIFICATION_REQUIRED, reason: 'field_missing', valid_values: modes }
  }
  if (!modes.includes(classification)) {
    return { code: WORKER_CLASSIFICATION_INVALID, reason: 'value_not_in_valid_modes', valid_values: modes }
  }
  return null
}
