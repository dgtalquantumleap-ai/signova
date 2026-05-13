// lib/multipass/planner.js
//
// Phase 2 Pass 1 — section planner.
//
// Takes (docType, jurisdiction, inputs) and produces a structured
// section plan: which sections to write, in what order, with what
// dependencies, expected length, and statute references. The plan
// is consumed by the writer pass to schedule per-section Sonnet
// calls.
//
// Stage 1 implements this pass end-to-end with one test-injectable
// Sonnet call. The structured-output pattern follows the existing
// codebase convention used by api/scope-guard-analyze.js:
//   - System prompt instructs Claude to return JSON only (no
//     markdown fences, no commentary).
//   - We strip residual ``` fences defensively before JSON.parse.
//   - On malformed JSON we retry ONCE with an explicit "respond
//     with valid JSON only" reminder appended to the user prompt.
//   - Second failure throws `PlannerError` with the raw response
//     in `details.rawResponse` so callers can log it.
//
// The planner does NOT call into Anthropic directly — it accepts an
// `anthropicFetch` function with the same shape as
// lib/doc-completeness.js's `defaultAnthropicFetch`. Stage 4 will
// wire the real fetcher; Stage 1 unit tests inject mocks.

import { getSectionPlanTemplate } from './section-plans/nigerian-shareholder-agreement.js'

export const PLANNER_ERROR_CODES = Object.freeze({
  UNKNOWN_TEMPLATE: 'PLANNER_UNKNOWN_TEMPLATE',
  MALFORMED_JSON: 'PLANNER_MALFORMED_JSON',
  INVALID_PLAN: 'PLANNER_INVALID_PLAN',
  ANTHROPIC_ERROR: 'PLANNER_ANTHROPIC_ERROR',
})

/**
 * Typed error thrown for every planner failure mode. `code` is one
 * of `PLANNER_ERROR_CODES`. `details` carries diagnostic metadata
 * (raw Sonnet response, validation messages) for logging.
 */
export class PlannerError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [details]
   */
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'PlannerError'
    this.code = code
    this.details = details
  }
}

/**
 * Plan a document by customising the canonical template for the
 * given (docType, jurisdiction, inputs) via one Sonnet call.
 *
 * @param {object} args
 * @param {string} args.docType
 * @param {string} args.jurisdiction
 * @param {object} args.inputs                   — user-supplied variables
 * @param {string} args.apiKey                   — Anthropic key (passed through)
 * @param {string} [args.model]                  — defaults to claude-sonnet-4-6
 * @param {Function} args.anthropicFetch         — same shape as defaultAnthropicFetch
 * @param {AbortSignal} [args.abortSignal]
 * @param {object} [args.logger]                 — { logInfo, logWarn, logError }
 * @returns {Promise<{ sections: object[], metadata: object }>}
 */
export async function planDocument({
  docType,
  jurisdiction,
  inputs,
  apiKey,
  model = 'claude-sonnet-4-6',
  anthropicFetch,
  abortSignal,
  logger,
}) {
  if (typeof anthropicFetch !== 'function') {
    throw new PlannerError(
      PLANNER_ERROR_CODES.ANTHROPIC_ERROR,
      'planDocument requires an anthropicFetch function (test injection or real fetcher)',
    )
  }

  // Load the canonical template. Stage 1 ships only the Nigerian
  // Shareholder Agreement template; unknown (docType, jurisdiction)
  // pairs throw cleanly so the calling orchestrator can fall back to
  // the single-call path without ambiguity.
  const template = getSectionPlanTemplate(docType, jurisdiction)
  if (!template) {
    throw new PlannerError(
      PLANNER_ERROR_CODES.UNKNOWN_TEMPLATE,
      `No section-plan template for docType="${docType}" jurisdiction="${jurisdiction}"`,
      { docType, jurisdiction },
    )
  }

  const systemPrompt = buildPlannerSystemPrompt()
  const initialUserPrompt = buildPlannerUserPrompt({ template, inputs })

  // Attempt 1.
  let raw
  try {
    raw = await anthropicFetch({
      apiKey,
      model,
      systemPrompt,
      userPrompt: initialUserPrompt,
      maxTokens: 4000,
      abortSignal,
    })
  } catch (err) {
    throw new PlannerError(
      PLANNER_ERROR_CODES.ANTHROPIC_ERROR,
      `Anthropic call failed during plan attempt 1: ${err?.message ?? String(err)}`,
      { cause: err },
    )
  }

  let parsed = tryParsePlannerResponse(raw.text)
  if (!parsed.ok) {
    logger?.logWarn?.('/multipass/planner', {
      event: 'planner_json_malformed_attempt_1',
      doc_type: docType,
      jurisdiction,
      parse_error: parsed.error,
    })

    // Attempt 2 — append a JSON-only reminder.
    const retryUserPrompt =
      `${initialUserPrompt}\n\nPlease respond with valid JSON only. ` +
      `Do NOT wrap in markdown fences. Do NOT add commentary before or after the JSON object.`

    let retryRaw
    try {
      retryRaw = await anthropicFetch({
        apiKey,
        model,
        systemPrompt,
        userPrompt: retryUserPrompt,
        maxTokens: 4000,
        abortSignal,
      })
    } catch (err) {
      throw new PlannerError(
        PLANNER_ERROR_CODES.ANTHROPIC_ERROR,
        `Anthropic call failed during plan attempt 2: ${err?.message ?? String(err)}`,
        { cause: err, attempt: 2 },
      )
    }

    const retryParsed = tryParsePlannerResponse(retryRaw.text)
    if (!retryParsed.ok) {
      throw new PlannerError(
        PLANNER_ERROR_CODES.MALFORMED_JSON,
        'Planner Sonnet response was not valid JSON after retry',
        {
          attempt1_raw: raw.text,
          attempt2_raw: retryRaw.text,
          attempt1_parse_error: parsed.error,
          attempt2_parse_error: retryParsed.error,
        },
      )
    }
    parsed = retryParsed
  }

  const plan = parsed.value

  // Validate structure. Throws PlannerError on the first violation
  // with a `details.violations` array for the caller's logs.
  validatePlanStructure(plan, template)

  return plan
}

