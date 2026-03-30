# RapidAPI Spotlights for Ebenova Legal Docs API

## Spotlight 1: Generate Legal Documents in Seconds
**Title:** Generate Jurisdiction-Aware Legal Documents

**Description:**
Create professionally drafted legal documents for 18 jurisdictions including Nigeria, UK, US, Canada, Ghana, Kenya, and UAE. Choose from 27 document types including NDAs, tenancy agreements, freelance contracts, and more.

**Use Case:**
A Lagos-based startup needs an NDA for their new developer. Instead of hiring a lawyer for $500, they use the API to generate a jurisdiction-compliant NDA in seconds.

**Example Request:**
```json
POST /v1/documents/generate
{
  "documentType": "nda",
  "jurisdiction": "Nigeria",
  "data": {
    "disclosingParty": "TechStart Ltd",
    "receivingParty": "John Developer",
    "effectiveDate": "2026-04-01"
  }
}
```

**Example Response:**
```json
{
  "documentId": "doc_abc123",
  "format": "pdf",
  "downloadUrl": "https://api.ebenova.dev/v1/documents/doc_abc123/download",
  "jurisdiction": "Nigeria",
  "documentType": "nda"
}
```

**Benefits:**
- ✅ 27 document types
- ✅ 18 jurisdictions
- ✅ Legally compliant
- ✅ Instant delivery
- ✅ From $0.10/document

---

## Spotlight 2: Detect Scope Creep Automatically
**Title:** AI-Powered Scope Violation Detection

**Description:**
Protect your freelance contracts with AI that detects when client messages violate agreed terms. Get 3 professional response drafts ready to send.

**Use Case:**
A freelance designer's contract includes 2 rounds of revisions. The client asks for "just one more small change" for the 5th time. The API detects this as scope creep and generates a polite response requesting a change order.

**Example Request:**
```json
POST /v1/scope/analyze
{
  "contractTerms": {
    "revisions": 2,
    "deliverables": ["logo", "business card"],
    "timeline": "2 weeks"
  },
  "clientMessage": "Can you also add a favicon and social media banner? Should be quick!"
}
```

**Example Response:**
```json
{
  "violationDetected": true,
  "violationType": "scope_creep",
  "severity": "medium",
  "responseDrafts": [
    "I'd be happy to help with the favicon and banner! These are outside our agreed scope...",
    "Great ideas! Let me send over a change order for the additional deliverables...",
    "Those additions would require approximately 3 extra hours..."
  ]
}
```

**Benefits:**
- ✅ Protect revenue
- ✅ Professional responses
- ✅ Client relationship management
- ✅ Automated enforcement

---

## Spotlight 3: Extract Terms from Conversations
**Title:** Turn WhatsApp Chats into Contracts

**Description:**
Extract structured contract terms from WhatsApp, email, or chat conversations. Perfect for informal agreements that need formal documentation.

**Use Case:**
A landlord and tenant negotiate terms over WhatsApp. The API extracts the agreed rent, duration, and conditions, then generates a formal tenancy agreement.

**Example Request:**
```json
POST /v1/extraction/extract
{
  "conversation": [
    {"sender": "Landlord", "text": "₦2M per year, 2 bedrooms, Lekki Phase 1"},
    {"sender": "Tenant", "text": "Available from June 1st?"},
    {"sender": "Landlord", "text": "Yes, 1 year minimum"}
  ],
  "documentType": "tenancy_agreement",
  "jurisdiction": "Nigeria"
}
```

**Example Response:**
```json
{
  "extractedFields": {
    "rent": "₦2,000,000/year",
    "propertyType": "2 bedrooms",
    "location": "Lekki Phase 1",
    "startDate": "2026-06-01",
    "duration": "1 year"
  },
  "confidence": 0.95,
  "readyToGenerate": true
}
```

**Benefits:**
- ✅ Save hours of manual entry
- ✅ Reduce errors
- ✅ Close deals faster
- ✅ WhatsApp/Email/Chat support

---

## Spotlight 4: Generate Invoices Instantly
**Title:** Professional Invoices with Payment Links

**Description:**
Create invoices, receipts, and proforma invoices with integrated payment links. Support for multiple currencies and African payment methods.

**Use Case:**
A consultant completes a project and needs to invoice the client immediately. The API generates a professional invoice with Paystack/Flutterwave payment links.

**Example Request:**
```json
POST /v1/invoices/generate
{
  "invoiceType": "invoice",
  "currency": "NGN",
  "items": [
    {"description": "Consulting Services", "quantity": 10, "unitPrice": 50000}
  ],
  "client": {
    "name": "ABC Corporation",
    "email": "billing@abc.com"
  },
  "paymentMethods": ["paystack", "flutterwave", "bank_transfer"]
}
```

**Example Response:**
```json
{
  "invoiceId": "inv_xyz789",
  "amount": "₦500,000",
  "paymentLinks": {
    "paystack": "https://paystack.com/pay/...",
    "flutterwave": "https://flutterwave.com/pay/..."
  },
  "pdfUrl": "https://api.ebenova.dev/v1/invoices/inv_xyz789/download"
}
```

**Benefits:**
- ✅ Get paid faster
- ✅ Multiple payment options
- ✅ Professional branding
- ✅ Auto-reminders

---

## Spotlight 5: Batch Document Generation
**Title:** Generate 10 Documents at Once

**Description:**
Need multiple documents? Generate up to 10 legal documents in a single API call. Perfect for onboarding multiple employees or contractors.

**Use Case:**
A company is hiring 5 new employees and needs employment contracts, NDAs, and offer letters for each. One API call generates all 15 documents.

**Example Request:**
```json
POST /v1/documents/batch
{
  "documents": [
    {
      "documentType": "employment_contract",
      "jurisdiction": "Nigeria",
      "data": { "employee": "John Doe", ... }
    },
    {
      "documentType": "nda",
      "jurisdiction": "Nigeria",
      "data": { "employee": "John Doe", ... }
    }
    // ... up to 10 documents
  ]
}
```

**Example Response:**
```json
{
  "batchId": "batch_123",
  "documents": [
    {"id": "doc_001", "status": "generated", "downloadUrl": "..."},
    {"id": "doc_002", "status": "generated", "downloadUrl": "..."}
  ],
  "totalCost": "$1.50"
}
```

**Benefits:**
- ✅ Save 80% vs individual calls
- ✅ Consistent formatting
- ✅ Bulk discounts
- ✅ Single transaction

---

## How to Add These Spotlights on RapidAPI:

1. **Login** to https://rapidapi.com/developer/onboarding
2. Go to your API: **ebenova-legal-docs**
3. Click **"Edit API"** or **"Add Spotlight"**
4. For each spotlight:
   - Add **Title**
   - Add **Description** (2-3 sentences)
   - Add **Code Example** (request/response)
   - Add **Image/Screenshot** (optional but recommended)
5. **Save** and **Publish**

**Pro Tips:**
- Use screenshots from your actual API responses
- Include real-world use cases (African businesses, freelancers, SaaS)
- Highlight pricing advantages (from $0.10/document)
- Show jurisdiction support (Nigeria, Kenya, Ghana, etc.)
