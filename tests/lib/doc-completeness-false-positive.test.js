// tests/lib/doc-completeness-false-positive.test.js
//
// Regression tests for the hasExecutionBlock false-positive class that
// shipped a truncated MOU as ok:true to customer SIG-858825A9 on
// 2026-05-07. The prior detector matched the substring "signed by"
// case-insensitively anywhere in the last 30% of the document; this let
// body prose like "...amendment signed by authorized representatives..."
// in clause 3.9 satisfy the execution-block check, bypassing the
// continuation retry that would have completed the document.
//
// The fixture for each of the 8 doc types is sized to realistic
// production output (~22-26K chars) and places a body-prose phrase that
// would have tripped the old detector firmly inside the last-30% tail.
// The new detector must return false for the body-only fixture and true
// for the same fixture with a real execution block appended.
//
// Coverage matrix per doc type (4 scenarios × 8 doc types = 32 tests):
//   1. body-only (no exec block)                           — expect false
//   2. body + "SIGNED by [Party]" + signature underline    — expect true
//   3. body + "IN WITNESS WHEREOF" + signature underline   — expect true
//   4. body + "Witness Signature: ____" form-field         — expect true
//
// Plus 5 edge case tests (under-100-chars, lowercase-signed, etc.).

import { describe, it, expect } from 'vitest'
import { hasExecutionBlock, findMissingClauses } from '../../lib/doc-completeness.js'

// ---------------------------------------------------------------------------
// Body-prose phrases that would have tripped the old detector. Each phrase
// is a real-world legal-document idiom — these are not contrived edge cases.
// ---------------------------------------------------------------------------

const BODY_PROSE_TRAPS = {
  'mou': '...subsequent written amendment signed by authorized representatives of both Parties, and shall be recognized and accounted for separately in the Company\'s records.',
  'partnership-agreement': '...this Agreement, signed by all Partners, supersedes any prior verbal arrangement and constitutes the entire understanding between the parties.',
  'service-agreement': '...any amendment to this Service Agreement must be in writing and signed by both Parties to be effective; oral modifications shall have no legal force.',
  'nda': '...the parties have signed by way of confirmation that any subsequent amendment shall be reduced to writing in accordance with Clause 12.4 of this Agreement.',
  'asset-purchase-agreement': '...the bill of sale signed by the Seller at Closing shall constitute conclusive evidence of the transfer of title to the Purchased Assets.',
  'employment-offer': '...by signing below, you confirm receipt of this offer letter; this letter, once signed by you and countersigned by an authorised representative, forms the binding offer.',
  'tenancy-agreement': '...rent shall be payable on or before the first day of each calendar month, and any receipt witnessed by the Landlord\'s agent shall be deemed valid acknowledgement.',
  'llc-operating-agreement': '...any amendment to this Operating Agreement signed by the holders of a majority of the outstanding Membership Interests shall be effective without further action.',
}

// ---------------------------------------------------------------------------
// Build a realistic ~25K-char fixture for a given doc type. The body-prose
// trap phrase is placed roughly 75% through the document so it falls
// firmly inside the last-30% tail that hasExecutionBlock examines.
// ---------------------------------------------------------------------------

