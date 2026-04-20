// api/extract-terms.js
// Accepts a raw conversation (WhatsApp, email, chat) + docType
// Returns a JSON object with field values matching DOC_CONFIG in Generator.jsx

// Simple in-memory rate limiter — no Redis needed at current scale
const ipStore = new Map()
function isRateLimited(ip) {
  const now = Date.now()
  const entry = ipStore.get(ip)
  if (!entry || now > entry.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Rate limiting — 5 extractions per IP per hour
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many extractions. Please try again in an hour.' })
  }

  // Parse body safely — req.body can be undefined in ESM Vercel functions
  let body = req.body
  if (!body || typeof body === 'string') {
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = ''
        req.on('data', chunk => { data += chunk })
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })
      body = raw ? JSON.parse(raw) : {}
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }
  }

  const { conversation, docType } = body
  if (!conversation || !docType) {
    return res.status(400).json({ error: 'Missing conversation or docType' })
  }
  if (conversation.length > 8000) {
    return res.status(400).json({
      error: 'Conversation too long. Please paste the relevant portion only (max 8,000 characters).',
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured' })

  // Field maps — tells Claude exactly what JSON keys to return per doc type
  const FIELD_MAPS = {
    'privacy-policy': ['company', 'website', 'country', 'dataCollected', 'thirdParties', 'contact'],
    'terms-of-service': ['company', 'website', 'country', 'serviceType', 'hasSubscription', 'contact'],
    'nda': ['disclosingParty', 'receivingParty', 'purpose', 'duration', 'country', 'mutual'],
    'freelance-contract': ['freelancer', 'client', 'services', 'rate', 'paymentTerms', 'country', 'ipOwnership'],
    'independent-contractor': ['company', 'contractor', 'services', 'compensation', 'term', 'country', 'nonCompete'],
    'service-agreement': ['provider', 'client', 'services', 'fee', 'paymentTerms', 'duration', 'country', 'ipOwnership', 'confidentiality'],
    'consulting-agreement': ['consultant', 'client', 'scope', 'rate', 'paymentTerms', 'duration', 'exclusivity', 'country'],
    'employment-offer-letter': ['employer', 'employee', 'jobTitle', 'department', 'startDate', 'salary', 'employmentType', 'benefits', 'noticePeriod', 'country'],
    'non-compete-agreement': ['employer', 'employee', 'role', 'restrictedActivities', 'duration', 'geography', 'country'],
    'payment-terms-agreement': ['creditor', 'debtor', 'amountOwed', 'reason', 'paymentSchedule', 'dueDate', 'latePenalty', 'country'],
    'business-partnership': ['partner1', 'partner2', 'businessName', 'businessType', 'capitalContribution', 'profitSplit', 'decisionMaking', 'duration', 'country'],
    'joint-venture': ['party1', 'party2', 'jvName', 'purpose', 'equitySplit', 'management', 'duration', 'country'],
    'loan-agreement': ['lender', 'borrower', 'loanAmount', 'purpose', 'interestRate', 'repaymentPeriod', 'repaymentSchedule', 'collateral', 'country'],
    'shareholder-agreement': ['companyName', 'shareholders', 'businessDescription', 'dividendPolicy', 'transferRestrictions', 'antiDilution', 'country'],
    'mou': ['party1', 'party2', 'purpose', 'obligations1', 'obligations2', 'binding', 'duration', 'country'],
    'letter-of-intent': ['sender', 'recipient', 'intentType', 'description', 'proposedValue', 'exclusivity', 'country'],
    'distribution-agreement': ['supplier', 'distributor', 'products', 'territory', 'exclusivity', 'minimumPurchase', 'margin', 'duration', 'country'],
    'supply-agreement': ['supplier', 'buyer', 'goods', 'priceStructure', 'unitPrice', 'minimumOrder', 'deliverySchedule', 'qualityStandards', 'duration', 'country'],
    'business-proposal': ['proposingCompany', 'prospectName', 'projectTitle', 'problemStatement', 'proposedSolution', 'deliverables', 'timeline', 'investment', 'whyUs', 'country', 'validityPeriod'],
    'tenancy-agreement': ['landlord', 'tenant', 'property', 'rentAmount', 'duration', 'paymentSchedule', 'cautionDeposit', 'country', 'utilities', 'restrictions'],
    'quit-notice': ['landlord', 'tenant', 'property', 'noticeType', 'noticePeriod', 'vacateDate', 'country'],
    'deed-of-assignment': ['assignor', 'assignee', 'property', 'consideration', 'titleDocument', 'country'],
    'power-of-attorney': ['donor', 'attorney', 'scope', 'propertyDetails', 'duration', 'durationNote', 'country'],
    'landlord-agent-agreement': ['landlord', 'agent', 'property', 'agentScope', 'commission', 'duration', 'country'],
    'facility-manager-agreement': ['propertyOwner', 'facilityManager', 'property', 'services', 'fee', 'duration', 'country', 'liability'],
    'hire-purchase': ['seller', 'buyer', 'asset', 'assetValue', 'deposit', 'installments', 'interestRate', 'country', 'ownershipTransfer', 'defaultClause'],
    'purchase-agreement': ['seller', 'buyer', 'goods', 'purchasePrice', 'paymentMethod', 'deliveryTerms', 'condition', 'warranty', 'country'],
    'data-processing-agreement': ['controllerName', 'processorName', 'dataSubjects', 'dataCategories', 'specialCategoryData', 'processingPurpose', 'processingActivities', 'retentionPeriod', 'subProcessors', 'securityMeasures', 'dataTransfers', 'jurisdiction', 'dpoContact', 'breachNotificationHours'],
  }

  const fields = FIELD_MAPS[docType]
  if (!fields) return res.status(400).json({ error: 'Unsupported document type.' })

  const prompt = `You are a legal document assistant. Extract key terms from the following conversation and return them as a JSON object.

Document type: ${docType}
Fields to extract: ${fields.join(', ')}

Rules:
- Return ONLY a valid JSON object. No explanation, no markdown, no code fences.
- Only include fields where you found clear information in the conversation.
- For fields you cannot determine, omit them entirely (do not include null or empty strings).
- For array fields (checkbox-style like dataCollected, thirdParties, benefits, restrictions, scope, agentScope, services, transferRestrictions, restrictedActivities), return an array of strings.
- For select/radio fields, match the value as closely as possible to a standard option (e.g. for country use "Nigeria" not "Lagos").
- Infer governing law/country from context if strongly implied.
- Be conservative — only extract what is clearly stated. Do not guess.

Conversation:
---
${conversation}
---

Return only the JSON object:`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(500).json({ error: err.error?.message || 'Extraction failed' })
    }

    const data = await response.json()
    const raw = data.content?.[0]?.text?.trim() || ''
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

    let extracted
    try {
      extracted = JSON.parse(clean)
    } catch {
      return res.status(500).json({ error: 'Could not parse extracted terms. Please fill the form manually.' })
    }

    // Only return fields that belong to this docType
    const filtered = {}
    for (const key of fields) {
      if (extracted[key] !== undefined && extracted[key] !== null && extracted[key] !== '') {
        filtered[key] = extracted[key]
      }
    }

    const fieldCount = Object.keys(filtered).length
    return res.status(200).json({
      fields: filtered,
      fieldCount,
      message: fieldCount > 0
        ? `${fieldCount} field${fieldCount > 1 ? 's' : ''} auto-filled — review and adjust before generating`
        : 'Could not extract enough details. Please fill the form manually.',
    })
  } catch (err) {
    console.error('extract-terms error:', err)
    return res.status(500).json({ error: 'Extraction failed. Please fill the form manually.' })
  }
}
