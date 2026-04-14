// api/v1/documents/templates.js
// GET /v1/documents/templates
// GET /v1/documents/templates?type=nda
// Returns field schemas for document types — lets developers build dynamic forms
// No AI call needed — pure data endpoint

import { authenticate, buildUsageBlock } from '../../../lib/api-auth.js'

const TEMPLATES = {
  'nda': {
    label: 'Non-Disclosure Agreement',
    category: 'Core Legal',
    fields: [
      { key: 'disclosingParty', label: 'Disclosing Party', type: 'text', required: true, placeholder: 'Acme Inc.' },
      { key: 'receivingParty', label: 'Receiving Party', type: 'text', required: true, placeholder: 'John Smith' },
      { key: 'purpose', label: 'Purpose of Disclosure', type: 'text', required: true, placeholder: 'Partnership discussion' },
      { key: 'duration', label: 'Confidentiality Duration', type: 'text', required: true, placeholder: '2 years' },
      { key: 'mutual', label: 'Mutual NDA?', type: 'select', options: ['Yes', 'No'], required: true },
      { key: 'jurisdiction', label: 'Governing Law', type: 'text', required: false, placeholder: 'Ontario, Canada' },
    ],
  },
  'freelance-contract': {
    label: 'Freelance Contract',
    category: 'Core Legal',
    fields: [
      { key: 'clientName', label: 'Client Name', type: 'text', required: true },
      { key: 'freelancerName', label: 'Freelancer Name', type: 'text', required: true },
      { key: 'projectDescription', label: 'Project Description', type: 'textarea', required: true },
      { key: 'deliverables', label: 'Deliverables', type: 'textarea', required: true },
      { key: 'totalFee', label: 'Total Fee', type: 'text', required: true },
      { key: 'paymentSchedule', label: 'Payment Schedule', type: 'text', required: true, placeholder: '50% upfront, 50% on delivery' },
      { key: 'deadline', label: 'Project Deadline', type: 'text', required: true },
      { key: 'revisions', label: 'Revision Rounds Included', type: 'text', required: false, placeholder: '2' },
      { key: 'ipOwnership', label: 'IP Ownership', type: 'select', options: ['Transfers to client on payment', 'Retained by freelancer', 'Shared'], required: true },
      { key: 'jurisdiction', label: 'Governing Law', type: 'text', required: false },
    ],
  },
  'tenancy-agreement': {
    label: 'Tenancy Agreement',
    category: 'Real Estate',
    fields: [
      { key: 'landlordName', label: 'Landlord Name', type: 'text', required: true },
      { key: 'tenantName', label: 'Tenant Name', type: 'text', required: true },
      { key: 'propertyAddress', label: 'Property Address', type: 'textarea', required: true },
      { key: 'rentAmount', label: 'Rent Amount', type: 'text', required: true },
      { key: 'rentFrequency', label: 'Rent Frequency', type: 'select', options: ['Monthly', 'Quarterly', 'Annually'], required: true },
      { key: 'duration', label: 'Tenancy Duration', type: 'text', required: true, placeholder: '1 year' },
      { key: 'startDate', label: 'Start Date', type: 'text', required: true },
      { key: 'deposit', label: 'Security Deposit', type: 'text', required: false },
      { key: 'restrictions', label: 'Restrictions', type: 'textarea', required: false, placeholder: 'No pets, no subletting' },
      { key: 'jurisdiction', label: 'Governing Law', type: 'text', required: false },
    ],
  },
  'loan-agreement': {
    label: 'Loan Agreement',
    category: 'Finance',
    fields: [
      { key: 'lenderName', label: 'Lender Name', type: 'text', required: true },
      { key: 'borrowerName', label: 'Borrower Name', type: 'text', required: true },
      { key: 'principalAmount', label: 'Loan Amount', type: 'text', required: true },
      { key: 'interestRate', label: 'Interest Rate', type: 'text', required: true, placeholder: '5% flat' },
      { key: 'repaymentSchedule', label: 'Repayment Schedule', type: 'textarea', required: true },
      { key: 'collateral', label: 'Collateral (if any)', type: 'textarea', required: false },
      { key: 'defaultTerms', label: 'Default Terms', type: 'textarea', required: false },
      { key: 'jurisdiction', label: 'Governing Law', type: 'text', required: false },
    ],
  },
  'service-agreement': {
    label: 'Service Agreement',
    category: 'Core Legal',
    fields: [
      { key: 'providerName', label: 'Service Provider', type: 'text', required: true },
      { key: 'clientName', label: 'Client Name', type: 'text', required: true },
      { key: 'serviceDescription', label: 'Service Description', type: 'textarea', required: true },
      { key: 'fee', label: 'Fee', type: 'text', required: true },
      { key: 'paymentTerms', label: 'Payment Terms', type: 'text', required: true },
      { key: 'duration', label: 'Contract Duration', type: 'text', required: false },
      { key: 'terminationClause', label: 'Termination Clause', type: 'textarea', required: false },
      { key: 'jurisdiction', label: 'Governing Law', type: 'text', required: false },
    ],
  },
  'business-proposal': {
    label: 'Business Proposal',
    category: 'Business',
    fields: [
      { key: 'companyName', label: 'Your Company', type: 'text', required: true },
      { key: 'clientName', label: 'Client/Recipient', type: 'text', required: true },
      { key: 'projectTitle', label: 'Project Title', type: 'text', required: true },
      { key: 'problemStatement', label: 'Problem Statement', type: 'textarea', required: true },
      { key: 'proposedSolution', label: 'Proposed Solution', type: 'textarea', required: true },
      { key: 'deliverables', label: 'Deliverables', type: 'textarea', required: true },
      { key: 'timeline', label: 'Timeline', type: 'text', required: true },
      { key: 'budget', label: 'Budget', type: 'text', required: true },
    ],
  },
  'data-processing-agreement': {
    label: 'Data Processing Agreement (DPA)',
    category: 'Data Protection & Compliance',
    fields: [
      { key: 'controllerName', label: 'Data Controller (your organisation)', type: 'text', required: true, placeholder: 'Acme Ltd.' },
      { key: 'processorName', label: 'Data Processor (vendor/contractor)', type: 'text', required: true, placeholder: 'CloudServ Ltd.' },
      { key: 'controllerAddress', label: 'Controller Address', type: 'text', required: false },
      { key: 'processorAddress', label: 'Processor Address', type: 'text', required: false },
      { key: 'dataSubjects', label: 'Categories of Data Subjects', type: 'textarea', required: true, placeholder: 'Customers, employees, website visitors' },
      { key: 'dataCategories', label: 'Categories of Personal Data', type: 'textarea', required: true, placeholder: 'Names, emails, phone numbers, payment details' },
      { key: 'specialCategoryData', label: 'Special Category Data? (if any)', type: 'textarea', required: false, placeholder: 'Health data, biometric data — leave blank if none' },
      { key: 'processingPurpose', label: 'Purpose of Processing', type: 'textarea', required: true, placeholder: 'Cloud hosting of customer database, email marketing, payroll processing' },
      { key: 'processingActivities', label: 'Description of Processing Activities', type: 'textarea', required: true, placeholder: 'Storing, retrieving, transmitting, and backing up customer data on cloud infrastructure' },
      { key: 'retentionPeriod', label: 'Data Retention Period', type: 'text', required: true, placeholder: 'Duration of contract + 30 days after termination' },
      { key: 'subProcessors', label: 'Sub-Processors Authorised?', type: 'select', options: ['Yes — with prior written authorisation', 'No — not permitted', 'Yes — specific list attached'], required: true },
      { key: 'securityMeasures', label: 'Technical & Organisational Security Measures', type: 'textarea', required: false, placeholder: 'Encryption at rest, role-based access, 2FA, regular audits, incident response plan' },
      { key: 'dataTransfers', label: 'Cross-Border Data Transfers?', type: 'select', options: ['No — data stays in-country', 'Yes — to specific countries (list them)', 'Yes — globally with adequate safeguards'], required: true },
      { key: 'jurisdiction', label: 'Governing Law / Data Protection Regime', type: 'select', options: ['Nigeria — NDPA 2023', 'United Kingdom — UK GDPR / DPA 2018', 'European Union — GDPR', 'South Africa — POPIA', 'Kenya — Data Protection Act 2019', 'Ghana — Data Protection Act 2012', 'Other'], required: true },
      { key: 'dpoContact', label: 'Data Protection Officer / Contact Person', type: 'text', required: false, placeholder: 'dpo@acme.com or Legal Department' },
      { key: 'breachNotificationHours', label: 'Breach Notification Timeline', type: 'text', required: false, placeholder: '24 hours (internal) / 72 hours (to regulator)' },
    ],
  },
}

