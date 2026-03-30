# Scope Guard API — Beta Testing Guide

Welcome to the Scope Guard API beta! This guide will help you test the scope violation detection and change order generation features.

## Prerequisites

1. **API Key**: You need an active Ebenova API key on the Growth, Scale, or Enterprise plan
   - Sign up: https://api.ebenova.dev/dashboard
   - Upgrade to Growth plan: $79/month

2. **Authorization**: Include your API key in all requests:
   ```
   Authorization: Bearer sk_live_xxxxxxxx...
   ```

## Endpoint 1: Scope Analysis

Analyzes a client message against a contract to detect scope violations.

**Endpoint:** `POST https://api.ebenova.dev/v1/scope/analyze`

**Required Fields:**
- `contract_text` (string, min 50 chars) — The original contract/agreement
- `client_message` (string, min 5 chars) — The client request to analyze

**Optional Fields:**
- `communication_channel` (string) — Where the request came from: `email`, `slack`, `phone`, `in-person`. Default: `email`

**Example Request:**
```bash
curl -X POST https://api.ebenova.dev/v1/scope/analyze \
  -H "Authorization: Bearer sk_live_xxxxxxxx..." \
  -H "Content-Type: application/json" \
  -d '{
    "contract_text": "FREELANCE AGREEMENT\n\nScope: Build 5-page website with contact form and blog\nTimeline: 4 weeks\nRevisions: 2 rounds included (content changes only)\nPayment: $3,000 total\nNotes: Design changes outside original scope will be billed separately",
    "client_message": "Can you also add an e-commerce shopping cart, inventory integration, and mobile app version? Need it in 2 weeks.",
    "communication_channel": "email"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "violation_detected": true,
  "violations": [
    {
      "type": "SCOPE",
      "severity": "HIGH",
      "description": "Client requesting shopping cart and inventory system (not in original scope)",
      "contract_reference": "Original Scope section",
      "client_claim": "Adding e-commerce functionality"
    },
    {
      "type": "REVISION",
      "severity": "HIGH",
      "description": "Client wants mobile app version (2 rounds of revisions for web only were included)",
      "contract_reference": "Revisions clause",
      "client_claim": "Mobile app version needed"
    },
    {
      "type": "TIMELINE",
      "severity": "HIGH",
      "description": "2-week timeline impossible for original 4-week scope plus 3 new features",
      "contract_reference": "Timeline section",
      "client_claim": "Need in 2 weeks"
    }
  ],
  "response_options": [
    {
      "type": "PUSHBACK",
      "label": "Friendly Pushback",
      "draft": "Hi [Client], Thanks for the feature requests! The shopping cart, inventory integration, and mobile app are exciting additions, but they fall outside the original scope of our agreement. Our original timeline for the 5-page website is 4 weeks...",
      "recommended": false
    },
    {
      "type": "CHANGE_ORDER",
      "label": "Propose Change Order",
      "draft": "Hi [Client], I'm excited about these additions! To move forward, I'd like to propose a change order that outlines: 1) E-commerce shopping cart (platform: Stripe/PayPal) 2) Inventory integration using [their system]...",
      "recommended": true
    },
    {
      "type": "FIRM",
      "label": "Firm Contract Reference",
      "draft": "Hi [Client], I appreciate the feature requests. Our signed agreement specifies: Scope: 5-page website with contact form, 2 rounds of revisions (content changes). The shopping cart, inventory system, and mobile app were not part of our original agreement...",
      "recommended": false
    }
  ],
  "suggested_change_order": {
    "applicable": true,
    "additional_work_description": "E-commerce shopping cart ($500), Inventory integration ($400), Mobile app build ($2,500)",
    "estimated_hours": 80,
    "suggested_rate_usd": 80,
    "suggested_cost_usd": 3400,
    "timeline_extension_days": 14,
    "notes": "These additions significantly expand scope. E-commerce and mobile are substantial features."
  },
  "summary": "Client requesting 3 major features (e-commerce, inventory sync, mobile app) not in original scope. Recommend change order with pricing.",
  "usage": {
    "documents_used: 2,
    "documents_remaining": 3,
    "monthly_limit": 5
  }
}
```

