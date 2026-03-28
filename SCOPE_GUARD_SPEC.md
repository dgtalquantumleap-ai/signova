# ═══════════════════════════════════════════════════════════════
# SCOPE GUARD — FEATURE SPECIFICATION
# ═══════════════════════════════════════════════════════════════
# 
# Version: 1.0.0
# Status: Draft
# Last Updated: 2026-03-28
# Author: Ebenova Solutions
# 
# For: GitHub Repository
# Location: SCOPE_GUARD_SPEC.md
# ═══════════════════════════════════════════════════════════════

---

## EXECUTIVE SUMMARY

**Scope Guard** is an AI-powered contract enforcement feature that automatically detects when client requests violate the original agreement and drafts professional responses (change orders or pushback emails). Built into Signova Pro ($19.99/mo), it transforms contract generation from a one-time document into active protection against scope creep.

**Validated by:** Reddit thread (Klauza founder lost $15k due to scope creep), BBVA homework assignment, freelancer community feedback.

**Differentiator:** First contract tool with jurisdiction-specific enforcement across 18 countries.

---

## 1. PROBLEM STATEMENT

Freelancers, agencies, and consultants lose an average of **$15,000+ per year** to scope creep — clients requesting additional work beyond the original agreement through subtle emails, WhatsApp messages, or "quick favors." Current workarounds include manually tracking every request in spreadsheets, having awkward confrontational conversations, or simply absorbing the extra work to preserve the relationship. None of these scale. Scope Guard automates detection and response, turning contract enforcement from a confrontation into a professional, clause-backed process.

**Target Users:**
- Freelancers (developers, designers, writers, consultants)
- Small agencies (2-10 person teams)
- Independent contractors
- Service businesses (cleaning, facility management, logistics)

**Geographic Focus:** Nigeria, Canada, UK, US, Kenya, Ghana, India, UAE (18 total jurisdictions)

---

## 2. USER FLOW

### Step 1: Contract Generation (Existing)
```
User generates freelance contract via Signova
→ Contract includes: scope, deliverables, revisions, timeline, payment terms
→ Contract stored in user's Signova dashboard (new: database storage)
→ User downloads PDF and sends to client
```

### Step 2: Client Request Received
```
Client sends request via email/WhatsApp/Slack:
"Hey, can you also add a blog section to the website? Should be quick!"
"Need 3 more revisions on the logo — almost there!"
"Can we move the deadline up by 2 weeks? Urgent launch."
```

### Step 3: Request Analysis
```
User pastes client message into Scope Guard UI
→ Scope Guard extracts structured request:
   - Request type: ADDITIONAL_WORK
   - Mentioned feature: "blog section"
   - Implied timeline: unspecified
   - Implied cost: unspecified (assumes included)

→ Scope Guard retrieves original contract from database
→ AI compares request vs. contract terms
→ Detects violations:
   ✓ SCOPE: Blog section not in original deliverables
   ✓ TIMELINE: No deadline change clause
   ✓ PAYMENT: No additional compensation mentioned
```

### Step 4: Response Drafting
```
Scope Guard generates 3 response options:

Option A — Friendly Pushback:
"Thanks for reaching out! The blog section wasn't part of our original 
agreement (see Section 2.1: Deliverables). Happy to add it — I'll send 
a separate quote for the additional work."

Option B — Change Order (Recommended):
"I can definitely add the blog section! This is outside our original scope,
so I'm attaching a change order:
- Additional work: Blog section (3 pages, CMS integration)
- Timeline: +5 business days
- Cost: $1,200 USD
Let me know if you'd like to proceed!"

Option C — Contract Reference (Firm):
"Per Section 2.1 of our agreement, the deliverables are limited to the 
5 pages we discussed. Additional features require a change order per 
Section 8.3. I'm happy to provide a quote if you'd like to expand the scope."
```

### Step 5: User Review & Send
```
User selects Option B (Change Order)
→ Customizes if needed
→ Sends via email/WhatsApp
→ Scope Guard logs interaction
→ If client approves, generates change order document
```

---

## 3. TECHNICAL ARCHITECTURE

### 3.1 New API Endpoints

