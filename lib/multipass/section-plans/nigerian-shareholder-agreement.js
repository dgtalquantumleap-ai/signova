// lib/multipass/section-plans/nigerian-shareholder-agreement.js
//
// Canonical 18-section template for a Nigerian Shareholder Agreement.
// The planner (Pass 1) loads this template, then asks Sonnet to
// customise it for the specific request (e.g. drop multi-class
// sections for a single-class deal, expand a section description
// with party-specific recitals, etc.).
//
// The template is INTENTIONALLY conservative — every section that
// belongs in a comprehensive Nigerian Shareholder Agreement is
// present. The planner's job is to TRIM (when not needed) and
// CUSTOMISE (with party-specific detail), not to invent new sections.
// New sections can still appear in the planner's output, but they
// are flagged in metadata so a reviewer can spot drift.
//
// Statute references use the stable IDs from lib/statute-bundles.js
// (CAMA = Companies and Allied Matters Act 2020; NDPA = Nigeria Data
// Protection Act 2023). Section IDs are stable across requests so
// dependency arrays can refer to them by name.
//
// 2026-05-13 — pre-Stage-2 section-number correction pass:
//   CAMA-S141 → CAMA-S128 (pre-emption is s.128, not s.141)
//   CAMA-S151 → CAMA-S175 (transfer of shares is s.175)
//   CAMA-S140 dropped from sec-3 (s.140 is calls on unpaid shares, not
//     capital alteration; not load-bearing for typical Signova use)
//   CAMA-S275 dropped from sec-7 (s.275's three-independent-director
//     requirement applies only to public companies; Signova users are
//     typically private companies)
//   NDPA-S2  → NDPA-S65 (NDPA interpretation section is s.65, not s.2)
//   NDPA-S26 → NDPA-S24 (data minimisation is in s.24 principles, not s.26)
//   NDPA-S30 → NDPA-S39 (security is s.39; s.30 is sensitive PII)
//   NDPA-S37 → NDPA-S34 (DSRs are s.34; s.37 is Constitution privacy)
//   NDPA-S43 → NDPA-S41 (cross-border main is s.41; s.43 is derogations)
// All corrections verified against published Nigerian sources (CAC,
// LawGlobal Hub, Mondaq, Aluko & Oyebode, FPF, CookieYes). See the
// pre-Stage-2 verification report and statute-bundles.js comments.

/**
 * @typedef {'short'|'medium'|'long'} ExpectedLength
 *
 * @typedef {object} SectionTemplate
 * @property {string} id              — stable section identifier (e.g. 'sec-3')
 * @property {string} number          — display number (e.g. '3')
 * @property {string} title           — display title (e.g. 'Share Capital and Issuance')
 * @property {string} description     — what this section covers; fed into the writer prompt
 * @property {string[]} dependencies  — section IDs that must be written first
 * @property {string[]} statute_refs  — statute IDs for retrieval-driven injection
 * @property {ExpectedLength} expected_length
 * @property {boolean} parallelizable — true if the section can run concurrent with peers
 *
 * @typedef {object} SectionPlanTemplate
 * @property {string} docType
 * @property {string} jurisdiction
 * @property {SectionTemplate[]} sections
 */