// ── Prompt construction ───────────────────────────────────────────────────

function buildPlannerSystemPrompt() {
  return [
    'You are the PLANNER step of a multi-pass legal-document generator.',
    'Your only job is to take a canonical section template and customise it',
    'for the specific request, then return a JSON plan that the writer step',
    'will use to draft each section.',
    '',
    'Hard rules:',
    '- Respond with valid JSON only. No markdown fences. No commentary.',
    '- Keep section IDs stable (sec-1, sec-2, ...). Do not invent new IDs.',
    '- You MAY drop a section that is not applicable to this request (e.g.,',
    '  multi-class share sections when only one share class is used).',
    '- You MAY tighten a section description to reflect the actual parties',
    '  and terms — but do NOT add or remove the section\'s statute_refs.',
    '- Numbering must remain sequential after any drops (renumber the',
    '  "number" field, but keep the "id" field unchanged).',
    '- The execution section (final one in the template) must always be',
    '  present and always depend on every other section in the output.',
  ].join('\n')
}

function buildPlannerUserPrompt({ template, inputs }) {
  const inputsBlock = JSON.stringify(inputs ?? {}, null, 2)
  const templateBlock = JSON.stringify(template, null, 2)

  return [
    `Document type: ${template.docType}`,
    `Jurisdiction: ${template.jurisdiction}`,
    '',
    'User inputs:',
    inputsBlock,
    '',
    'Canonical section template:',
    templateBlock,
    '',
    'Produce a JSON object with the exact shape:',
    '{',
    '  "sections": [ /* SectionTemplate-shaped entries, with the same fields */ ],',
    '  "metadata": {',
    '    "dropped_section_ids": [ /* IDs from the canonical template that you removed */ ],',
    '    "customisations": [ /* short notes on what you tightened, e.g. "sec-1: tightened recitals to two-party deal" */ ]',
    '  }',
    '}',
    '',
    'Each section entry must contain: id, number, title, description, dependencies, statute_refs, expected_length, parallelizable.',
    'Numbers must be sequential strings starting at "1". Dependencies must reference IDs that exist in the output.',
    'The execution section must be present and must depend on every other section ID in the output.',
  ].join('\n')
}

// ── Response parsing ──────────────────────────────────────────────────────

/**
 * Attempt to parse Sonnet's response as a planner JSON object.
 * Returns `{ ok: true, value }` on success or `{ ok: false, error }`
 * on failure. Strips defensive markdown fences before parsing (the
 * same defence used in api/scope-guard-analyze.js).
 */
function tryParsePlannerResponse(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { ok: false, error: 'Empty response' }
  }
  const cleaned = text.replace(/```json\s*\n?|\n?```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Top-level JSON is not an object' }
    }
    if (!Array.isArray(parsed.sections)) {
      return { ok: false, error: 'Missing or non-array `sections` field' }
    }
    return { ok: true, value: parsed }
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

// ── Structural validation ─────────────────────────────────────────────────

const REQUIRED_SECTION_FIELDS = [
  'id',
  'number',
  'title',
  'description',
  'dependencies',
  'statute_refs',
  'expected_length',
  'parallelizable',
]

const ALLOWED_EXPECTED_LENGTHS = new Set(['short', 'medium', 'long'])