```javascript
// POST /v1/scope/analyze
// Analyzes client request against original contract
{
  "contract_id": "ctr_xxx",           // Original contract from database
  "client_message": "string",         // Client's request text
  "communication_channel": "email"    // email|whatsapp|slack|other
}

// Response
{
  "success": true,
  "violations": [
    {
      "type": "SCOPE",
      "severity": "HIGH",
      "description": "Blog section not in original deliverables",
      "contract_reference": "Section 2.1"
    }
  ],
  "response_options": [
    {
      "type": "CHANGE_ORDER",
      "draft": "Full response text...",
      "recommended": true
    }
  ],
  "suggested_change_order": {
    "additional_work": "Blog section (3 pages, CMS integration)",
    "estimated_hours": 15,
    "suggested_rate": "$80/hour",
    "suggested_cost": "$1,200"
  }
}

// POST /v1/scope/change-order
// Generates formal change order document
{
  "contract_id": "ctr_xxx",
  "additional_work": "string",
  "additional_cost": 1200,
  "timeline_extension_days": 5,
  "jurisdiction": "Nigeria"
}

// GET /v1/scope/history
// Returns scope violation history for user
{
  "success": true,
  "violations_detected": 12,
  "change_orders_sent": 8,
  "additional_revenue": "$9,600"
}
```

### 3.2 Database Schema Changes

```sql
-- New table: contracts
CREATE TABLE contracts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  jurisdiction VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Extracted structured terms (from AI analysis)
  scope_items JSON,           -- Array of deliverables
  revision_limit INT,         -- e.g., 3
  timeline_days INT,          -- e.g., 30
  payment_terms JSON,         -- {amount, currency, schedule}
  ip_ownership VARCHAR(50),   -- "client"|"freelancer"|"shared"
  termination_clause JSON,    -- {notice_days, conditions}
  
  -- Raw document
  document_text TEXT NOT NULL,
  
  -- Metadata
  client_name VARCHAR(100),
  client_email VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active'  -- active|completed|terminated
);

-- New table: scope_violations
CREATE TABLE scope_violations (
  id VARCHAR(36) PRIMARY KEY,
  contract_id VARCHAR(36) NOT NULL,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Violation details
  violation_type VARCHAR(50) NOT NULL,  -- SCOPE|REVISION|TIMELINE|PAYMENT|IP
  severity VARCHAR(20) NOT NULL,        -- LOW|MEDIUM|HIGH
  description TEXT NOT NULL,
  contract_reference VARCHAR(100),      -- "Section 2.1"
  
  -- Client request
  client_message TEXT,
  communication_channel VARCHAR(20),
  
  -- Response
  response_type VARCHAR(50),            -- PUSHBACK|CHANGE_ORDER|FIRM
  response_sent BOOLEAN DEFAULT FALSE,
  change_order_id VARCHAR(36),          -- If generated
  
  -- Outcome
  client_accepted BOOLEAN,
  additional_revenue DECIMAL(10,2),
  
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

-- Index for fast lookups
CREATE INDEX idx_contracts_user ON contracts(user_id);
CREATE INDEX idx_violations_contract ON scope_violations(contract_id);
```

### 3.3 AI/LLM Integration

```javascript
// Uses Anthropic Claude API (same as document generation)
// Model: claude-sonnet-4-5 (fast, accurate for legal text)

const ANALYSIS_PROMPT = `You are a contract enforcement AI. Compare this client request against the original contract and identify violations.

ORIGINAL CONTRACT (extracted terms):
${JSON.stringify(contractTerms, null, 2)}

CLIENT REQUEST:
"${clientMessage}"

COMMUNICATION CHANNEL: ${channel}

TASK:
1. Identify all violations (scope, revisions, timeline, payment, IP)
2. For each violation, cite the specific contract section
3. Assess severity (LOW|MEDIUM|HIGH)
4. Draft 3 response options (friendly, change order, firm)
5. Suggest appropriate additional cost if change order warranted

JURISDICTION: ${jurisdiction}
Apply jurisdiction-specific norms for pricing and enforcement.

Output JSON only (no markdown):
{
  "violations": [...],
  "response_options": [...],
  "suggested_change_order": {...}
}`;

// Response parsing
// AI returns structured JSON with violations and drafts
```

### 3.4 Frontend Changes

```
New UI Components:

1. Scope Guard Dashboard (/dashboard/scope-guard)
   - List of active contracts
   - Violation history
   - Additional revenue tracked
   - Quick paste input for client messages

2. Contract Detail View
   - Original contract terms (structured)
   - Timeline of all client requests
   - Violations detected
   - Change orders sent

3. Scope Guard Modal (popup)
   - Paste client message
   - See analysis results
   - Select response option
   - Send or customize

4. Change Order Generator
   - Pre-filled from AI suggestion
   - Editable fields
   - Generate PDF
   - Send to client
```

---

## 4. VIOLATION DETECTION RULES

### 4.1 Scope Violations

**Detection Pattern:**
- Client mentions new feature/deliverable not in original scope
- Keywords: "also", "additionally", "can you also", "while you're at it"
- Implies work outside agreed deliverables

**Example:**
```
Contract: 5-page website (Home, About, Services, Portfolio, Contact)
Client: "Can you add a blog section with categories?"
Violation: SCOPE — Blog not in original deliverables
Severity: HIGH
```

