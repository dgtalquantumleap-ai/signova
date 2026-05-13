// tests/lib/multipass/planner.test.js
//
// Phase 2 Stage 1.5 — planner unit tests.
//
// Covers the eight invariants from the Stage 1 brief:
//   1. Throws on unknown doc type
//   2. Throws on unknown jurisdiction
//   3. Returns sections array with valid structure
//   4. Respects user input (2-shareholder vs 4-shareholder produces
//      different recital descriptions)
//   5. Section dependencies form a valid DAG (no cycles)
//   6. Section numbers are sequential
//   7. Sec-18 (execution) depends on all other sections
//   8. Handles Sonnet JSON malformation with retry
//
// The planner is invoked through an injected `anthropicFetch` mock so
// no live Anthropic call is made. Fixtures imitate the JSON shape
// Sonnet returns when prompted by buildPlannerSystemPrompt /
// buildPlannerUserPrompt.

import { describe, it, expect, vi } from 'vitest'
import { planDocument, PlannerError, PLANNER_ERROR_CODES, __test } from '../../../lib/multipass/planner.js'
import { NIGERIAN_SHAREHOLDER_AGREEMENT_TEMPLATE } from '../../../lib/multipass/section-plans/nigerian-shareholder-agreement.js'

// ── Fixtures ────────────────────────────────────────────────────────────

/**
 * Build a fixture plan that mirrors the canonical template (no drops,
 * no customisation). Useful as the baseline "happy path" Sonnet
 * response; specific tests below override individual sections to
 * exercise validation paths.
 */
function buildHappyPathPlan() {
  return {
    sections: NIGERIAN_SHAREHOLDER_AGREEMENT_TEMPLATE.sections.map(s => ({ ...s })),
    metadata: {
      dropped_section_ids: [],
      customisations: [],
    },
  }
}

/** Helper: wrap a JSON object as the `{ text, stopReason, raw }` shape `anthropicFetch` returns. */
function asResponse(jsonValue) {
  return { text: JSON.stringify(jsonValue), stopReason: 'end_turn', raw: {} }
}

/** Helper: wrap a raw string as the same shape (for malformed-JSON tests). */
function asRawResponse(text) {
  return { text, stopReason: 'end_turn', raw: {} }
}

