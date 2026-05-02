// lib/doc-completeness.js
//
// Shared truncation, completeness, and title/body guard for the document
// generation pipeline. Consumed by both api/generate.js (consumer,
// freeform prompt) and api/v1/documents/generate.js (developer API).
//
// Phase 3 — Bug A (truncation):
//   1. Detect truncation / missing-clause output from Anthropic.
//   2. Exactly ONE continuation retry on incomplete responses.
//   3. Fail-close with DOC_INCOMPLETE_AFTER_RETRY + reference ID.
//
// Phase 4 — Bug B (title/body mismatch):
//   4. After completeness passes, scan the body for any `forbidden_titles`
//      registered for the doc_type. If any appear, fail-close with
//      DOC_TITLE_BODY_MISMATCH.
//
// NOT in scope (leave untouched):
//   - Worker-classification conflict (Bug C — Phase 5)
//
// Registry (required_clauses, max_tokens overrides, forbidden_titles,
// titles, body-template mappings) lives in lib/doc-registry.json and is
// accessed ONLY via lib/doc-registry.js typed accessors.

import { randomBytes } from 'node:crypto'
import {
  getRequiredClauses as registryGetRequiredClauses,
  getMaxTokens as registryGetMaxTokens,
  getForbiddenTitles as registryGetForbiddenTitles,
  getForbiddenCombinations as registryGetForbiddenCombinations,
  getTitle as registryGetTitle,
  hasDocType,
} from './doc-registry.js'

export const DOC_INCOMPLETE_AFTER_RETRY = 'DOC_INCOMPLETE_AFTER_RETRY'
export const DOC_TITLE_BODY_MISMATCH = 'DOC_TITLE_BODY_MISMATCH'
export const DOC_FORBIDDEN_COMBINATION = 'DOC_FORBIDDEN_COMBINATION'

// Re-exported under the old names for backward compatibility with any
// pre-Phase-4 callers. Endpoint code migrated in Phase 4 calls the
// registry accessors directly.
export function getRequiredClauses(docType) {
  return registryGetRequiredClauses(docType)
}
export function getMaxTokensForDocType(docType) {
  return registryGetMaxTokens(docType)
}

/**
 * Execution-block detector — searches the LAST 30% of the document for
 * signature-block markers. Scoping to the tail avoids false positives from
 * clause headings that mention "signatures" in the body.
 *
 * Returns true when the execution block is present, false when absent.
 * Patterns checked (any one suffices):
 *   1. "SIGNED by" — labelled party signature block
 *   2. "IN WITNESS WHEREOF" — formal preamble
 *   3. "Witness Name:" or "Witness Signature:" — attesting-witness line
 *   4. 10+ underscores on a line followed by "Date:" within 3 lines —
 *      bare signature underline format used by some jurisdictions
 */
function hasExecutionBlock(text) {
  const str = text || ''
  const tail = str.slice(Math.floor(str.length * 0.7))
  const tailLower = tail.toLowerCase()

  if (
    tailLower.includes('signed by') ||
    tailLower.includes('in witness whereof') ||
    tailLower.includes('witness name:') ||
    tailLower.includes('witness signature:')
  ) return true

  // Multi-line fallback: signature underline then "Date:" within 3 lines
  const lines = tail.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (/_{10,}/.test(lines[i])) {
      const window = lines.slice(i, Math.min(i + 4, lines.length))
      if (window.some(l => /date:/i.test(l))) return true
    }
  }
  return false
}

/**
 * Scan the generated text for required-clause aliases. Returns the list of
 * clause IDs whose aliases were all absent. An empty return value means
 * "all required clauses present".
 *
 * Special handling:
 *   "execution-block" — delegates to hasExecutionBlock() which searches only
 *   the last 30% of the document (signature blocks are always at the end).
 *   All other clauses use full-text case-insensitive substring matching.
 */
export function findMissingClauses(text, docType) {
  const required = getRequiredClauses(docType)
  if (required.length === 0) return []
  const lower = (text || '').toLowerCase()
  return required
    .filter(clause => {
      if (clause.id === 'execution-block') return !hasExecutionBlock(text)
      const aliases = Array.isArray(clause.anyOf) ? clause.anyOf : []
      return !aliases.some(a => lower.includes(String(a).toLowerCase()))
    })
    .map(clause => clause.id)
}