**Jurisdiction-Specific:**
- **Nigeria:** Cite Lagos State Contract Law — "Variations require written agreement"
- **Canada:** Cite Alberta Contract Law — "Mutual consent for material changes"
- **US:** Cite California Labor Code — "Additional work requires additional compensation"
- **UK:** Cite UK Contract Law — "Consideration required for contract modifications"

---

### 4.2 Revision Violations

**Detection Pattern:**
- Client requests revision #4 when contract allows 3
- Keywords: "one more round", "final revision", "just one more thing"
- Cumulative count exceeds limit

**Example:**
```
Contract: 3 rounds of revisions included
Client: "Need one final revision on the logo" (4th request)
Violation: REVISION — Exceeds agreed limit
Severity: MEDIUM
```

**Response:**
"Per Section 4.2, your contract includes 3 revision rounds. We've completed all 3. 
Additional revisions are billed at $75/hour. This revision is estimated at 2 hours ($150). 
Shall I proceed?"

---

### 4.3 Timeline Violations

**Detection Pattern:**
- Client requests earlier deadline
- Keywords: "sooner", "earlier", "rush", "urgent", "can we move up"
- Implies compressed timeline without adjustment

**Example:**
```
Contract: 30-day delivery (March 1 - March 30)
Client: "Can we launch by March 15? Urgent opportunity."
Violation: TIMELINE — 15-day compression requested
Severity: HIGH
```

**Response:**
"Moving the deadline from March 30 to March 15 requires rush prioritization. 
Rush fee: 50% surcharge ($2,400 additional). 
Alternatively, we can phase the launch — core pages by March 15, remaining by March 30. 
Which would you prefer?"

---

### 4.4 Payment Violations

**Detection Pattern:**
- Client requests additional work without mentioning payment
- Keywords: "as a favor", "quick task", "should be easy", "no extra budget"
- Implies free additional work

**Example:**
```
Contract: Fixed price $8,000 for defined scope
Client: "Can you also set up email templates? Should be quick!"
Violation: PAYMENT — Uncompensated additional work
Severity: HIGH
```

**Response:**
"I understand this feels like a quick task, but email template setup is outside our 
agreed scope. My rate for additional work is $80/hour, and this is estimated at 5 hours 
($400). I'm happy to provide a formal change order if you'd like to proceed."

---

### 4.5 IP Violations

**Detection Pattern:**
- Client requests full IP transfer without compensation
- Keywords: "we want ownership", "transfer rights", "work for hire"
- Attempts to change IP terms post-agreement

**Example:**
```
Contract: Freelancer retains IP, client gets usage license
Client: "We need full ownership of all deliverables."
Violation: IP — Ownership transfer request
Severity: CRITICAL
```

**Response:**
"Per Section 9.1 of our agreement, I retain IP ownership and grant you an exclusive 
usage license. Full IP transfer requires a buyout fee (typically 2-3x the project value). 
For this project, IP buyout would be $24,000. This is non-negotiable per my standard 
terms. Happy to discuss if you have concerns about your usage rights."

---

## 5. AUTO-RESPONSE TEMPLATES

### Template 1: Friendly Pushback (Relationship-First)

```
Subject: Re: {Project Name} — Additional Request

Hi {Client Name},

Thanks for reaching out! I'm excited about the direction this is going.

The {requested feature} wasn't part of our original agreement (see Section {X.X}: 
Deliverables), but I'm happy to help with it.

To keep things clear and professional, I'll send over a separate quote for the 
additional work. This ensures we both have a written record of the expanded scope 
and any associated costs.

Expect the quote within {timeframe}. Let me know if you have any questions!

Best,
{Freelancer Name}
```

**Use When:** First violation, good relationship, low severity

---

### Template 2: Change Order (Recommended)

```
Subject: Change Order #{Number} — {Project Name}

Hi {Client Name},

I can definitely help with {requested feature}!

Since this is outside our original scope, I'm attaching a change order for your review:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE ORDER #{Number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Additional Work: {Detailed description}
Timeline Impact: +{X} business days
Investment: ${Amount} {Currency}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This ensures we both have a clear record of the expanded scope and delivery timeline.

If you approve, please reply with "I approve Change Order #{Number}" and I'll get started 
immediately.

Questions? Happy to hop on a quick call to discuss.

Best,
{Freelancer Name}
```

**Use When:** Standard scope creep, client is reasonable, medium-high severity

---

### Template 3: Contract Reference (Firm)