/**
 * Validate the planner output against four invariants:
 *   (1) Every section has all required fields with correct types.
 *   (2) Section numbering is sequential strings starting at "1".
 *   (3) Dependencies form a valid DAG (no cycles, no dangling refs).
 *   (4) The execution section is present (template's final ID) and
 *       depends on every other section in the output.
 *
 * Throws PlannerError(INVALID_PLAN) on any violation, with a
 * `details.violations` array enumerating each failure.
 */
function validatePlanStructure(plan, template) {
  const violations = []
  const sections = plan.sections

  // ── (1) Required fields + types ─────────────────────────────────
  for (const section of sections) {
    if (!section || typeof section !== 'object') {
      violations.push({ kind: 'shape', message: 'Section entry is not an object' })
      continue
    }
    for (const field of REQUIRED_SECTION_FIELDS) {
      if (!(field in section)) {
        violations.push({
          kind: 'missing_field',
          section_id: section.id ?? null,
          field,
        })
      }
    }
    if (section.dependencies && !Array.isArray(section.dependencies)) {
      violations.push({
        kind: 'type',
        section_id: section.id,
        field: 'dependencies',
        message: 'must be an array',
      })
    }
    if (section.statute_refs && !Array.isArray(section.statute_refs)) {
      violations.push({
        kind: 'type',
        section_id: section.id,
        field: 'statute_refs',
        message: 'must be an array',
      })
    }
    if (section.expected_length && !ALLOWED_EXPECTED_LENGTHS.has(section.expected_length)) {
      violations.push({
        kind: 'enum',
        section_id: section.id,
        field: 'expected_length',
        value: section.expected_length,
        allowed: [...ALLOWED_EXPECTED_LENGTHS],
      })
    }
    if (section.parallelizable !== undefined && typeof section.parallelizable !== 'boolean') {
      violations.push({
        kind: 'type',
        section_id: section.id,
        field: 'parallelizable',
        message: 'must be a boolean',
      })
    }
  }

  // ── (2) Sequential numbering starting at "1" ────────────────────
  for (let i = 0; i < sections.length; i++) {
    const expected = String(i + 1)
    const actual = sections[i]?.number
    if (actual !== expected) {
      violations.push({
        kind: 'numbering',
        index: i,
        section_id: sections[i]?.id ?? null,
        expected,
        actual,
      })
    }
  }

  // ── (3) Dependencies: dangling refs + cycle check ───────────────
  const idSet = new Set(sections.map(s => s.id).filter(Boolean))
  for (const section of sections) {
    if (!Array.isArray(section?.dependencies)) continue
    for (const depId of section.dependencies) {
      if (!idSet.has(depId)) {
        violations.push({
          kind: 'dangling_dependency',
          section_id: section.id,
          missing_dep: depId,
        })
      }
    }
  }

  // Cycle detection via DFS. A back-edge in DFS = cycle.
  const adjacency = new Map(sections.map(s => [s.id, Array.isArray(s.dependencies) ? s.dependencies : []]))
  const VISITED = 2
  const VISITING = 1
  const state = new Map()
  function dfs(nodeId, stack) {
    const s = state.get(nodeId) ?? 0
    if (s === VISITED) return null
    if (s === VISITING) return [...stack, nodeId]
    state.set(nodeId, VISITING)
    for (const dep of adjacency.get(nodeId) ?? []) {
      if (!idSet.has(dep)) continue // dangling already reported above
      const cycle = dfs(dep, [...stack, nodeId])
      if (cycle) return cycle
    }
    state.set(nodeId, VISITED)
    return null
  }
  for (const section of sections) {
    if (state.get(section.id) === VISITED) continue
    const cycle = dfs(section.id, [])
    if (cycle) {
      violations.push({ kind: 'cycle', path: cycle })
      break // one cycle is enough; surface it and stop walking
    }
  }

  // ── (4) Execution section invariant ─────────────────────────────
  const templateExecutionId = template.sections[template.sections.length - 1].id
  const execution = sections.find(s => s.id === templateExecutionId)
  if (!execution) {
    violations.push({
      kind: 'missing_execution',
      expected_id: templateExecutionId,
    })
  } else {
    const otherIds = sections.filter(s => s.id !== templateExecutionId).map(s => s.id)
    const depSet = new Set(Array.isArray(execution.dependencies) ? execution.dependencies : [])
    const missingDeps = otherIds.filter(id => !depSet.has(id))
    if (missingDeps.length > 0) {
      violations.push({
        kind: 'execution_dependencies_incomplete',
        section_id: execution.id,
        missing: missingDeps,
      })
    }
  }

  if (violations.length > 0) {
    throw new PlannerError(
      PLANNER_ERROR_CODES.INVALID_PLAN,
      `Planner output failed structural validation (${violations.length} violation${violations.length === 1 ? '' : 's'})`,
      { violations },
    )
  }
}

// Exported for test harness only. Not part of the public API.
export const __test = {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  tryParsePlannerResponse,
  validatePlanStructure,
}