// Add remaining types with minimal schemas
const SIMPLE_TYPES = [
  'privacy-policy', 'terms-of-service', 'independent-contractor', 'hire-purchase',
  'quit-notice', 'deed-of-assignment', 'power-of-attorney', 'landlord-agent-agreement',
  'facility-manager-agreement', 'consulting-agreement', 'employment-offer-letter',
  'non-compete-agreement', 'payment-terms-agreement', 'business-partnership',
  'joint-venture', 'shareholder-agreement', 'mou', 'letter-of-intent',
  'distribution-agreement', 'supply-agreement', 'purchase-agreement',
  'founders-agreement', 'ip-assignment-agreement', 'advisory-board-agreement',
  'vesting-agreement', 'term-sheet', 'safe-agreement',
]

for (const t of SIMPLE_TYPES) {
  if (!TEMPLATES[t]) {
    TEMPLATES[t] = {
      label: t.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      category: 'General',
      fields: [
        { key: 'party1', label: 'Party 1', type: 'text', required: true },
        { key: 'party2', label: 'Party 2', type: 'text', required: true },
        { key: 'details', label: 'Key Details', type: 'textarea', required: true },
        { key: 'jurisdiction', label: 'Governing Law', type: 'text', required: false },
      ],
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  const url = new URL(req.url, 'https://api.ebenova.dev')
  const type = url.searchParams.get('type')

  if (type) {
    const template = TEMPLATES[type]
    if (!template) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Unknown document type: ${type}` } })
    }
    return res.status(200).json({ success: true, type, ...template })
  }

  // Return all templates
  const all = Object.entries(TEMPLATES).map(([type, data]) => ({
    type,
    label: data.label,
    category: data.category,
    field_count: data.fields.length,
    required_fields: data.fields.filter(f => f.required).length,
  }))

  return res.status(200).json({
    success: true,
    total: all.length,
    templates: all,
    usage: buildUsageBlock(auth),
  })
}