/**
 * Phase 4 — Bug B detector.
 *
 * Returns `{ conflictingTitle, expectedTitle }` when the body contains any
 * phrase from the registered `forbidden_titles` list for this doc_type,
 * `null` when clean.
 *
 * Forbidden titles are registered per doc_type in lib/doc-registry.json.
 * They enumerate legally-distinct document titles that should never appear
 * in this doc's body (e.g. service-agreement forbids "Contract of
 * Employment" because the tax/labour-law consequences of the two
 * classifications are incompatible). See Phase 5 for the classification
 * deductions themselves.
 *
 * This is a routing check — it does NOT edit or rewrite any clause text.
 */
export function findTitleBodyMismatch(text, docType, jurisdiction) {
  const forbidden = registryGetForbiddenTitles(docType)
  if (!Array.isArray(forbidden) || forbidden.length === 0) return null
  const expectedTitle = registryGetTitle(docType, jurisdiction) || null
  const lower = (text || '').toLowerCase()
  for (const bad of forbidden) {
    if (typeof bad === 'string' && bad.length > 0 && lower.includes(bad.toLowerCase())) {
      return { conflictingTitle: bad, expectedTitle }
    }
  }
  return null
}

/**
 * Phase 5 — Bug C detector (output-arm safety net).
 *
 * A forbidden_combination is a named rule naming two or more anchor
 * groups. Each anchor group is an OR-set of regex patterns; the anchor
 * fires if ANY of its patterns match the body. The combination fires
 * when ALL anchors fire simultaneously. That models mutually-exclusive
 * legal framings that must never coexist in one document.
 *
 * Optional field `applies_when_worker_classification_in` narrows the
 * combination to fire ONLY when the in-flight generation was routed
 * through one of the listed classifications. This supports the
 * semantically-asymmetric case where the same textual combination is
 * incoherent under one classification (independent_contractor: s.91
 * shouldn't appear) but correct under another (exempt_worker_s91:
 * s.91 carves out Labour Act protections while PITA / PRA 2014 /
 * ECA 2010 / NHF Act / ITF Act still attach).
 *
 * Patterns live in lib/doc-registry.json, NEVER in code. Each pattern
 * is compiled to a case-insensitive RegExp here at match time; invalid
 * patterns are logged-and-skipped so one typo can't poison the rule.
 *
 * Returns the first combination that fires (with which anchors hit),
 * or null when the body is clean.
 */
export function findForbiddenCombination(text, docType, workerClassification = null) {
  const combos = registryGetForbiddenCombinations(docType)
  if (!Array.isArray(combos) || combos.length === 0) return null
  const body = String(text || '')

  for (const combo of combos) {
    // Classification scope gate — when applies_when_worker_classification_in
    // is populated, skip the combination if the current classification is
    // outside that list. Absent field == combination applies always.
    const scope = combo.applies_when_worker_classification_in
    if (Array.isArray(scope) && scope.length > 0) {
      if (!workerClassification || !scope.includes(workerClassification)) continue
    }

    const anchors = Array.isArray(combo.anchors) ? combo.anchors : []
    if (anchors.length === 0) continue

    const anchorHits = anchors.map(anchor => {
      const patterns = Array.isArray(anchor.patterns) ? anchor.patterns : []
      for (const p of patterns) {
        try {
          const re = new RegExp(p, 'i')
          if (re.test(body)) return { id: anchor.id, matched_pattern: p }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[doc-completeness] Invalid forbidden_combination pattern:', { pattern: p, docType, combo_id: combo.id, err: err.message })
        }
      }
      return null
    })

    const allAnchorsHit = anchorHits.every(h => h !== null)
    if (allAnchorsHit) {
      return {
        combinationId: combo.id,
        description: combo.description || null,
        anchorHits,
      }
    }
  }
  return null
}

/**
 * Is the upstream response truncated or structurally incomplete?
 * Two independent signals:
 *   1. Anthropic stop_reason === 'max_tokens' — the model hit the budget.
 *   2. Required clauses for the resolved doc_type missing from the text.
 */
export function isIncomplete({ text, stopReason, docType }) {
  if (stopReason === 'max_tokens') return { reason: 'max_tokens', missing: findMissingClauses(text, docType) }
  const missing = findMissingClauses(text, docType)
  if (missing.length > 0) return { reason: 'missing_clauses', missing }
  return null
}

/**
 * Build a short reference ID used in error responses + structured logs.
 * Format: ref_<8 lowercase hex chars>. Deliberately unrelated to the
 * document's content hash — reference IDs must be mintable BEFORE generation
 * and survive the failure path even when no text was produced.
 */
export function newReferenceId() {
  return `ref_${randomBytes(4).toString('hex')}`
}

/**
 * Build the continuation prompt. Supplies the partial text + an explicit
 * list of missing clause IDs, and asks the model to produce ONLY the
 * missing tail — concatenatable by the caller.
 *
 * The prompt is new code; it does not alter any of the existing legal
 * clause wording, which per the governing rules may only change with
 * founder approval.
 */