```
Subject: Re: {Project Name} — Scope Clarification

Hi {Client Name},

I appreciate you reaching out about {requested feature}.

Per Section {X.X} of our signed agreement, the deliverables are limited to:
- {Deliverable 1}
- {Deliverable 2}
- {Deliverable 3}

The {requested feature} you've mentioned is not included in the above scope.

Per Section {Y.Y} (Contract Modifications), any additional work requires:
1. Written change order
2. Mutual agreement on cost and timeline
3. Signature from both parties

I'm happy to provide a quote for the additional work if you'd like to expand the scope. 
Otherwise, we'll proceed with the original deliverables as agreed.

Let me know how you'd like to proceed.

Best,
{Freelancer Name}
```

**Use When:** Repeat violator, high severity, need to set boundaries

---

### Template 4: Jurisdiction-Specific (Legal Weight)

```
Subject: Re: {Project Name} — Contract Enforcement Notice

Hi {Client Name},

I'm writing in response to your request for {requested feature}.

Per our signed agreement dated {Date}, governed by {Jurisdiction} law, the scope of 
work is defined in Section {X.X} as:

"{Exact contract language}"

Your request constitutes a material modification to the contract. Under {Jurisdiction} 
Contract Law §{Specific Section}, material modifications require:
- Written consent from both parties
- Additional consideration (compensation)
- Clear terms of the modification

I'm happy to accommodate your request through a formal change order process. 
Please let me know if you'd like to proceed.

Best regards,
{Freelancer Name}

CC: {Legal Counsel, if applicable}
```

**Use When:** Critical violations, jurisdiction-specific enforcement, legal escalation risk

---

## 6. PRICING TIER INTEGRATION

### Current Tiers (Updated)

| Tier | Price | Documents/Month | Scope Guard | Features |
|------|-------|-----------------|-------------|----------|
| **Free** | $0 | 5 | ❌ | Basic document generation |
| **Starter** | $29/mo | 100 | ❌ | All documents, email support |
| **Pro** | $19.99/mo | 500 | ✅ | Scope Guard, contract storage, violation detection |
| **Scale** | $79/mo | 2,000 | ✅ | Scope Guard + priority support, API access |
| **Enterprise** | $199/mo | Custom | ✅ | Scope Guard + custom enforcement, dedicated support |

**Note:** Pro tier price increased from $9.99 → $19.99/mo to reflect Scope Guard value

---

### Tier Feature Matrix

| Feature | Free | Starter | Pro | Scale | Enterprise |
|---------|------|---------|-----|-------|------------|
| Document Generation | ✅ 5/mo | ✅ 100/mo | ✅ 500/mo | ✅ 2k/mo | ✅ Custom |
| Contract Storage | ❌ | ❌ | ✅ 50 contracts | ✅ 200 contracts | ✅ Unlimited |
| Scope Guard Analysis | ❌ | ❌ | ✅ 20/mo | ✅ 100/mo | ✅ Unlimited |
| Change Order Generation | ❌ | ❌ | ✅ | ✅ | ✅ |
| Violation History | ❌ | ❌ | ✅ 30 days | ✅ 1 year | ✅ Unlimited |
| Jurisdiction Enforcement | ❌ | ❌ | ✅ 5 countries | ✅ 12 countries | ✅ All 18 |
| Revenue Tracking | ❌ | ❌ | ✅ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ❌ | ✅ | ✅ |

---

### Upgrade Path (Starter → Pro)

**Trigger Events:**
1. User generates 3+ contracts in 30 days (active freelancer)
2. User mentions "scope creep" or "client asked for more" in support email
3. User views freelance contract page 3+ times
4. User clicks "change order" link in blog post

**In-App Messaging:**
```
🎯 Scope Guard Alert

You've generated 5 freelance contracts this month. 
Scope Guard would have detected 3 scope violations 
and helped you collect an estimated $2,400 in additional revenue.

Upgrade to Pro ($19.99/mo) to activate Scope Guard.
[See How It Works] [Upgrade Now]
```

---

## 7. JURISDICTION-SPECIFIC ENFORCEMENT

### 7.1 Supported Jurisdictions (18 Countries)

**Africa:**
- Nigeria (Lagos State Tenancy Law, Nigerian Contract Act)
- Kenya (Kenya Contract Law)
- Ghana (Ghana Contract Law)
- South Africa (South African Contract Law)
- Tanzania, Uganda, Ethiopia, Senegal, Ivory Coast, Cameroon

**North America:**
- United States (California Labor Code, US Freelance Standards)
- Canada (Alberta Contract Law, Ontario Freelance Protections)

**Europe:**
- United Kingdom (UK Contract Law, UK Freelance Standards)
- Germany, France, Italy, Spain, Netherlands, Portugal (EU Contract Directives)

**Middle East:**
- UAE (UAE Contract Law, Dubai Freelance Regulations)
- Saudi Arabia (Saudi Contract Law)