function buildFixture(docType, { withExecBlock = null } = {}) {
  const trap = BODY_PROSE_TRAPS[docType]
  if (!trap) throw new Error(`No fixture trap for docType="${docType}"`)

  // ~17K chars of head padding (sections 1-N before the trap)
  const headPad = (
    'This Agreement contains substantive operative provisions covering the parties, the recitals, ' +
    'the purpose of the engagement, the brand identity and usage, the equity grant and vesting schedule, ' +
    'the post-cliff vesting mechanics, governance and decision-making authority, the absence of veto ' +
    'or blocking rights, and the right to strategic input and participation. '
  ).repeat(50)

  // Trap clause + a small amount of body text after it (so the trap is at ~75%, not at the very end)
  const trapClause = `\n\nN.N Capital Contributions and Amendments. ${trap}\n\n` +
    'N+1. REVENUE SHARING AND COMMISSION STRUCTURE. The Parties shall share revenue ' +
    'in accordance with the schedule set out in Annexure A, calculated quarterly and ' +
    'reconciled within thirty (30) days of each calendar quarter end. Net revenue shall ' +
    'be calculated after the deduction of platform fees, payment-processor fees, refunds, ' +
    'and any tax liabilities directly attributable to the underlying transactions.\n'

  let doc = headPad + trapClause

  if (withExecBlock === 'SIGNED-BY') {
    doc += '\n\nIN WITNESS WHEREOF, the Parties have hereunto set their hands and seals the day and year first above written.\n\n' +
      'SIGNED by the Company:\n' +
      'Signature: _____________________________\n' +
      'Name: _____________________________\n' +
      'Title: _____________________________\n' +
      'Date: _____________________________\n\n' +
      'SIGNED by the Counterparty:\n' +
      'Signature: _____________________________\n' +
      'Name: _____________________________\n' +
      'Date: _____________________________\n'
  } else if (withExecBlock === 'WITNESS-WHEREOF') {
    doc += '\n\nIN WITNESS WHEREOF the Parties have executed this Agreement on the date first above written.\n\n' +
      'For and on behalf of the Company:\n' +
      '_____________________________\n' +
      'Date: _____________________________\n\n' +
      'For and on behalf of the Counterparty:\n' +
      '_____________________________\n' +
      'Date: _____________________________\n'
  } else if (withExecBlock === 'WITNESS-FIELD') {
    doc += '\n\nThe Parties have agreed to the terms above as evidenced by their signatures below.\n\n' +
      'Party A:\n' +
      'Signature: _____________________________\n' +
      'Date: _____________________________\n\n' +
      'Witness Signature: _____________________________\n' +
      'Witness Name: _____________________________\n' +
      'Witness Address: _____________________________\n'
  }

  return doc
}

// ---------------------------------------------------------------------------
// Doc-type matrix: 8 doc types × 4 scenarios
// ---------------------------------------------------------------------------

const DOC_TYPES = Object.keys(BODY_PROSE_TRAPS)

describe('hasExecutionBlock — false-positive prevention (body prose tail)', () => {
  for (const docType of DOC_TYPES) {
    it(`${docType}: body-only fixture (trap-phrase in tail, NO exec block) returns false`, () => {
      const doc = buildFixture(docType)
      // Sanity: the trap phrase landed in the last-30% tail (where the
      // detector looks). Keyword varies by doc type — most use "signed by",
      // tenancy uses "witnessed by". The point is each phrase is the kind
      // of body prose that would have tripped the old substring detector.
      const tailStart = Math.floor(doc.length * 0.7)
      const tail = doc.slice(tailStart).toLowerCase()
      const trapKeyword = BODY_PROSE_TRAPS[docType].toLowerCase().match(/\bsigned by|\bsigning\b|\bwitnessed by|\bsign\b/)?.[0]
      expect(trapKeyword).toBeTruthy()
      expect(tail).toContain(trapKeyword)
      // New detector returns false because alias requires uppercase SIGNED at line start
      expect(hasExecutionBlock(doc)).toBe(false)
    })
  }
})

describe('hasExecutionBlock — true positive: SIGNED-by labelled block', () => {
  for (const docType of DOC_TYPES) {
    it(`${docType}: body + uppercase "SIGNED by [Party]" + signature underline returns true`, () => {
      const doc = buildFixture(docType, { withExecBlock: 'SIGNED-BY' })
      expect(hasExecutionBlock(doc)).toBe(true)
    })
  }
})

describe('hasExecutionBlock — true positive: IN WITNESS WHEREOF preamble', () => {
  for (const docType of DOC_TYPES) {
    it(`${docType}: body + "IN WITNESS WHEREOF" + signature underline returns true`, () => {
      const doc = buildFixture(docType, { withExecBlock: 'WITNESS-WHEREOF' })
      expect(hasExecutionBlock(doc)).toBe(true)
    })
  }
})