export function buildContinuationPrompt({ originalPrompt, partialText, missingClauseIds }) {
  const ids = Array.isArray(missingClauseIds) && missingClauseIds.length > 0
    ? missingClauseIds.join(', ')
    : '(unknown)'
  return [
    'CONTINUATION REQUEST — the prior response was truncated or incomplete.',
    '',
    'ORIGINAL REQUEST (do not re-answer from scratch):',
    originalPrompt,
    '',
    'PARTIAL OUTPUT ALREADY GENERATED (do not repeat any of this — begin where it stops):',
    '---BEGIN PARTIAL---',
    partialText,
    '---END PARTIAL---',
    '',
    `MISSING CLAUSES (these MUST appear in your output, in document order): ${ids}`,
    '',
    'Requirements for this response:',
    '- Output ONLY the continuation text that completes the document.',
    '- Start with the next sentence, clause, or paragraph AFTER the partial output above — do not duplicate any content from the partial.',
    '- If the partial ended mid-word or mid-numbered-heading, start with the remainder of that word/heading as its first characters.',
    '- Do not add a preamble or acknowledgement.',
    '- End cleanly after the signature block. No disclaimers, footnotes, or suggestions to consult a lawyer.',
  ].join('\n')
}

/**
 * Default Anthropic fetcher. Separated from the orchestrator so tests can
 * inject a mock without monkey-patching global.fetch (though the existing
 * test harness does exactly that; this is additional flexibility).
 *
 * Returns { text, stopReason, raw } — orchestrator-friendly shape.
 */
async function defaultAnthropicFetch({ apiKey, model, systemPrompt, userPrompt, maxTokens, abortSignal }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: abortSignal,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const e = new Error(err?.error?.message || `Anthropic returned ${response.status}`)
    e.status = response.status
    e.anthropic_error = err
    throw e
  }
  const data = await response.json()
  return {
    text: data?.content?.[0]?.text || '',
    stopReason: data?.stop_reason || null,
    raw: data,
  }
}

/**
 * Run the Phase 4 + Phase 5 post-completeness checks in order and
 * return a failure descriptor (or null when everything passes). Shared
 * between the single-attempt path and the post-continuation path so
 * the two branches can't drift.
 *
 *   1. Title/body mismatch  (Phase 4, DOC_TITLE_BODY_MISMATCH)
 *   2. Forbidden combination (Phase 5, DOC_FORBIDDEN_COMBINATION)
 */
function runPostCompletenessChecks({ text, docType, jurisdiction, workerClassification, logger, logCtx, attemptNumber, referenceId }) {
  const mismatch = findTitleBodyMismatch(text, docType, jurisdiction)
  if (mismatch) {
    if (logger?.logError) {
      logger.logError('/doc-completeness', {
        ...logCtx,
        attempt_number: attemptNumber,
        code: DOC_TITLE_BODY_MISMATCH,
        expected_title: mismatch.expectedTitle,
        conflicting_title: mismatch.conflictingTitle,
        message: 'Generated document body declares a different document type than the one requested',
      })
    }
    return {
      ok: false,
      code: DOC_TITLE_BODY_MISMATCH,
      referenceId,
      expectedTitle: mismatch.expectedTitle,
      conflictingTitle: mismatch.conflictingTitle,
    }
  }

  const forbiddenCombo = findForbiddenCombination(text, docType, workerClassification)
  if (forbiddenCombo) {
    if (logger?.logError) {
      logger.logError('/doc-completeness', {
        ...logCtx,
        attempt_number: attemptNumber,
        code: DOC_FORBIDDEN_COMBINATION,
        combination_id: forbiddenCombo.combinationId,
        description: forbiddenCombo.description,
        anchor_hits: forbiddenCombo.anchorHits,
        message: 'Generated document body contains a legally incoherent combination of clauses',
      })
    }
    return {
      ok: false,
      code: DOC_FORBIDDEN_COMBINATION,
      referenceId,
      combinationId: forbiddenCombo.combinationId,
      description: forbiddenCombo.description,
      anchorHits: forbiddenCombo.anchorHits,
    }
  }

  return null
}