**Response Fields:**
- `violation_detected` — Whether any violations were found
- `violations` — Array of detected violations with type, severity, and description
- `response_options` — Three professional response options (PUSHBACK, CHANGE_ORDER, FIRM)
- `suggested_change_order` — Recommended pricing and timeline adjustment if applicable
- `summary` — Brief summary of what was detected
- `usage` — Your API usage stats for this month

---

## Endpoint 2: Change Order Generation

Generates a formal change order document based on the additional work details.

**Endpoint:** `POST https://api.ebenova.dev/v1/scope/change-order`

**Required Fields:**
- `additional_work` (string) — Description of additional work
- `additional_cost` (number) — Cost in USD
- `freelancer_name` (string, optional) — Your name/company
- `client_name` (string, optional) — Client name

**Optional Fields:**
- `original_contract_summary` (string) — Brief summary of original agreement
- `currency` (string) — Currency code. Default: `USD`
- `timeline_extension_days` (number) — Days to extend timeline
- `jurisdiction` (string) — Governing law. Default: `International`
- `contract_date` (string) — Original contract date
- `change_order_number` (number) — Which change order is this

**Example Request:**
```bash
curl -X POST https://api.ebenova.dev/v1/scope/change-order \
  -H "Authorization: Bearer sk_live_xxxxxxxx..." \
  -H "Content-Type: application/json" \
  -d '{
    "freelancer_name": "Jane Smith Design",
    "client_name": "Acme Corp",
    "additional_work": "Build e-commerce shopping cart using Stripe, integrate with existing inventory system via API, create mobile-responsive design for iOS and Android",
    "additional_cost": 3400,
    "currency": "USD",
    "timeline_extension_days": 14,
    "jurisdiction": "United States",
    "original_contract_summary": "5-page website with contact form and blog, 2 rounds of revisions"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "document": "CHANGE ORDER #1\n\nThis Change Order is entered into as of [DATE] between:\n\nFREELANCER/SERVICE PROVIDER: Jane Smith Design\nCLIENT: Acme Corp\n\nREFERENCE TO ORIGINAL AGREEMENT:\nOriginal Scope: 5-page website with contact form and blog, 2 rounds of revisions\nOriginal Agreement Date: [DATE]\n\nADDITIONAL SCOPE OF WORK:\n1. E-commerce shopping cart implementation using Stripe payment processing\n2. Inventory system API integration connecting to client's existing backend\n3. Mobile-responsive design optimization for iOS and Android devices\n\nADDITIONAL COMPENSATION: $3,400 USD\n\nTIMELINE EXTENSION: 14 business days beyond original delivery date\n\nPAYMENT TERMS:\n- 50% upon approval of this change order\n- 50% upon final delivery\n\n[Continues with legal language, signature blocks, and jurisdiction clauses]",
  "change_order_details": {
    "freelancer_name": "Jane Smith Design",
    "client_name": "Acme Corp",
    "additional_work": "Build e-commerce shopping cart using Stripe, integrate with existing inventory system via API, create mobile-responsive design for iOS and Android",
    "additional_cost": 3400,
    "currency": "USD",
    "timeline_extension_days": 14,
    "jurisdiction": "United States",
    "generated_at": "2026-03-29T12:30:00.000Z"
  },
  "usage": {
    "documents_used": 3,
    "documents_remaining": 2,
    "monthly_limit": 5
  }
}
```

---

## Endpoint 3: Scope Guard Statistics

Get your Scope Guard usage metrics for the current and previous months.

**Endpoint:** `GET https://api.ebenova.dev/v1/scope/stats`

**Example Request:**
```bash
curl https://api.ebenova.dev/v1/scope/stats \
  -H "Authorization: Bearer sk_live_xxxxxxxx..."
```