**Asia:**
- India (Indian Contract Act 1872)
- Singapore (Singapore Contract Law)
- Philippines, Indonesia, Malaysia

---

### 7.2 Jurisdiction Rules Engine

```javascript
// lib/jurisdiction-rules.js

const JURISDICTION_RULES = {
  Nigeria: {
    contract_law: "Lagos State Tenancy Law 2011",
    freelance_protection: "Nigerian Freelance Protection Act (draft)",
    enforcement_strength: "MEDIUM",
    typical_rates: {
      web_development: "₦150,000 - ₦500,000",
      design: "₦100,000 - ₦300,000",
      writing: "₦50,000 - ₦150,000"
    },
    change_order_requirements: ["Written agreement", "Both parties sign"],
    statute_of_limitations: "6 years for breach of contract"
  },
  
  Canada: {
    contract_law: "Alberta Contract Law",
    freelance_protection: "Freelance Protection Act (Ontario)",
    enforcement_strength: "HIGH",
    typical_rates: {
      web_development: "CA$5,000 - CA$20,000",
      design: "CA$3,000 - CA$10,000",
      writing: "CA$1,500 - CA$5,000"
    },
    change_order_requirements: ["Written consent", "Consideration required"],
    statute_of_limitations: "2 years for breach of contract"
  },
  
  US: {
    contract_law: "California Labor Code",
    freelance_protection: "California Freelance Worker Protection Act",
    enforcement_strength: "HIGH",
    typical_rates: {
      web_development: "$5,000 - $30,000",
      design: "$3,000 - $15,000",
      writing: "$2,000 - $10,000"
    },
    change_order_requirements: ["Written agreement", "Clear consideration"],
    statute_of_limitations: "4 years for written contracts (California)"
  },
  
  UK: {
    contract_law: "UK Contract Law 1999",
    freelance_protection: "UK Freelance Sector Standards",
    enforcement_strength: "HIGH",
    typical_rates: {
      web_development: "£4,000 - £25,000",
      design: "£2,500 - £12,000",
      writing: "£1,500 - £8,000"
    },
    change_order_requirements: ["Written variation", "Mutual consent"],
    statute_of_limitations: "6 years for breach of contract"
  }
  
  // ... 14 more jurisdictions
}

// Usage in analysis
function getJurisdictionRules(jurisdiction) {
  return JURISDICTION_RULES[jurisdiction] || JURISDICTION_RULES.US;
}

function suggestRate(jurisdiction, workType) {
  const rules = getJurisdictionRules(jurisdiction);
  return rules.typical_rates[workType] || "Market rate";
}
```

---

### 7.3 Jurisdiction-Specific Response Examples

**Nigeria:**
```
"Per Section 2.1 of our agreement and the Lagos State Tenancy Law 2011, 
variations to the original scope require written consent from both parties. 
I'm happy to provide a change order for your review."
```

**Canada:**
```
"Under Alberta Contract Law and the Freelance Protection Act (Ontario), 
material changes to the contract require mutual consent and additional 
consideration. I'll send over a change order reflecting the expanded scope."
```

**US (California):**
```
"Per California Labor Code and our signed agreement, additional work 
requires a written change order with clear compensation terms. 
I'm attaching Change Order #3 for your approval."
```

**UK:**
```
"Under UK Contract Law 1999, contract variations require written agreement 
from both parties. Per Section 8.3 of our agreement, I'm providing a 
formal change order for the additional work."
```

---

## 8. LAUNCH TIMELINE

### Phase 1: MVP (2 Weeks) — "Basic Detection"

**Goals:**
- Basic violation detection (scope only)
- 1 response template (change order)
- Manual contract upload
- Single jurisdiction (Nigeria)

**Deliverables:**
```
Week 1:
- Database schema (contracts, scope_violations tables)
- POST /v1/scope/analyze endpoint (basic AI comparison)
- Simple UI: paste message → see violation

Week 2:
- Change order generation (PDF)
- Email sending integration
- Basic dashboard (violation history)
- Internal testing with 5 beta users
```

**Success Criteria:**
- ✅ Detects scope violations with 80% accuracy
- ✅ Generates change order PDF
- ✅ 5 beta users send 10+ change orders

---

### Phase 2: V1 Launch (4 Weeks) — "Full Violation Detection"

**Goals:**
- All 5 violation types (scope, revision, timeline, payment, IP)
- 4 response templates
- 5 jurisdictions (Nigeria, Canada, US, UK, Kenya)
- Signova Pro integration