describe('hasExecutionBlock — true positive: Witness Signature: form field', () => {
  for (const docType of DOC_TYPES) {
    it(`${docType}: body + "Witness Signature: ____" + Date: returns true`, () => {
      const doc = buildFixture(docType, { withExecBlock: 'WITNESS-FIELD' })
      expect(hasExecutionBlock(doc)).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('hasExecutionBlock — edge cases', () => {
  it('document under 100 chars returns false (too short to be a real document)', () => {
    expect(hasExecutionBlock('IN WITNESS WHEREOF')).toBe(false)
    expect(hasExecutionBlock('SIGNED by\nDate:_____')).toBe(false)
    expect(hasExecutionBlock('')).toBe(false)
    expect(hasExecutionBlock(null)).toBe(false)
    expect(hasExecutionBlock(undefined)).toBe(false)
  })

  it('document with only an underline (no SIGNED keyword, no Date:) returns false', () => {
    const doc = 'A'.repeat(500) + '\n\n' +
      'Some closing language.\n\n' +
      '____________________\n' +
      '____________________\n'
    // Multi-line fallback requires "Date:" within 3 lines of the underscore
    expect(hasExecutionBlock(doc)).toBe(false)
  })

  it('document with lowercase "signed by" without other anchors returns false (the customer bug)', () => {
    const headPad = 'A'.repeat(15000)
    const doc = headPad + '\n\n' +
      'Section 99. The parties have signed by way of confirming the foregoing.\n' +
      'Net revenue shall be reconciled at quarter end.\n'
    // Lowercase "signed by" matches OLD detector but not NEW alias
    expect(hasExecutionBlock(doc)).toBe(false)
  })

  it('structural underline + Date in middle of body text (NOT in tail 30%) returns false', () => {
    // Underline + Date appears at offset ~5%, then 20K chars of pure body text follow.
    const doc =
      'PRELUDE.\n\n____________________\nDate: 2026-01-01\n\n' +
      ('Body text continues with substantive provisions about the parties\' obligations. '.repeat(250))
    // Tail is the last 30% — pure body text, no exec block, no alias
    expect(hasExecutionBlock(doc)).toBe(false)
  })

  it('proper exec block in tail returns true (positive control)', () => {
    const headPad = ('Body section content. '.repeat(800))
    const doc = headPad + '\n\nIN WITNESS WHEREOF the parties have set their hands.\n\n' +
      'SIGNED by Acme Corp:\nSignature: _____________________________\nDate: _____________________________\n'
    expect(hasExecutionBlock(doc)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// findMissingClauses integration — confirms the detector wiring through to
// the orchestrator-facing API. NDA and MOU are the two doc types that
// currently declare execution-block as a required_clause in
// lib/doc-registry.json.
// ---------------------------------------------------------------------------

describe('findMissingClauses — integration with hasExecutionBlock', () => {
  it('SIG-858825A9 reproduction: MOU body-prose fixture returns missing execution-block (would trigger continuation retry)', () => {
    const doc = buildFixture('mou')
    const missing = findMissingClauses(doc, 'mou')
    expect(missing).toContain('execution-block')
  })

  it('SIG-858825A9 with proper exec block appended: missing list does NOT include execution-block', () => {
    const doc = buildFixture('mou', { withExecBlock: 'SIGNED-BY' })
    const missing = findMissingClauses(doc, 'mou')
    expect(missing).not.toContain('execution-block')
  })

  it('NDA body-prose fixture returns missing execution-block', () => {
    const doc = buildFixture('nda')
    const missing = findMissingClauses(doc, 'nda')
    expect(missing).toContain('execution-block')
  })

  it('NDA with WITNESS-WHEREOF block: missing list does NOT include execution-block', () => {
    const doc = buildFixture('nda', { withExecBlock: 'WITNESS-WHEREOF' })
    const missing = findMissingClauses(doc, 'nda')
    expect(missing).not.toContain('execution-block')
  })
})