**Example Response:**
```json
{
  "success": true,
  "current_month": {
    "analyze_calls": 12,
    "change_orders_generated": 3,
    "violations_detected": 8,
    "response_breakdown": {
      "firm_responses": 2,
      "pushback_responses": 4,
      "change_order_responses": 3
    }
  },
  "history": [
    {
      "month": "2026-01",
      "analyze_calls": 5,
      "change_orders_generated": 1
    },
    {
      "month": "2026-02",
      "analyze_calls": 8,
      "change_orders_generated": 2
    },
    {
      "month": "2026-03",
      "analyze_calls": 12,
      "change_orders_generated": 3
    }
  ],
  "resets_at": "2026-04-01T00:00:00.000Z"
}
```

---

## Test Scenarios

### Scenario 1: Classic Scope Creep
Client asks for 10x more features than the contract specified.

**Test Data:**
```
Contract: "Build 5-page website"
Message: "Also add shopping cart, inventory, mobile app, admin dashboard, reporting system, and iOS native app"
```

**Expected:** HIGH severity violations detected; CHANGE_ORDER recommended

---

### Scenario 2: Timeline Pressure
Client wants everything faster than physically possible.

**Test Data:**
```
Contract: "4-week project delivery"
Message: "Can you finish in 3 days? We need this live ASAP."
```

**Expected:** TIMELINE violation detected with HIGH severity

---

### Scenario 3: Payment Changes
Client wants to renegotiate price mid-project.

**Test Data:**
```
Contract: "Total cost: $5,000"
Message: "We've decided the budget is only $2,000. Can you adjust your scope?"
```

**Expected:** PAYMENT violation detected; may require FIRM response

---

### Scenario 4: No Violations
Client stays within scope.

**Test Data:**
```
Contract: "Build 5-page website with contact form, 2 rounds of revisions"
Message: "Can you make the heading on page 2 larger? I'd like it more prominent."
```

**Expected:** `violation_detected: false`; no violations array

---

## Error Scenarios

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key"
  }
}
```

**Fix:** Check your `Authorization: Bearer sk_live_...` header

---

### 403 Pro Required
```json
{
  "success": false,
  "error": {
    "code": "PRO_REQUIRED",
    "message": "Scope Guard requires a Pro plan (Growth, Scale, or Enterprise)",
    "upgrade_url": "https://ebenova.dev/pricing"
  }
}
```

**Fix:** Upgrade from Free or Starter to Growth ($79/mo), Scale ($199/mo), or Enterprise

---

### 400 Invalid Request
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CONTRACT",
    "message": "contract_text is required (min 50 characters)"
  }
}
```

**Fix:** Ensure both `contract_text` and `client_message` are provided with minimum lengths

---

## Dashboard Tracking

After making Scope Guard API calls, your analytics are automatically tracked at:

**https://api.ebenova.dev/dashboard**

You'll see:
- **Monthly usage:** Number of analyses run, violations detected, change orders generated
- **Response breakdown:** How many PUSHBACK, FIRM, and CHANGE_ORDER responses were recommended
- **3-month history:** Trend of your Scope Guard usage

---

## Feedback & Support

We'd love to hear your feedback on the Scope Guard API!

- **GitHub Issues:** https://github.com/ebenova/signova/issues
- **Email:** api@ebenova.dev
- **Discord:** [Join our community]
- **Twitter/X:** @ebenova_dev

---

## Rate Limits & Quotas

| Plan | Scope Guard Analyses/Month | Change Orders/Month | API Calls/Second |
|------|---------------------------|-------------------|-----------------|
| Free | ❌ Not available | ❌ | 1 |
| Starter | ❌ Not available | ❌ | 2 |
| Growth | Unlimited* | Unlimited* | 5 |
| Scale | Unlimited* | Unlimited* | 10 |
| Enterprise | Unlimited* | Unlimited* | 50 |

*Within your monthly document generation limit (e.g., Growth tier gets 500 total documents/month)

---

## What's Using Scope Guard

Real-world use cases:

1. **Freelancers** — Automatically detect client scope creep requests
2. **Agencies** — Validate change request legitimacy before quoting
3. **Legal Teams** — Review contract compliance automatically
4. **Consultants** — Protect project timelines and budgets
5. **In-house Teams** — Monitor vendor requests against contracts

---

**Happy testing! 🚀**