/**
 * Orchestrator. Generates a document, validates completeness, and performs
 * at most ONE continuation retry when incomplete. Returns a single shape
 * both success and failure paths can pass straight back to the caller's
 * JSON response.
 *
 * Success:  { ok: true, text, referenceId, firstStopReason, usedContinuation }
 * Failure:  { ok: false, code: DOC_INCOMPLETE_AFTER_RETRY, referenceId, missingClauses }
 *
 * The caller is responsible for:
 *   - Mapping { ok: false } → HTTP 5xx + JSON
 *   - Appending provenance block to `text` on success (where applicable)
 *
 * Logger contract: orchestrator calls logger.logWarn / logger.logError with
 * a structured payload that always includes referenceId, doc_type,
 * jurisdiction, attempt_number, and (on failure) missing_clauses. Tests spy
 * on these to satisfy the reference-ID-in-log assertion.
 */
export async function generateWithCompletenessCheck({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  docType,
  jurisdiction,
  // Phase 5 — caller-resolved worker classification. When supplied, the
  // orchestrator injects the registry-registered routing instruction for
  // (docType, workerClassification) BEFORE the caller's system prompt so
  // Claude receives one unambiguous directive about which clause set to
  // use. When null, no classification routing instruction is injected
  // (used for doc_types whose registry has no classification modes).
  workerClassification = null,
  classificationInstruction = null,
  logger,
  abortSignal,
  // Optional injection for tests — defaults to real Anthropic.
  anthropicFetch = defaultAnthropicFetch,
}) {
  const referenceId = newReferenceId()
  const maxTokens = getMaxTokensForDocType(docType)
  const logCtx = {
    reference_id: referenceId,
    doc_type: docType || null,
    jurisdiction: jurisdiction || null,
    worker_classification: workerClassification || null,
  }

  // Input arm — prepend the classification routing block (if any) ahead
  // of the caller's system prompt. We prepend rather than append so the
  // routing directive appears before the clause-assembly instructions
  // Claude has to follow.
  const effectiveSystemPrompt = classificationInstruction && typeof classificationInstruction === 'string' && classificationInstruction.length > 0
    ? `${classificationInstruction}\n\n${systemPrompt}`
    : systemPrompt

  // Attempt 1.
  const first = await anthropicFetch({ apiKey, model, systemPrompt: effectiveSystemPrompt, userPrompt, maxTokens, abortSignal })
  const incomplete1 = isIncomplete({ text: first.text, stopReason: first.stopReason, docType })

  if (!incomplete1) {
    const failure = runPostCompletenessChecks({
      text: first.text, docType, jurisdiction, workerClassification, logger, logCtx, attemptNumber: 1, referenceId,
    })
    if (failure) return failure
    return {
      ok: true,
      text: first.text,
      referenceId,
      firstStopReason: first.stopReason,
      usedContinuation: false,
    }
  }

  // Log attempt 1 failure — structured, contains reference_id.
  if (logger?.logWarn) {
    logger.logWarn('/doc-completeness', {
      ...logCtx,
      attempt_number: 1,
      reason: incomplete1.reason,
      missing_clauses: incomplete1.missing,
      message: 'Document generation incomplete on first attempt — triggering continuation',
    })
  }

  // Attempt 2 — continuation. Same max_tokens budget; we're only asking
  // for the tail so it should fit comfortably.
  const continuationPrompt = buildContinuationPrompt({
    originalPrompt: userPrompt,
    partialText: first.text,
    missingClauseIds: incomplete1.missing,
  })

  const second = await anthropicFetch({
    apiKey,
    model,
    systemPrompt: effectiveSystemPrompt,
    userPrompt: continuationPrompt,
    maxTokens,
    abortSignal,
  })

  // Concatenate and re-validate against the full text.
  const combined = first.text + '\n\n' + second.text
  const incomplete2 = isIncomplete({ text: combined, stopReason: second.stopReason, docType })

  if (!incomplete2) {
    const failure = runPostCompletenessChecks({
      text: combined, docType, jurisdiction, workerClassification, logger, logCtx, attemptNumber: 2, referenceId,
    })
    if (failure) return failure
    return {
      ok: true,
      text: combined,
      referenceId,
      firstStopReason: first.stopReason,
      usedContinuation: true,
    }
  }

  // Fail-closed. Log + return stable error shape. The caller maps this to
  // HTTP 5xx with the same reference_id, so operators can correlate the
  // user-visible error with the log entry.
  if (logger?.logError) {
    logger.logError('/doc-completeness', {
      ...logCtx,
      attempt_number: 2,
      reason: incomplete2.reason,
      missing_clauses: incomplete2.missing,
      code: DOC_INCOMPLETE_AFTER_RETRY,
      message: 'Document remains incomplete after continuation retry — failing closed',
    })
  }

  return {
    ok: false,
    code: DOC_INCOMPLETE_AFTER_RETRY,
    referenceId,
    missingClauses: incomplete2.missing,
  }
}