**Deliverables:**
```
Week 3-4:
- Revision, timeline, payment, IP detection rules
- 4 response templates (friendly, change order, firm, legal)
- Jurisdiction rules engine (5 countries)
- Contract extraction AI (parse uploaded PDFs)

Week 5-6:
- Signova Pro tier integration ($19.99/mo)
- Upgrade flow (Starter → Pro)
- Revenue tracking dashboard
- Marketing page (Scope Guard landing page)

Week 7-8:
- Beta launch (50 users)
- Collect feedback
- Iterate on AI accuracy
```

**Success Criteria:**
- ✅ 85% violation detection accuracy (all types)
- ✅ 50 beta users, 20% conversion to Pro
- ✅ $5,000+ additional revenue tracked for users

---

### Phase 3: V2 (8 Weeks) — "AI Learning & Jurisdiction Expansion"

**Goals:**
- AI learns from user feedback (thumbs up/down on responses)
- 12 jurisdictions
- WhatsApp/Slack integration
- Mobile app (iOS/Android)

**Deliverables:**
```
Week 9-12:
- Feedback loop (user rates AI responses)
- AI model fine-tuning (improve accuracy)
- Jurisdiction expansion (12 countries total)
- WhatsApp Business API integration

Week 13-16:
- Slack app (paste message → get analysis)
- Mobile app (React Native)
- Advanced analytics (revenue projections)
- Public launch (Product Hunt, Hacker News)
```

