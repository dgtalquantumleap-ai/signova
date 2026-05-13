// lib/multipass/index.js
//
// Phase 2 multi-pass generation entry point. Splits document generation
// into a planner pass, N parallel writer passes, an assembler pass, and
// an optional polisher pass — each call small enough that a single
// Vercel function (300s ceiling) can carry the whole pipeline.
//
// The single-call path through `generateWithCompletenessCheck`
// (lib/doc-completeness.js) is the production default for every doc
// type. Multi-pass is OFF by default and gated behind the
// MULTIPASS_ENABLED + MULTIPASS_DOC_TYPES feature flags wired in
// Stage 4 of the Phase 2 pilot. Stage 1 ships only the planner and
// section template; nothing here is reachable from production yet.
//
// Public API (target shape — implementations land across Stages 1-3):
//   generateDocumentMultipass({ docType, jurisdiction, inputs, apiKey,
//     model, abortSignal, logger, ... })
//     → Promise<{ ok: true, text, referenceId, plan,
//                  perSectionMetrics, usedPolisher }>
//     | Promise<{ ok: false, code, referenceId, stage, details }>

import { planDocument } from './planner.js'
import { writeSection } from './writer.js'
import { assembleDocument } from './assembler.js'
import { polishDocument } from './polisher.js'

/**
 * Top-level orchestrator for the multi-pass pipeline. Stage 1 leaves
 * this as a skeleton that throws — Stages 2-4 fill in the writer,
 * assembler, and feature-flag wiring respectively.
 *
 * @param {object} args
 * @param {string} args.docType       — registry doc-type id (e.g. 'shareholder-agreement')
 * @param {string} args.jurisdiction  — jurisdiction key (e.g. 'nigeria')
 * @param {object} args.inputs        — user-supplied variables (parties, terms, etc.)
 * @param {string} args.apiKey        — Anthropic API key
 * @param {string} args.model         — Anthropic model id (e.g. 'claude-sonnet-4-6')
 * @param {AbortSignal} [args.abortSignal]
 * @param {object} [args.logger]      — { logInfo, logWarn, logError }
 * @returns {Promise<object>}
 */
export async function generateDocumentMultipass(/* args */) {
  throw new Error('generateDocumentMultipass is not implemented yet (Phase 2 Stage 4 will wire it)')
}

// Re-export the per-stage primitives so unit tests can drive each stage
// in isolation without going through the orchestrator.
export { planDocument, writeSection, assembleDocument, polishDocument }
