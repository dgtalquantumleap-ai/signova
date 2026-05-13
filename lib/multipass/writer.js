// lib/multipass/writer.js
//
// Phase 2 Pass 2..N — per-section Sonnet writer.
//
// Skeleton only at Stage 1. Real implementation lands in Stage 2.
//
// Target shape:
//   writeSection({
//     section,          // one Section from the planner output
//     plan,             // the full plan (peer sections, metadata)
//     inputs,           // original user-supplied variables
//     statuteContext,   // pre-built statute-injection string for section.statute_refs
//     apiKey, model, anthropicFetch, abortSignal, logger,
//   }) → Promise<string>   // markdown for this section, no global numbering reassignment

/**
 * Write a single document section.
 *
 * Stage 1: stub. Stage 2 will implement per-section Sonnet calls with
 * narrow output budgets (≤5K tokens each), statute injection scoped
 * to the section's `statute_refs`, and dependency-aware context so a
 * later section can reference defined terms from earlier ones.
 *
 * @returns {Promise<string>}
 */
export async function writeSection(/* args */) {
  throw new Error('writeSection is not implemented yet (Phase 2 Stage 2 will implement it)')
}