**Success Criteria:**
- ✅ 92% violation detection accuracy
- ✅ 200 Pro subscribers
- ✅ $50,000+ additional revenue tracked
- ✅ Featured on Product Hunt (#1 Product of the Day)

---

## 9. SUCCESS METRICS

### 9.1 Adoption Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| % of users who enable Scope Guard | 40% of Pro users | Dashboard analytics |
| % of Pro users (from Starter) | 25% conversion | Stripe subscription data |
| Active contracts stored | 50 per Pro user | Database count |
| Violations detected per month | 5 per active user | scope_violations table |

---

### 9.2 Accuracy Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Violation detection accuracy | 90%+ | User feedback (thumbs up/down) |
| False positive rate | <5% | User reports "not a violation" |
| Response helpfulness | 4.5/5 stars | User ratings |
| Change order acceptance rate | 60%+ | Client approvals tracked |

---

### 9.3 Time Savings

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time saved per violation | 30 minutes | User survey (pre/post) |
| Time saved per week | 2 hours | Monthly user survey |
| Response drafting time | <2 minutes | Analytics (paste → send) |
| Contract review time | 50% reduction | User survey |

---

### 9.4 Revenue Impact

| Metric | Target | Measurement |
|--------|--------|-------------|
| Additional revenue per user | $2,000/year | Tracked change orders |
| Pro tier MRR | $20,000/mo (1,000 users) | Stripe dashboard |
| Churn reduction | 30% lower than Starter | Cohort analysis |
| LTV increase | 2x vs. Starter tier | Lifetime value calculation |

---

### 9.5 Customer Satisfaction

| Metric | Target | Measurement |
|--------|--------|-------------|
| NPS (Net Promoter Score) | 50+ | Quarterly survey |
| CSAT (Customer Satisfaction) | 4.5/5 | Post-interaction survey |
| Support tickets | <5% of users | Help desk data |
| Feature requests | Track top 10 | User feedback dashboard |

---

## 10. RISKS & MITIGATION

### Risk 1: AI Misidentifies Violations

**Impact:** High (users lose trust, potential legal issues)

**Mitigation:**
- Human-in-the-loop (user confirms before sending)
- Confidence scores on all detections
- Easy "report incorrect detection" button
- Continuous AI training on user feedback

---

### Risk 2: Jurisdiction-Specific Advice Seen as Legal Advice

**Impact:** Critical (unauthorized practice of law)

**Mitigation:**
- Clear disclaimers: "Not legal advice"
- Partner with local law firms for review
- Limit to "contract enforcement" not "legal representation"
- Terms of service explicitly state informational purpose only

---

### Risk 3: Clients Feel Confronted by Automated Responses

**Impact:** Medium (relationship damage)

**Mitigation:**
- Default to friendly tone (user can select firm if needed)
- Customization before sending (user edits draft)
- Training on "how to have the conversation"
- Emphasize relationship preservation in templates

---

### Risk 4: Users Don't Store Contracts in System

**Impact:** High (Scope Guard can't work without contracts)

**Mitigation:**
- Auto-save all Signova-generated contracts
- Easy upload for external contracts (drag & drop)
- Incentive: "Store 3 contracts → unlock Scope Guard trial"
- Integration: Gmail/Outlook plugin to auto-save contract emails

---

## 11. COMPETITIVE LANDSCAPE

### Direct Competitors

| Competitor | Pricing | Scope Detection | Jurisdiction Support | Differentiator |
|------------|---------|-----------------|---------------------|----------------|
| **Scope Guard** | $19.99/mo | ✅ AI-powered | ✅ 18 countries | First with jurisdiction enforcement |
| Hello Bonsai | $19/mo | ❌ Manual only | ❌ US only | All-in-one freelancer OS |
| And Co | Free | ❌ None | ❌ Generic | Basic contract templates |
| ContractWorks | $99/mo | ❌ Enterprise only | ❌ US/EU | Enterprise contract management |
| PandaDoc | $19/mo | ❌ None | ❌ Generic | Document e-signature focus |

**Scope Guard Advantages:**
- ✅ Only AI-powered violation detection
- ✅ Only jurisdiction-specific enforcement
- ✅ Only integrated with document generation
- ✅ Only affordable for freelancers ($19.99 vs. $99+)

---

## 12. OPEN QUESTIONS

### Technical Questions
1. **Storage:** Use Supabase (PostgreSQL) or Upstash (Redis + vector)?
   - leaning toward: Supabase for structured contract data

2. **AI Model:** Continue with Claude or fine-tune open-source model?
   - leaning toward: Claude for accuracy, fine-tune later

3. **Frontend:** React component or separate dashboard app?
   - leaning toward: Integrated React component in Signova dashboard

---

### Business Questions
1. **Pricing:** $19.99/mo or $29/mo for Pro tier?
   - leaning toward: $19.99 (psychological barrier at $20)

2. **Jurisdictions:** Launch with 5 or 18 countries?
   - leaning toward: 5 for MVP, expand based on demand

3. **Enforcement:** Partner with law firms for escalation?
   - leaning toward: Yes, revenue share model

---

### Legal Questions
1. **Disclaimer:** What exact language protects us from "unauthorized practice of law"?
   - leaning toward: "Informational only, not legal advice. Consult attorney for legal matters."

2. **Liability:** What if AI gives wrong advice and user loses money?
   - leaning toward: Terms of service limit liability to subscription fee paid

---

## 13. NEXT STEPS

### Immediate (This Week)
- [ ] Review this spec with team
- [ ] Validate technical feasibility with dev team
- [ ] Create database schema (Supabase project)
- [ ] Set up Anthropic API for testing

### Short-Term (2 Weeks)
- [ ] Build MVP: POST /v1/scope/analyze endpoint
- [ ] Create basic UI (paste → analyze → response)
- [ ] Test with 5 beta users (Klauza, CrossMind, Some_Phrase)
- [ ] Collect feedback on violation detection accuracy

### Medium-Term (4 Weeks)
- [ ] Implement all 5 violation types
- [ ] Create 4 response templates
- [ ] Integrate with Signova Pro tier
- [ ] Launch beta waitlist page

### Long-Term (8 Weeks)
- [ ] Expand to 12 jurisdictions
- [ ] Build WhatsApp/Slack integrations
- [ ] Launch on Product Hunt
- [ ] Target: 200 Pro subscribers

---

## APPENDIX A: SAMPLE CONTRACT EXTRACTION

### Input Contract (Freelance Web Development)

```
FREELANCE WEB DEVELOPMENT AGREEMENT

This Agreement is entered into on March 1, 2026, between:
Freelancer: John Doe ("Developer")
Client: Acme Inc. ("Client")

1. SCOPE OF WORK
Developer agrees to create a 5-page website for Client:
- Home page
- About page
- Services page (3 services listed)
- Portfolio page (6 projects)
- Contact page with form

2. REVISIONS
Client is entitled to 3 rounds of revisions per page.
Additional revisions billed at $75/hour.

3. TIMELINE
Project completion: 30 business days from start date.
Start date: March 1, 2026
Expected delivery: March 30, 2026

4. PAYMENT
Total fee: $8,000 USD
50% deposit: $4,000 (due upon signing)
50% final: $4,000 (due upon completion)

5. INTELLECTUAL PROPERTY
Developer retains ownership of all work.
Client receives exclusive, perpetual usage license.

6. ADDITIONAL WORK
Any work outside this scope requires written change order.
Change orders must specify additional cost and timeline.
```

### Extracted JSON (Stored in Database)

```json
{
  "contract_id": "ctr_abc123",
  "user_id": "usr_xyz789",
  "document_type": "freelance-contract",
  "jurisdiction": "Nigeria",
  "scope_items": [
    "Home page",
    "About page",
    "Services page (3 services)",
    "Portfolio page (6 projects)",
    "Contact page with form"
  ],
  "revision_limit": 3,
  "timeline_days": 30,
  "payment_terms": {
    "total": 8000,
    "currency": "USD",
    "schedule": [
      {"milestone": "deposit", "amount": 4000, "due": "upon signing"},
      {"milestone": "final", "amount": 4000, "due": "upon completion"}
    ]
  },
  "ip_ownership": "freelancer",
  "termination_clause": {
    "notice_days": null,
    "conditions": []
  },
  "additional_work_clause": "Any work outside this scope requires written change order. Change orders must specify additional cost and timeline."
}
```

---

## APPENDIX B: SAMPLE VIOLATION ANALYSIS

### Client Request

```
Subject: Quick addition to the website

Hi John,

Hope the project is going well!

Can you also add a blog section to the website? We're launching a content 
marketing push and need it to go live with the rest of the site.

Should be pretty quick — just a blog index page and individual post templates. 
We'll handle all the content writing.

Also, our CEO wants to launch 2 weeks early (March 16 instead of March 30). 
Is that possible?

Thanks!
Sarah
```

### Scope Guard Analysis

```json
{
  "violations": [
    {
      "type": "SCOPE",
      "severity": "HIGH",
      "description": "Blog section (index + post templates) not in original deliverables",
      "contract_reference": "Section 1: Scope of Work"
    },
    {
      "type": "TIMELINE",
      "severity": "HIGH",
      "description": "Client requests 14-day acceleration (30 days → 16 days)",
      "contract_reference": "Section 3: Timeline"
    }
  ],
  "response_options": [
    {
      "type": "FRIENDLY",
      "draft": "Hi Sarah, Thanks for reaching out! The blog section wasn't part of our original agreement (see Section 1: Scope), but I'm happy to add it. I'll send over a separate quote for the additional work and timeline adjustment. Expect it within 24 hours! Best, John",
      "recommended": false
    },
    {
      "type": "CHANGE_ORDER",
      "draft": "Hi Sarah, I can definitely add the blog section and explore the early launch! Since both are outside our original agreement, I'm attaching Change Order #1:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCHANGE ORDER #1\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nAdditional Work: Blog section (index page + post templates, CMS integration)\nTimeline Impact: -14 days (rush delivery)\nInvestment: $3,200 USD\n  - Blog development: $2,000\n  - Rush fee (50%): $1,200\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nIf you approve, please reply with 'I approve Change Order #1' and I'll get started immediately. Best, John",
      "recommended": true
    },
    {
      "type": "FIRM",
      "draft": "Hi Sarah, Per Section 1 and Section 3 of our agreement, the blog section and early launch are outside the agreed scope and timeline. Per Section 6, additional work requires a written change order with specified cost and timeline. I'm happy to provide a quote if you'd like to proceed. Otherwise, we'll continue with the original deliverables and March 30 deadline. Best, John",
      "recommended": false
    }
  ],
  "suggested_change_order": {
    "additional_work": "Blog section (index page + post templates, CMS integration)",
    "timeline_impact": "-14 days (rush delivery)",
    "estimated_hours": 25,
    "suggested_rate": "$80/hour",
    "base_cost": "$2,000",
    "rush_surcharge": "$1,200 (50% of base)",
    "total_cost": "$3,200"
  },
  "jurisdiction_note": "Under Nigerian Contract Law, material changes require written consent from both parties. This change order satisfies that requirement."
}
```

---

## APPENDIX C: TEAM & RESOURCES

### Development Team Required
- 1 Full-stack developer (React, Node.js, PostgreSQL)
- 1 AI/ML engineer (prompt engineering, fine-tuning)
- 1 Legal consultant (jurisdiction-specific review)
- 1 Product manager (you)

### Estimated Development Cost
- MVP (2 weeks): $10,000
- V1 (4 weeks): $25,000
- V2 (8 weeks): $60,000

### Infrastructure Costs (Monthly)
- Supabase (PostgreSQL): $25/mo
- Anthropic API (Claude): $500/mo (scales with usage)
- Vercel hosting: $20/mo
- Total: ~$545/mo

### Break-Even Analysis
- At $19.99/mo Pro tier
- Need: 28 Pro users to cover infrastructure
- Target: 1,000 Pro users = $20,000 MRR
- Profit margin: 97%

---

## CONCLUSION

Scope Guard transforms Signova from a **document generator** into an **active contract enforcement platform**. By detecting violations early and drafting professional responses, it helps freelancers and agencies collect an estimated **$2,000-$15,000 per year** in additional revenue they would have otherwise lost to scope creep.

The feature is technically feasible (builds on existing AI infrastructure), commercially viable (28 users break-even), and legally defensible (informational only, not legal advice).

**Recommendation:** Proceed with MVP development. Launch beta in 4 weeks. Target 50 beta users. Iterate based on feedback. Full launch in 8 weeks.

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-03-28  
**Author:** Ebenova Solutions  
**Status:** Draft — Ready for Review
