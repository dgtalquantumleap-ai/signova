// api/v1/documents/types.js
// GET https://api.ebenova.dev/v1/documents/types
// Returns all supported document types, grouped by category.
// No authentication required — public endpoint.

const DOCUMENT_TYPES = {
  business_contracts: [
    { type: 'nda',                    label: 'Non-Disclosure Agreement' },
    { type: 'freelance-contract',     label: 'Freelance / Client Contract' },
    { type: 'service-agreement',      label: 'Service Agreement' },
    { type: 'consulting-agreement',   label: 'Consulting Agreement' },
    { type: 'independent-contractor', label: 'Independent Contractor Agreement' },
    { type: 'business-partnership',   label: 'Business Partnership Agreement' },
    { type: 'joint-venture',          label: 'Joint Venture Agreement' },
    { type: 'distribution-agreement', label: 'Distribution / Reseller Agreement' },
    { type: 'supply-agreement',       label: 'Supply Agreement' },
    { type: 'business-proposal',      label: 'Business Proposal' },
    { type: 'purchase-agreement',     label: 'Purchase Agreement' },
  ],
  employment_hr: [
    { type: 'employment-offer-letter', label: 'Employment Offer Letter' },
    { type: 'non-compete-agreement',   label: 'Non-Compete Agreement' },
  ],
  financial: [
    { type: 'loan-agreement',           label: 'Loan Agreement' },
    { type: 'payment-terms-agreement',  label: 'Payment Terms Agreement' },
    { type: 'shareholder-agreement',    label: 'Shareholder Agreement' },
    { type: 'hire-purchase',            label: 'Hire Purchase Agreement' },
  ],
  startup_fundraising: [
    { type: 'founders-agreement',        label: "Founders' Agreement" },
    { type: 'ip-assignment-agreement',   label: 'IP Assignment Agreement' },
    { type: 'advisory-board-agreement',  label: 'Advisory Board Agreement' },
    { type: 'vesting-agreement',         label: 'Vesting Agreement' },
    { type: 'term-sheet',               label: 'Term Sheet' },
    { type: 'safe-agreement',           label: 'SAFE Agreement' },
  ],
  real_estate: [
    { type: 'tenancy-agreement',         label: 'Tenancy / Rental Agreement' },
    { type: 'quit-notice',               label: 'Quit Notice / Notice to Vacate' },
    { type: 'deed-of-assignment',        label: 'Deed of Assignment' },
    { type: 'power-of-attorney',         label: 'Power of Attorney' },
    { type: 'landlord-agent-agreement',  label: 'Landlord & Agent Agreement' },
    { type: 'facility-manager-agreement',label: 'Facility Manager Agreement' },
  ],
  legal_compliance: [
    { type: 'privacy-policy',       label: 'Privacy Policy' },
    { type: 'terms-of-service',     label: 'Terms of Service' },
    { type: 'mou',                  label: 'Memorandum of Understanding' },
    { type: 'letter-of-intent',     label: 'Letter of Intent' },
    { type: 'data-processing-agreement', label: 'Data Processing Agreement (DPA)' },
  ],
}

// Flat list for quick lookup
const ALL_TYPES = Object.values(DOCUMENT_TYPES).flat().map(d => d.type)

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 'public, max-age=3600') // cache 1 hour — types rarely change

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } })
  }

  return res.status(200).json({
    success: true,
    total: ALL_TYPES.length,
    types: ALL_TYPES,
    grouped: DOCUMENT_TYPES,
  })
}