/** @type {SectionPlanTemplate} */
export const NIGERIAN_SHAREHOLDER_AGREEMENT_TEMPLATE = {
  docType: 'shareholder-agreement',
  jurisdiction: 'nigeria',
  sections: [
    {
      id: 'sec-1',
      number: '1',
      title: 'Recitals',
      description: 'Background, parties, purpose of agreement',
      dependencies: [],
      statute_refs: [],
      expected_length: 'short',
      parallelizable: false,
    },
    {
      id: 'sec-2',
      number: '2',
      title: 'Definitions and Interpretation',
      description: 'Defined terms used throughout the agreement',
      dependencies: [],
      statute_refs: ['CAMA-S20', 'NDPA-S65'],
      expected_length: 'medium',
      parallelizable: false,
    },
    {
      id: 'sec-3',
      number: '3',
      title: 'Share Capital and Issuance',
      description: 'Authorized capital, share classes, issuance, allotment procedures',
      dependencies: ['sec-2'],
      statute_refs: ['CAMA-S124', 'CAMA-S125'],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-4',
      number: '4',
      title: 'Pre-emption Rights',
      description: 'Right of first refusal on new share issuances',
      dependencies: ['sec-2', 'sec-3'],
      statute_refs: ['CAMA-S128'],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-5',
      number: '5',
      title: 'Transfer Restrictions',
      description: 'Limits on share transfers, permitted transferees',
      dependencies: ['sec-2', 'sec-3'],
      statute_refs: ['CAMA-S175'],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-6',
      number: '6',
      title: 'Drag-Along and Tag-Along Rights',
      description: 'Forced sale and co-sale rights on change of control',
      dependencies: ['sec-2', 'sec-5'],
      statute_refs: ['CAMA-S711'],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-7',
      number: '7',
      title: 'Board Composition and Governance',
      description: 'Board appointments, committees, meeting procedures, quorums',
      dependencies: ['sec-2'],
      statute_refs: ['CAMA-S269'],
      expected_length: 'long',
      parallelizable: true,
    },
    {
      id: 'sec-8',
      number: '8',
      title: 'Reserved Matters',
      description: 'Decisions requiring shareholder super-majority or unanimous consent',
      dependencies: ['sec-2', 'sec-7'],
      statute_refs: ['CAMA-S233'],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-9',
      number: '9',
      title: 'Information Rights and Reporting',
      description: 'Financial reporting, inspection rights, audit access',
      dependencies: ['sec-2'],
      statute_refs: ['CAMA-S374', 'NDPA-S34'],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-10',
      number: '10',
      title: 'Data Protection and Confidentiality',
      description: 'NDPA-aligned handling of shareholder and company data, confidentiality obligations',
      dependencies: ['sec-2'],
      statute_refs: ['NDPA-S24', 'NDPA-S25', 'NDPA-S39', 'NDPA-S40', 'NDPA-S41'],
      expected_length: 'long',
      parallelizable: true,
    },
    {
      id: 'sec-11',
      number: '11',
      title: 'Deadlock Resolution',
      description: 'Procedures for resolving board or shareholder deadlocks',
      dependencies: ['sec-2', 'sec-7', 'sec-8'],
      statute_refs: [],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-12',
      number: '12',
      title: 'Exit Provisions',
      description: 'Exit events, valuation methods, right of first refusal on exit',
      dependencies: ['sec-2', 'sec-5'],
      statute_refs: ['CAMA-S711'],
      expected_length: 'long',
      parallelizable: true,
    },
    {
      id: 'sec-13',
      number: '13',
      title: 'Restrictive Covenants',
      description: 'Non-compete, non-solicit, confidentiality post-exit',
      dependencies: ['sec-2'],
      statute_refs: [],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-14',
      number: '14',
      title: 'Representations and Warranties',
      description: 'Mutual reps and warranties of shareholders',
      dependencies: ['sec-2'],
      statute_refs: [],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-15',
      number: '15',
      title: 'Term and Termination',
      description: 'Agreement duration, termination events, post-termination obligations',
      dependencies: ['sec-2'],
      statute_refs: [],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-16',
      number: '16',
      title: 'Dispute Resolution',
      description: 'Mediation, arbitration under Lagos MDC or Nigerian Arbitration Act, governing law',
      dependencies: ['sec-2'],
      statute_refs: [],
      expected_length: 'medium',
      parallelizable: true,
    },
    {
      id: 'sec-17',
      number: '17',
      title: 'General Provisions',
      description: 'Notices, amendments, severability, counterparts, entire agreement',
      dependencies: ['sec-2'],
      statute_refs: [],
      expected_length: 'short',
      parallelizable: true,
    },
    {
      // Execution section runs last — must reference final section
      // numbering, party blocks, and witness conventions. Its
      // dependency list covers EVERY other section so the scheduler
      // can't issue it until all writers have returned.
      id: 'sec-18',
      number: '18',
      title: 'Execution',
      description: 'Signature blocks for all shareholders, witness blocks per Nigerian execution conventions',
      dependencies: [
        'sec-1', 'sec-2', 'sec-3', 'sec-4', 'sec-5', 'sec-6',
        'sec-7', 'sec-8', 'sec-9', 'sec-10', 'sec-11', 'sec-12',
        'sec-13', 'sec-14', 'sec-15', 'sec-16', 'sec-17',
      ],
      statute_refs: ['CAMA-S102'],
      expected_length: 'short',
      parallelizable: false,
    },
  ],
}

/**
 * Lookup map keyed by `${docType}::${jurisdiction}`. The planner uses
 * this so a single function can serve any future template without a
 * switch statement. Stage 1 ships only the Nigerian Shareholder
 * Agreement template; later phases register more.
 *
 * @type {Map<string, SectionPlanTemplate>}
 */
export const SECTION_PLAN_TEMPLATES = new Map([
  [
    `${NIGERIAN_SHAREHOLDER_AGREEMENT_TEMPLATE.docType}::${NIGERIAN_SHAREHOLDER_AGREEMENT_TEMPLATE.jurisdiction}`,
    NIGERIAN_SHAREHOLDER_AGREEMENT_TEMPLATE,
  ],
])

/**
 * Look up a section plan template by (docType, jurisdiction). Returns
 * null when no template is registered — the planner converts that
 * into a thrown `PlannerError` with code `UNKNOWN_TEMPLATE` so the
 * orchestrator can fall back to the single-call path cleanly.
 *
 * @param {string} docType
 * @param {string} jurisdiction
 * @returns {SectionPlanTemplate | null}
 */
export function getSectionPlanTemplate(docType, jurisdiction) {
  return SECTION_PLAN_TEMPLATES.get(`${docType}::${jurisdiction}`) ?? null
}