const VALID_INPUTS = {
  parties: [
    { name: 'Olumide Adebayo', role: 'Founder', shareholding: 60 },
    { name: 'Adaeze Okonkwo', role: 'Co-founder', shareholding: 40 },
  ],
  company: { name: 'Signova Africa Limited', rc_number: '7654321' },
  effective_date: '2026-05-12',
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('planner — unknown template (invariant 1 + 2)', () => {
  it('throws PlannerError(UNKNOWN_TEMPLATE) on unknown doc type', async () => {
    const fetch = vi.fn()
    await expect(
      planDocument({
        docType: 'not-a-real-doc-type',
        jurisdiction: 'nigeria',
        inputs: VALID_INPUTS,
        apiKey: 'sk-test',
        anthropicFetch: fetch,
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: PLANNER_ERROR_CODES.UNKNOWN_TEMPLATE,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws PlannerError(UNKNOWN_TEMPLATE) on unknown jurisdiction', async () => {
    const fetch = vi.fn()
    await expect(
      planDocument({
        docType: 'shareholder-agreement',
        jurisdiction: 'atlantis',
        inputs: VALID_INPUTS,
        apiKey: 'sk-test',
        anthropicFetch: fetch,
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: PLANNER_ERROR_CODES.UNKNOWN_TEMPLATE,
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('planner — happy path (invariant 3)', () => {
  it('returns sections array with valid structure when Sonnet returns the canonical plan', async () => {
    const plan = buildHappyPathPlan()
    const fetch = vi.fn().mockResolvedValueOnce(asResponse(plan))

    const result = await planDocument({
      docType: 'shareholder-agreement',
      jurisdiction: 'nigeria',
      inputs: VALID_INPUTS,
      apiKey: 'sk-test',
      anthropicFetch: fetch,
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(Array.isArray(result.sections)).toBe(true)
    expect(result.sections).toHaveLength(18)
    expect(result.metadata).toBeDefined()
    // Every section has the required fields.
    for (const section of result.sections) {
      expect(section).toMatchObject({
        id: expect.any(String),
        number: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        dependencies: expect.any(Array),
        statute_refs: expect.any(Array),
        expected_length: expect.stringMatching(/^(short|medium|long)$/),
        parallelizable: expect.any(Boolean),
      })
    }
  })

  it('passes maxTokens=4000 and the full template to the anthropic fetcher', async () => {
    const plan = buildHappyPathPlan()
    const fetch = vi.fn().mockResolvedValueOnce(asResponse(plan))

    await planDocument({
      docType: 'shareholder-agreement',
      jurisdiction: 'nigeria',
      inputs: VALID_INPUTS,
      apiKey: 'sk-test',
      anthropicFetch: fetch,
    })

    const call = fetch.mock.calls[0][0]
    expect(call.maxTokens).toBe(4000)
    expect(call.apiKey).toBe('sk-test')
    expect(call.model).toBe('claude-sonnet-4-6')
    // Template JSON is embedded in the user prompt.
    expect(call.userPrompt).toContain('"docType": "shareholder-agreement"')
    expect(call.userPrompt).toContain('"jurisdiction": "nigeria"')
    expect(call.userPrompt).toContain('"id": "sec-18"')
  })
})

describe('planner — user-input variation (invariant 4)', () => {
  it('embeds different inputs into the user prompt for 2-shareholder vs 4-shareholder cases', async () => {
    const plan = buildHappyPathPlan()
    const fetch2 = vi.fn().mockResolvedValueOnce(asResponse(plan))
    const fetch4 = vi.fn().mockResolvedValueOnce(asResponse(plan))

    const twoShareholders = {
      parties: [
        { name: 'A', role: 'Founder', shareholding: 60 },
        { name: 'B', role: 'Co-founder', shareholding: 40 },
      ],
    }
    const fourShareholders = {
      parties: [
        { name: 'A', role: 'Founder', shareholding: 30 },
        { name: 'B', role: 'Co-founder', shareholding: 30 },
        { name: 'C', role: 'Investor', shareholding: 25 },
        { name: 'D', role: 'Advisor', shareholding: 15 },
      ],
    }

    await planDocument({
      docType: 'shareholder-agreement',
      jurisdiction: 'nigeria',
      inputs: twoShareholders,
      apiKey: 'sk-test',
      anthropicFetch: fetch2,
    })
    await planDocument({
      docType: 'shareholder-agreement',
      jurisdiction: 'nigeria',
      inputs: fourShareholders,
      apiKey: 'sk-test',
      anthropicFetch: fetch4,
    })

    const userPrompt2 = fetch2.mock.calls[0][0].userPrompt
    const userPrompt4 = fetch4.mock.calls[0][0].userPrompt

    expect(userPrompt2).toContain('"shareholding": 60')
    expect(userPrompt2).toContain('"shareholding": 40')
    expect(userPrompt4).toContain('"Investor"')
    expect(userPrompt4).toContain('"Advisor"')
    expect(userPrompt2).not.toEqual(userPrompt4)
  })
})

describe('planner — structural validation (invariants 5, 6, 7)', () => {
  it('rejects a plan with a dependency cycle (invariant 5)', async () => {
    const plan = buildHappyPathPlan()
    // Introduce a cycle: sec-3 → sec-4 → sec-3
    const sec3 = plan.sections.find(s => s.id === 'sec-3')
    sec3.dependencies = [...sec3.dependencies, 'sec-4']
    const fetch = vi.fn().mockResolvedValueOnce(asResponse(plan))

    await expect(
      planDocument({
        docType: 'shareholder-agreement',
        jurisdiction: 'nigeria',
        inputs: VALID_INPUTS,
        apiKey: 'sk-test',
        anthropicFetch: fetch,
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: PLANNER_ERROR_CODES.INVALID_PLAN,
    })
  })

  it('rejects a plan with a dangling dependency reference (invariant 5)', async () => {
    const plan = buildHappyPathPlan()
    plan.sections.find(s => s.id === 'sec-5').dependencies = ['sec-2', 'sec-999']
    const fetch = vi.fn().mockResolvedValueOnce(asResponse(plan))

    await expect(
      planDocument({
        docType: 'shareholder-agreement',
        jurisdiction: 'nigeria',
        inputs: VALID_INPUTS,
        apiKey: 'sk-test',
        anthropicFetch: fetch,
      }),
    ).rejects.toMatchObject({
      code: PLANNER_ERROR_CODES.INVALID_PLAN,
      details: {
        violations: expect.arrayContaining([
          expect.objectContaining({ kind: 'dangling_dependency', missing_dep: 'sec-999' }),
        ]),
      },
    })
  })

  it('rejects a plan with non-sequential numbering (invariant 6)', async () => {
    const plan = buildHappyPathPlan()
    plan.sections[2].number = '99' // sec-3 has number "3"; tamper with it
    const fetch = vi.fn().mockResolvedValueOnce(asResponse(plan))

    await expect(
      planDocument({
        docType: 'shareholder-agreement',
        jurisdiction: 'nigeria',
        inputs: VALID_INPUTS,
        apiKey: 'sk-test',
        anthropicFetch: fetch,
      }),
    ).rejects.toMatchObject({
      code: PLANNER_ERROR_CODES.INVALID_PLAN,
    })
  })

  it('renumbers sequentially when a section is dropped (invariant 6 — happy variant)', async () => {
    // Build a plan that drops sec-13 (Restrictive Covenants), then
    // renumbers the remaining sections so numbers stay sequential.
    const baseline = buildHappyPathPlan()
    const trimmed = baseline.sections.filter(s => s.id !== 'sec-13')
    // Re-number after the drop.
    trimmed.forEach((s, i) => { s.number = String(i + 1) })
    // sec-18 (execution) had the dropped sec-13 in its dependency list;
    // strip it so the execution invariant holds.
    const execSection = trimmed.find(s => s.id === 'sec-18')
    execSection.dependencies = execSection.dependencies.filter(id => id !== 'sec-13')

    const plan = {
      sections: trimmed,
      metadata: {
        dropped_section_ids: ['sec-13'],
        customisations: ['sec-13 dropped — no restrictive covenants requested'],
      },
    }
    const fetch = vi.fn().mockResolvedValueOnce(asResponse(plan))

    const result = await planDocument({
      docType: 'shareholder-agreement',
      jurisdiction: 'nigeria',
      inputs: VALID_INPUTS,
      apiKey: 'sk-test',
      anthropicFetch: fetch,
    })
    expect(result.sections).toHaveLength(17)
    expect(result.sections.map(s => s.number)).toEqual(
      Array.from({ length: 17 }, (_, i) => String(i + 1)),
    )
    expect(result.metadata.dropped_section_ids).toEqual(['sec-13'])
  })

  it('rejects a plan whose execution section lacks a dependency on a peer (invariant 7)', async () => {
    const plan = buildHappyPathPlan()
    const exec = plan.sections.find(s => s.id === 'sec-18')
    // Drop one of execution's dependencies — sec-10.
    exec.dependencies = exec.dependencies.filter(id => id !== 'sec-10')
    const fetch = vi.fn().mockResolvedValueOnce(asResponse(plan))

    await expect(
      planDocument({
        docType: 'shareholder-agreement',
        jurisdiction: 'nigeria',
        inputs: VALID_INPUTS,
        apiKey: 'sk-test',
        anthropicFetch: fetch,
      }),
    ).rejects.toMatchObject({
      code: PLANNER_ERROR_CODES.INVALID_PLAN,
      details: {
        violations: expect.arrayContaining([
          expect.objectContaining({
            kind: 'execution_dependencies_incomplete',
            section_id: 'sec-18',
            missing: expect.arrayContaining(['sec-10']),
          }),
        ]),
      },
    })
  })

  it('rejects a plan that omits the execution section entirely (invariant 7)', async () => {
    const plan = buildHappyPathPlan()
    plan.sections = plan.sections.filter(s => s.id !== 'sec-18')
    // Renumber so the "sequential numbering" check doesn't fire first.
    plan.sections.forEach((s, i) => { s.number = String(i + 1) })
    const fetch = vi.fn().mockResolvedValueOnce(asResponse(plan))

    await expect(
      planDocument({
        docType: 'shareholder-agreement',
        jurisdiction: 'nigeria',
        inputs: VALID_INPUTS,
        apiKey: 'sk-test',
        anthropicFetch: fetch,
      }),
    ).rejects.toMatchObject({
      code: PLANNER_ERROR_CODES.INVALID_PLAN,
      details: {
        violations: expect.arrayContaining([
          expect.objectContaining({
            kind: 'missing_execution',
            expected_id: 'sec-18',
          }),
        ]),
      },
    })
  })
})

describe('planner — malformed JSON retry (invariant 8)', () => {
  it('retries once when first response is unparseable, succeeds on the retry', async () => {
    const goodPlan = buildHappyPathPlan()
    const fetch = vi.fn()
      .mockResolvedValueOnce(asRawResponse('Sure, here is the plan: { not valid json'))
      .mockResolvedValueOnce(asResponse(goodPlan))

    const result = await planDocument({
      docType: 'shareholder-agreement',
      jurisdiction: 'nigeria',
      inputs: VALID_INPUTS,
      apiKey: 'sk-test',
      anthropicFetch: fetch,
    })

    expect(fetch).toHaveBeenCalledTimes(2)
    // Retry prompt has the JSON-only reminder appended.
    expect(fetch.mock.calls[1][0].userPrompt).toContain('valid JSON only')
    expect(result.sections).toHaveLength(18)
  })

  it('handles markdown-fenced JSON on the first attempt (defensive strip)', async () => {
    const goodPlan = buildHappyPathPlan()
    const fenced = '```json\n' + JSON.stringify(goodPlan) + '\n```'
    const fetch = vi.fn().mockResolvedValueOnce(asRawResponse(fenced))

    const result = await planDocument({
      docType: 'shareholder-agreement',
      jurisdiction: 'nigeria',
      inputs: VALID_INPUTS,
      apiKey: 'sk-test',
      anthropicFetch: fetch,
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.sections).toHaveLength(18)
  })

  it('throws PlannerError(MALFORMED_JSON) when both attempts fail to parse', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(asRawResponse('not json the first time'))
      .mockResolvedValueOnce(asRawResponse('still not json the second time'))

    await expect(
      planDocument({
        docType: 'shareholder-agreement',
        jurisdiction: 'nigeria',
        inputs: VALID_INPUTS,
        apiKey: 'sk-test',
        anthropicFetch: fetch,
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: PLANNER_ERROR_CODES.MALFORMED_JSON,
      details: {
        attempt1_raw: expect.stringContaining('not json the first time'),
        attempt2_raw: expect.stringContaining('still not json the second time'),
      },
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('logs a warning on the first malformed attempt before retrying', async () => {
    const goodPlan = buildHappyPathPlan()
    const logWarn = vi.fn()
    const fetch = vi.fn()
      .mockResolvedValueOnce(asRawResponse('garbage'))
      .mockResolvedValueOnce(asResponse(goodPlan))

    await planDocument({
      docType: 'shareholder-agreement',
      jurisdiction: 'nigeria',
      inputs: VALID_INPUTS,
      apiKey: 'sk-test',
      anthropicFetch: fetch,
      logger: { logWarn },
    })

    expect(logWarn).toHaveBeenCalledWith(
      '/multipass/planner',
      expect.objectContaining({
        event: 'planner_json_malformed_attempt_1',
        doc_type: 'shareholder-agreement',
        jurisdiction: 'nigeria',
      }),
    )
  })
})

describe('planner — anthropicFetch contract', () => {
  it('throws PlannerError(ANTHROPIC_ERROR) when anthropicFetch is missing', async () => {
    await expect(
      planDocument({
        docType: 'shareholder-agreement',
        jurisdiction: 'nigeria',
        inputs: VALID_INPUTS,
        apiKey: 'sk-test',
        // anthropicFetch omitted on purpose
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: PLANNER_ERROR_CODES.ANTHROPIC_ERROR,
    })
  })

  it('wraps anthropicFetch errors as PlannerError(ANTHROPIC_ERROR)', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('upstream 503'))
    await expect(
      planDocument({
        docType: 'shareholder-agreement',
        jurisdiction: 'nigeria',
        inputs: VALID_INPUTS,
        apiKey: 'sk-test',
        anthropicFetch: fetch,
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: PLANNER_ERROR_CODES.ANTHROPIC_ERROR,
      message: expect.stringContaining('upstream 503'),
    })
  })
})

// ── Direct validation-function tests (white-box) ────────────────────────
// These exercise validatePlanStructure on synthetic inputs without
// going through the full planDocument flow. Useful for pinpointing
// failure modes when the higher-level tests above red-flag a regression.

describe('planner — validatePlanStructure white-box', () => {
  it('accepts the canonical template verbatim', () => {
    const plan = buildHappyPathPlan()
    expect(() =>
      __test.validatePlanStructure(plan, NIGERIAN_SHAREHOLDER_AGREEMENT_TEMPLATE),
    ).not.toThrow()
  })

  it('flags missing required fields with a `missing_field` violation', () => {
    const plan = buildHappyPathPlan()
    delete plan.sections[3].statute_refs // sec-4
    expect(() =>
      __test.validatePlanStructure(plan, NIGERIAN_SHAREHOLDER_AGREEMENT_TEMPLATE),
    ).toThrow(PlannerError)
    try {
      __test.validatePlanStructure(plan, NIGERIAN_SHAREHOLDER_AGREEMENT_TEMPLATE)
    } catch (err) {
      expect(err.code).toBe(PLANNER_ERROR_CODES.INVALID_PLAN)
      expect(err.details.violations).toContainEqual(
        expect.objectContaining({ kind: 'missing_field', section_id: 'sec-4', field: 'statute_refs' }),
      )
    }
  })

  it('flags an out-of-range expected_length value', () => {
    const plan = buildHappyPathPlan()
    plan.sections[0].expected_length = 'epic'
    try {
      __test.validatePlanStructure(plan, NIGERIAN_SHAREHOLDER_AGREEMENT_TEMPLATE)
      throw new Error('expected validatePlanStructure to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(PlannerError)
      expect(err.code).toBe(PLANNER_ERROR_CODES.INVALID_PLAN)
      expect(err.details.violations).toContainEqual(
        expect.objectContaining({
          kind: 'enum',
          section_id: 'sec-1',
          field: 'expected_length',
          value: 'epic',
        }),
      )
    }
  })
})
