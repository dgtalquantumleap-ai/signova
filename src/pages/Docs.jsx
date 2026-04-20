import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import './Docs.css'

export default function Docs() {
  const navigate = useNavigate()

  return (
    <div className="docs-page">
      <Helmet>
        <title>API Documentation | Ebenova — Legal Document Generation API</title>
        <meta name="description" content="Generate legally compliant contracts, NDAs, and business documents via API. 34 document types, 18 jurisdictions. Simple REST API with JSON responses." />
        <link rel="canonical" href="https://www.ebenova.dev/docs" />
      </Helmet>

      <nav className="docs-nav">
        <div className="logo" onClick={() => navigate('/')}>
          <span className="logo-mark">E</span>
          <span className="logo-text">ebenova.dev</span>
        </div>
        <a href="https://www.getsignova.com" className="docs-back">← Back to Signova</a>
      </nav>

      <div className="docs-container">
        <aside className="docs-sidebar">
          <h3>Documentation</h3>
          <ul>
            <li><a href="#quickstart">Quickstart</a></li>
            <li><a href="#authentication">Authentication</a></li>
            <li><a href="#generate">Generate Document</a></li>
            <li><a href="#invoices">Generate Invoice</a></li>
            <li><a href="#types">List Document Types</a></li>
            <li><a href="#templates">Templates &amp; Schemas</a></li>
            <li><a href="#batch">Batch Generation</a></li>
            <li><a href="#extract">Extract from Conversation</a></li>
            <li><a href="#contract-link">Contract-Payment Linking</a></li>
            <li><a href="#scope-guard">Scope Guard API</a></li>
            <li><a href="#usage">Check Usage</a></li>
            <li><a href="#document-types">Document Type Reference</a></li>
            <li><a href="#sdk">SDKs &amp; MCP</a></li>
            <li><a href="#billing">Billing API</a></li>
            <li><a href="#insights">Insights API</a></li>
            <li><a href="#vigil">Vigil API</a></li>
            <li><a href="#fieldops">FieldOps Agent API</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#errors">Error Codes</a></li>
          </ul>
        </aside>

        <main className="docs-content">
          <h1>Ebenova API</h1>
          <p className="docs-intro">
            Generate professionally drafted legal documents in seconds.
            34 document types, 18 jurisdictions, one simple API.
          </p>

          {/* ── Quickstart ── */}
          <section id="quickstart">
            <h2>Quickstart</h2>
            <p>Generate your first document in under 60 seconds:</p>
            <pre className="code-block">{`curl -X POST https://api.ebenova.dev/v1/documents/generate \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "document_type": "nda",
    "fields": {
      "disclosingParty": "Acme Inc.",
      "receivingParty": "John Smith",
      "purpose": "Discussing a potential partnership",
      "duration": "2 years",
      "mutual": "Yes — mutual NDA"
    },
    "jurisdiction": "Nigeria"
  }'`}</pre>

            <p>Response:</p>
            <pre className="code-block">{`{
  "success": true,
  "document_type": "nda",
  "document": "NON-DISCLOSURE AGREEMENT\\n\\nThis Non-Disclosure Agreement...",
  "usage": {
    "documents_used": 1,
    "documents_remaining": 99,
    "monthly_limit": 100,
    "resets_at": "2026-04-01T00:00:00Z"
  },
  "generated_at": "2026-03-25T12:00:00Z"
}`}</pre>
          </section>

          {/* ── Authentication ── */}
          <section id="authentication">
            <h2>Authentication</h2>
            <p>All API requests (except <code>GET /v1/documents/types</code>) require a Bearer token:</p>
            <pre className="code-block">{`Authorization: Bearer sk_live_your_api_key`}</pre>
            <p>
              Get your API key at <a href="https://www.ebenova.dev/dashboard" target="_blank" rel="noopener noreferrer">ebenova.dev/dashboard</a>.
              Keys starting with <code>sk_test_</code> are for development and have limited functionality.
            </p>
          </section>

          {/* ── Generate ── */}
          <section id="generate">
            <h2>Generate Document</h2>
            <p><code>POST /v1/documents/generate</code></p>

            <h3>Request Body</h3>
            <table className="docs-table">
              <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>document_type</code></td><td>string</td><td>Yes</td><td>Document type slug. See reference below.</td></tr>
                <tr><td><code>fields</code></td><td>object</td><td>Yes</td><td>Document-specific fields. String or array values.</td></tr>
                <tr><td><code>jurisdiction</code></td><td>string</td><td>No</td><td>Governing law (e.g. <code>"Nigeria"</code>, <code>"United States — California"</code>)</td></tr>
              </tbody>
            </table>

            <h3>Response</h3>
            <table className="docs-table">
              <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>document</code></td><td>string</td><td>The full generated document text</td></tr>
                <tr><td><code>usage.documents_used</code></td><td>integer</td><td>Documents generated this month</td></tr>
                <tr><td><code>usage.documents_remaining</code></td><td>integer</td><td>Remaining documents this month</td></tr>
                <tr><td><code>usage.resets_at</code></td><td>ISO date</td><td>When the monthly quota resets</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── Invoices ── */}
          <section id="invoices">
            <h2>Generate Invoice</h2>
            <p><code>POST /v1/invoices/generate</code></p>
            <p>
              Generate professional invoices, receipts, proforma invoices, and credit notes.
              Returns fully rendered HTML ready to display or print-to-PDF client-side.
            </p>

            <h3>Request Body</h3>
            <table className="docs-table">
              <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>type</code></td><td>string</td><td>No</td><td>Document type: <code>invoice</code>, <code>receipt</code>, <code>proforma</code>, or <code>credit-note</code>. Default: <code>invoice</code></td></tr>
                <tr><td><code>from</code></td><td>object</td><td>Yes</td><td>Sender details. Requires <code>name</code>. Optional: <code>address</code>, <code>email</code>, <code>phone</code>, <code>tax_id</code></td></tr>
                <tr><td><code>to</code></td><td>object</td><td>Yes</td><td>Recipient details. Requires <code>name</code>. Optional: <code>address</code>, <code>email</code>, <code>phone</code>, <code>tax_id</code></td></tr>
                <tr><td><code>items</code></td><td>array</td><td>Yes</td><td>Line items. Each requires <code>description</code>, <code>quantity</code>, <code>unit_price</code>. Optional: <code>notes</code></td></tr>
                <tr><td><code>invoice_number</code></td><td>string</td><td>No</td><td>Unique invoice identifier</td></tr>
                <tr><td><code>issue_date</code></td><td>string</td><td>No</td><td>Issue date (default: today)</td></tr>
                <tr><td><code>due_date</code></td><td>string</td><td>No</td><td>Payment due date</td></tr>
                <tr><td><code>currency</code></td><td>string</td><td>No</td><td>Default: <code>USD</code>. Supported: USD, EUR, GBP, CAD, AUD, NGN, KES, GHS, ZAR, INR, AED, SGD</td></tr>
                <tr><td><code>tax_rate</code></td><td>number</td><td>No</td><td>Tax percentage (e.g. 10 for 10%). Default: 0</td></tr>
                <tr><td><code>discount_percent</code></td><td>number</td><td>No</td><td>Discount percentage. Default: 0</td></tr>
                <tr><td><code>notes</code></td><td>string</td><td>No</td><td>Notes shown on invoice</td></tr>
                <tr><td><code>payment_instructions</code></td><td>string</td><td>No</td><td>Bank details or payment instructions</td></tr>
                <tr><td><code>logo_url</code></td><td>string</td><td>No</td><td>Public URL of logo image</td></tr>
              </tbody>
            </table>

            <h3>Example Request</h3>
            <pre className="code-block">{`curl -X POST https://api.ebenova.dev/v1/invoices/generate \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "invoice",
    "from": {
      "name": "Acme Design Ltd.",
      "address": "12 Marina, Lagos, Nigeria",
      "email": "billing@acme.com"
    },
    "to": {
      "name": "John Smith",
      "address": "456 Oak Ave, London, UK",
      "email": "john@example.com"
    },
    "items": [
      {
        "description": "Website Design",
        "quantity": 1,
        "unit_price": 2500
      }
    ],
    "invoice_number": "INV-2026-001",
    "issue_date": "April 1, 2026",
    "due_date": "April 30, 2026",
    "currency": "USD"
  }'`}</pre>

            <h3>Response</h3>
            <table className="docs-table">
              <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>success</code></td><td>boolean</td><td>true if successful</td></tr>
                <tr><td><code>invoice_id</code></td><td>string</td><td>Unique invoice identifier (e.g. <code>inv_mnb3xqmn_xt2sq</code>)</td></tr>
                <tr><td><code>invoice_number</code></td><td>string</td><td>Your provided invoice number</td></tr>
                <tr><td><code>type</code></td><td>string</td><td>Document type generated</td></tr>
                <tr><td><code>currency</code></td><td>string</td><td>Currency code</td></tr>
                <tr><td><code>subtotal</code></td><td>number</td><td>Subtotal before tax/discount</td></tr>
                <tr><td><code>tax_amount</code></td><td>number</td><td>Calculated tax amount</td></tr>
                <tr><td><code>discount_amount</code></td><td>number</td><td>Calculated discount amount</td></tr>
                <tr><td><code>total</code></td><td>number</td><td>Final total amount</td></tr>
                <tr><td><code>html</code></td><td>string</td><td>Fully rendered HTML invoice</td></tr>
                <tr><td><code>usage</code></td><td>object</td><td>Usage stats (documents remaining)</td></tr>
                <tr><td><code>generated_at</code></td><td>ISO date</td><td>Generation timestamp</td></tr>
              </tbody>
            </table>

            <h3>Example Response</h3>
            <pre className="code-block">{`{
  "success": true,
  "invoice_id": "inv_mnb3xqmn_xt2sq",
  "invoice_number": "INV-2026-001",
  "type": "invoice",
  "currency": "USD",
  "subtotal": 2500,
  "tax_amount": 0,
  "discount_amount": 0,
  "total": 2500,
  "html": "<!DOCTYPE html>\\n<html>...",
  "usage": {
    "documents_used": 1,
    "documents_remaining": 99,
    "monthly_limit": 100,
    "resets_at": "2026-04-01T00:00:00Z"
  },
  "generated_at": "2026-03-29T01:55:44.835Z"
}`}</pre>

            <h3>Supported Types</h3>
            <ul>
              <li><strong>invoice</strong> — Standard invoice with due date</li>
              <li><strong>receipt</strong> — Proof of payment (no due date)</li>
              <li><strong>proforma</strong> — Proforma invoice for customs/quotes</li>
              <li><strong>credit-note</strong> — Credit note for refunds/adjustments</li>
            </ul>

            <h3>PDF Generation</h3>
            <p>
              The API returns HTML. To get a PDF, render the HTML and use <code>window.print()</code> or send the HTML to a PDF microservice like Puppeteer.
            </p>
          </section>

          {/* ── List Types ── */}
          <section id="types">
            <h2>List Document Types</h2>
            <p><code>GET /v1/documents/types</code> — No authentication required. Cached 1 hour.</p>
            <pre className="code-block">{`curl https://api.ebenova.dev/v1/documents/types`}</pre>
            <p>Returns all 34 document types as a flat list and grouped by category.</p>
          </section>

          {/* ── Extract ── */}
          <section id="extract">
            <h2>Extract from Conversation</h2>
            <p><code>POST /v1/extract/conversation</code></p>
            <p>
              Paste a WhatsApp chat, email thread, or any conversation. The API extracts structured fields
              and identifies the most appropriate document type. Optionally generate the document in the same call.
            </p>
            <p>
              <strong>Extraction alone does not count against your monthly quota.</strong> Only set <code>auto_generate: true</code> when you're ready to generate — that counts as 1 document.
            </p>

            <h3>Request Body</h3>
            <table className="docs-table">
              <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>conversation</code></td><td>string</td><td>Yes</td><td>Raw conversation text. Max 10,000 characters.</td></tr>
                <tr><td><code>target_document</code></td><td>string</td><td>No</td><td>Force a specific document type. If omitted, the API suggests one.</td></tr>
                <tr><td><code>auto_generate</code></td><td>boolean</td><td>No</td><td>Also generate the full document (default: <code>false</code>)</td></tr>
              </tbody>
            </table>

            <h3>Example</h3>
            <pre className="code-block">{`curl -X POST https://api.ebenova.dev/v1/extract/conversation \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "conversation": "[3/20/26] Emeka: The rent is 1.2M per year, 1 year tenancy. Tenant is Mrs. Nwosu. Property is Flat 3B, 14 Admiralty Way, Lekki.",
    "target_document": "tenancy-agreement",
    "auto_generate": false
  }'`}</pre>

            <pre className="code-block">{`{
  "success": true,
  "suggested_document": "tenancy-agreement",
  "confidence": 0.96,
  "extracted_fields": {
    "landlord": "Emeka",
    "tenant": "Mrs. Nwosu",
    "property": "Flat 3B, 14 Admiralty Way, Lekki",
    "rentAmount": "1.2M per year",
    "duration": "1 year"
  },
  "missing_fields": ["paymentSchedule", "cautionDeposit", "utilities"]
}`}</pre>
          </section>

          {/* ── Templates & Schemas ── */}
          <section id="templates">
            <h2>Templates &amp; Field Schemas</h2>
            <p><code>GET /v1/documents/templates</code></p>
            <p>
              Returns the field schema for each document type so you can build dynamic forms,
              validate input, or understand what data each document needs before generating.
              <strong>Pure data endpoint — no AI call, no quota cost.</strong>
            </p>

            <h3>Examples</h3>
            <pre className="code-block">{`# All templates (full catalog)
curl "https://api.ebenova.dev/v1/documents/templates" \\
  -H "Authorization: Bearer sk_live_your_api_key"

# Single template by type
curl "https://api.ebenova.dev/v1/documents/templates?type=nda" \\
  -H "Authorization: Bearer sk_live_your_api_key"`}</pre>

            <h3>Response shape</h3>
            <pre className="code-block">{`{
  "success": true,
  "type": "nda",
  "label": "Non-Disclosure Agreement",
  "category": "Core Legal",
  "fields": [
    { "key": "disclosingParty", "label": "Disclosing Party", "type": "text", "required": true, "placeholder": "Acme Inc." },
    { "key": "receivingParty", "label": "Receiving Party", "type": "text", "required": true },
    { "key": "purpose",        "label": "Purpose of Disclosure", "type": "text", "required": true },
    { "key": "duration",       "label": "Confidentiality Duration", "type": "text", "required": true },
    { "key": "mutual",         "label": "Mutual NDA?", "type": "select", "options": ["Yes","No"], "required": true },
    { "key": "jurisdiction",   "label": "Governing Law", "type": "text", "required": false }
  ]
}`}</pre>
            <p><strong>Field types:</strong> <code>text</code>, <code>textarea</code>, <code>select</code> (with <code>options</code> array), <code>date</code>.</p>
          </section>

          {/* ── Batch Generation ── */}
          <section id="batch">
            <h2>Batch Generation</h2>
            <p><code>POST /v1/documents/batch</code></p>
            <p>
              Generate up to <strong>10 documents in a single API call</strong>. Each document is generated
              independently using the same pipeline as <code>POST /v1/documents/generate</code>. Each successfully
              generated document counts as 1 toward your monthly quota.
            </p>

            <h3>Request body</h3>
            <table className="docs-table">
              <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>documents</code></td><td>array</td><td>Yes</td><td>Array of <code>{`{ type, fields }`}</code> objects (max 10).</td></tr>
                <tr><td><code>jurisdiction</code></td><td>string</td><td>No</td><td>Default jurisdiction applied to every document (each can override in its own <code>fields</code>).</td></tr>
              </tbody>
            </table>

            <h3>Example</h3>
            <pre className="code-block">{`curl -X POST "https://api.ebenova.dev/v1/documents/batch" \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jurisdiction": "Ontario, Canada",
    "documents": [
      { "type": "nda", "fields": { "disclosingParty": "Acme", "receivingParty": "Vendor X", "purpose": "Pilot", "duration": "2 years", "mutual": "Yes" } },
      { "type": "freelance-contract", "fields": { "clientName": "Acme", "freelancerName": "Jane Doe", "totalFee": "$8,000", "deadline": "May 30, 2026" } }
    ]
  }'`}</pre>

            <h3>Response shape</h3>
            <pre className="code-block">{`{
  "success": true,
  "results": [
    { "index": 0, "type": "nda",                "success": true, "text": "..." },
    { "index": 1, "type": "freelance-contract", "success": true, "text": "..." }
  ],
  "generated": 2,
  "failed": 0,
  "_usage": { "documents_used": 47, "documents_remaining": 53 }
}`}</pre>
            <p><strong>Partial failures:</strong> if one document fails, the rest still generate. Failed entries return <code>{`{ success: false, error: "..." }`}</code> in their slot.</p>
          </section>

          {/* ── Contract-Payment Linking ── */}
          <section id="contract-link">
            <h2>Contract-Payment Linking</h2>
            <p><code>POST /v1/contracts/link</code> · <code>GET /v1/contracts/link?contract_id=...</code> · <code>GET /v1/contracts/link?payment_ref=...</code></p>
            <p>
              Associate a generated contract with a payment reference (Stripe invoice ID, bank transfer ref,
              OxaPay/Polar order, etc.). Bidirectional lookup — query by either the contract or the payment.
              Stored in Redis, scoped to your API key.
            </p>

            <h3>Create a link</h3>
            <pre className="code-block">{`curl -X POST "https://api.ebenova.dev/v1/contracts/link" \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contract_id": "doc_2026_0042",
    "payment_ref": "stripe_in_1QrXyZ...",
    "amount":      4999,
    "currency":    "USD",
    "status":      "paid",
    "notes":       "Annual licence — Acme Inc."
  }'`}</pre>

            <h3>Look up by contract</h3>
            <pre className="code-block">{`curl "https://api.ebenova.dev/v1/contracts/link?contract_id=doc_2026_0042" \\
  -H "Authorization: Bearer sk_live_your_api_key"`}</pre>

            <h3>Look up by payment</h3>
            <pre className="code-block">{`curl "https://api.ebenova.dev/v1/contracts/link?payment_ref=stripe_in_1QrXyZ..." \\
  -H "Authorization: Bearer sk_live_your_api_key"`}</pre>
            <p><strong>Use cases:</strong> reconcile bank transfers to contracts, expose paid-or-not status to a CRM, audit which deliverables a customer has actually paid for.</p>
          </section>

          {/* ── Scope Guard API ── */}
          <section id="scope-guard">
            <h2>Scope Guard API</h2>
            <p>
              AI-powered contract enforcement. Analyze client messages for scope violations and generate
              professional responses or change orders.
            </p>
            <p>
              <strong>Pro Tier Required:</strong> Scope Guard is available on Growth, Scale, and Enterprise plans only.
            </p>

            <h3>Analyze Message for Violations</h3>
            <p><code>POST /v1/scope/analyze</code></p>
            <p>
              Analyzes a client message against your contract to detect scope violations.
              Returns violation details, severity, and 3 professional response drafts.
            </p>

            <h4>Request Body</h4>
            <table className="docs-table">
              <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>contract_text</code></td><td>string</td><td>Yes</td><td>The full contract text (min 50 chars, max 50,000)</td></tr>
                <tr><td><code>client_message</code></td><td>string</td><td>Yes</td><td>The client's message to analyze</td></tr>
                <tr><td><code>communication_channel</code></td><td>string</td><td>No</td><td>Channel type: email, whatsapp, slack, sms, other (default: email)</td></tr>
              </tbody>
            </table>

            <h4>Example Request</h4>
            <pre className="code-block">{`curl -X POST https://api.ebenova.dev/v1/scope/analyze \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contract_text": "SCOPE OF WORK: Website design with 5 pages, 2 rounds of revisions included...",
    "client_message": "Can you also add a blog section? Shouldn't take long.",
    "communication_channel": "email"
  }'`}</pre>

            <h4>Response</h4>
            <table className="docs-table">
              <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>success</code></td><td>boolean</td><td>true if analysis successful</td></tr>
                <tr><td><code>violation_detected</code></td><td>boolean</td><td>true if scope violations found</td></tr>
                <tr><td><code>violations</code></td><td>array</td><td>List of detected violations with type, severity, description</td></tr>
                <tr><td><code>response_options</code></td><td>array</td><td>3 professional response drafts (PUSHBACK, CHANGE_ORDER, FIRM)</td></tr>
                <tr><td><code>suggested_change_order</code></td><td>object</td><td>Suggested change order details if applicable</td></tr>
                <tr><td><code>summary</code></td><td>string</td><td>One sentence summary of analysis</td></tr>
                <tr><td><code>usage</code></td><td>object</td><td>Usage stats (documents remaining)</td></tr>
              </tbody>
            </table>

            <h4>Example Response</h4>
            <pre className="code-block">{`{
  "success": true,
  "violation_detected": true,
  "violations": [
    {
      "type": "SCOPE",
      "severity": "MEDIUM",
      "description": "Client requesting blog section not included in original scope",
      "contract_reference": "Section 1.1 - Scope of Work"
    }
  ],
  "response_options": [
    {
      "type": "CHANGE_ORDER",
      "label": "Propose Change Order",
      "draft": "Hi [Client], I'd be happy to add a blog section...",
      "recommended": true
    }
  ],
  "suggested_change_order": {
    "applicable": true,
    "additional_work_description": "Blog section design and development",
    "estimated_hours": 8,
    "suggested_cost_usd": 640
  },
  "summary": "Scope violation detected: additional work requested.",
  "usage": {
    "documents_used": 1,
    "documents_remaining": 499,
    "monthly_limit": 500,
    "resets_at": "2026-04-01T00:00:00Z"
  }
}`}</pre>

            <h3>Generate Change Order</h3>
            <p><code>POST /v1/scope/change-order</code></p>
            <p>
              Generates a formal change order document for additional work requested by the client.
              Returns a professionally formatted document ready to send.
            </p>

            <h4>Request Body</h4>
            <table className="docs-table">
              <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>additional_work</code></td><td>string</td><td>Yes</td><td>Description of the additional work requested</td></tr>
                <tr><td><code>additional_cost</code></td><td>number</td><td>Yes</td><td>Additional cost in USD (or specified currency)</td></tr>
                <tr><td><code>freelancer_name</code></td><td>string</td><td>No</td><td>Your name/company name</td></tr>
                <tr><td><code>client_name</code></td><td>string</td><td>No</td><td>Client's name/company name</td></tr>
                <tr><td><code>currency</code></td><td>string</td><td>No</td><td>Currency code (default: USD)</td></tr>
                <tr><td><code>timeline_extension_days</code></td><td>number</td><td>No</td><td>Additional days needed for the work</td></tr>
                <tr><td><code>jurisdiction</code></td><td>string</td><td>No</td><td>Governing law (default: International)</td></tr>
              </tbody>
            </table>

            <h4>Example Request</h4>
            <pre className="code-block">{`curl -X POST https://api.ebenova.dev/v1/scope/change-order \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "additional_work": "Blog section with 3 template pages, CMS integration, and SEO optimization",
    "additional_cost": 640,
    "freelancer_name": "Acme Design Studio",
    "client_name": "TechCorp Inc.",
    "currency": "USD",
    "timeline_extension_days": 5,
    "jurisdiction": "United States - California"
  }'`}</pre>

            <h4>Response</h4>
            <table className="docs-table">
              <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>success</code></td><td>boolean</td><td>true if generation successful</td></tr>
                <tr><td><code>document</code></td><td>string</td><td>Full change order document text</td></tr>
                <tr><td><code>change_order_details</code></td><td>object</td><td>Details of the change order</td></tr>
                <tr><td><code>usage</code></td><td>object</td><td>Usage stats (documents remaining)</td></tr>
              </tbody>
            </table>

            <h4>Error Codes</h4>
            <table className="docs-table">
              <thead><tr><th>HTTP Status</th><th>Code</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td>400</td><td><code>INVALID_CONTRACT</code></td><td>contract_text missing or too short</td></tr>
                <tr><td>400</td><td><code>INVALID_MESSAGE</code></td><td>client_message missing</td></tr>
                <tr><td>400</td><td><code>MISSING_FIELD</code></td><td>Required field missing (change-order)</td></tr>
                <tr><td>401</td><td><code>MISSING_AUTH</code></td><td>No Authorization header</td></tr>
                <tr><td>401</td><td><code>INVALID_API_KEY</code></td><td>API key not found or invalid</td></tr>
                <tr><td>403</td><td><code>PRO_REQUIRED</code></td><td>Scope Guard requires Growth/Scale/Enterprise plan</td></tr>
                <tr><td>429</td><td><code>MONTHLY_LIMIT_REACHED</code></td><td>Monthly document quota exceeded</td></tr>
                <tr><td>500</td><td><code>ANALYSIS_FAILED</code></td><td>AI analysis failed — retry</td></tr>
                <tr><td>500</td><td><code>GENERATION_FAILED</code></td><td>Document generation failed — retry</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── Usage ── */}
          <section id="usage">
            <h2>Check Usage</h2>
            <p><code>GET /v1/keys/usage</code></p>
            <p>Returns current month stats and 3-month history for the authenticated API key.</p>
            <pre className="code-block">{`curl https://api.ebenova.dev/v1/keys/usage \\
  -H "Authorization: Bearer sk_live_your_api_key"`}</pre>
            <pre className="code-block">{`{
  "success": true,
  "key": { "owner": "you@example.com", "tier": "starter", "label": "My project" },
  "current_month": {
    "documents_used": 15,
    "documents_remaining": 85,
    "monthly_limit": 100,
    "resets_at": "2026-04-01T00:00:00Z"
  },
  "history": [
    { "month": "2026-03", "documents_generated": 15 },
    { "month": "2026-02", "documents_generated": 42 }
  ]
}`}</pre>
          </section>

          {/* ── Document Types ── */}
          <section id="document-types">
            <h2>Document Type Reference</h2>
            <p>34 document types across 6 categories:</p>

            <h3>Business Contracts</h3>
            <ul className="doc-type-list">
              <li><code>nda</code> — Non-Disclosure Agreement</li>
              <li><code>freelance-contract</code> — Freelance / Client Contract</li>
              <li><code>service-agreement</code> — Service Agreement</li>
              <li><code>consulting-agreement</code> — Consulting Agreement</li>
              <li><code>independent-contractor</code> — Independent Contractor Agreement</li>
              <li><code>business-partnership</code> — Business Partnership Agreement</li>
              <li><code>joint-venture</code> — Joint Venture Agreement</li>
              <li><code>distribution-agreement</code> — Distribution / Reseller Agreement</li>
              <li><code>supply-agreement</code> — Supply Agreement</li>
              <li><code>business-proposal</code> — Business Proposal</li>
              <li><code>purchase-agreement</code> — Purchase Agreement</li>
            </ul>

            <h3>Employment &amp; HR</h3>
            <ul className="doc-type-list">
              <li><code>employment-offer-letter</code> — Employment Offer Letter</li>
              <li><code>non-compete-agreement</code> — Non-Compete Agreement</li>
            </ul>

            <h3>Financial</h3>
            <ul className="doc-type-list">
              <li><code>loan-agreement</code> — Loan Agreement</li>
              <li><code>payment-terms-agreement</code> — Payment Terms Agreement</li>
              <li><code>shareholder-agreement</code> — Shareholder Agreement</li>
              <li><code>hire-purchase</code> — Hire Purchase Agreement</li>
            </ul>

            <h3>Real Estate &amp; Property</h3>
            <ul className="doc-type-list">
              <li><code>tenancy-agreement</code> — Tenancy / Rental Agreement</li>
              <li><code>quit-notice</code> — Quit Notice / Notice to Vacate</li>
              <li><code>deed-of-assignment</code> — Deed of Assignment</li>
              <li><code>power-of-attorney</code> — Power of Attorney</li>
              <li><code>landlord-agent-agreement</code> — Landlord &amp; Agent Agreement</li>
              <li><code>facility-manager-agreement</code> — Facility Manager Agreement</li>
            </ul>

            <h3>Legal &amp; Compliance</h3>
            <ul className="doc-type-list">
              <li><code>privacy-policy</code> — Privacy Policy</li>
              <li><code>terms-of-service</code> — Terms of Service</li>
              <li><code>mou</code> — Memorandum of Understanding</li>
              <li><code>letter-of-intent</code> — Letter of Intent</li>
              <li><code>data-processing-agreement</code> — Data Processing Agreement (DPA)</li>
            </ul>

            <h3>Startup &amp; Fundraising</h3>
            <ul className="doc-type-list">
              <li><code>founders-agreement</code> — Founders&apos; Agreement</li>
              <li><code>ip-assignment-agreement</code> — IP Assignment Agreement</li>
              <li><code>advisory-board-agreement</code> — Advisory Board Agreement</li>
              <li><code>vesting-agreement</code> — Vesting Agreement</li>
              <li><code>term-sheet</code> — Term Sheet</li>
              <li><code>safe-agreement</code> — SAFE Agreement</li>
            </ul>
          </section>

          {/* ── SDKs & MCP ── */}
          <section id="sdk">
            <h2>SDKs &amp; MCP Server</h2>

            <h3>Node.js SDK</h3>
            <pre className="code-block">{`npm install @ebenova/legal-docs`}</pre>
            <pre className="code-block">{`import EbenovaClient from '@ebenova/legal-docs'

const client = new EbenovaClient({ apiKey: 'sk_live_your_key' })

const result = await client.documents.generate({
  document_type: 'nda',
  fields: { disclosingParty: 'Acme Inc.', receivingParty: 'John Smith', ... },
  jurisdiction: 'Nigeria',
})
console.log(result.document)`}</pre>

            <h3>MCP Server (Claude Desktop / Cursor)</h3>
            <p>Use the Ebenova API directly from Claude Desktop, Cursor, or any MCP-compatible AI tool. No extra setup — one config block and you're done.</p>
            <pre className="code-block">{`{
  "mcpServers": {
    "ebenova-legal": {
      "command": "npx",
      "args": ["-y", "ebenova-legal-docs-mcp"],
      "env": {
        "EBENOVA_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}`}</pre>

            <h4>Config file location</h4>
            <table className="docs-table">
              <thead><tr><th>Platform</th><th>Path</th></tr></thead>
              <tbody>
                <tr><td>macOS</td><td><code>~/Library/Application Support/Claude/claude_desktop_config.json</code></td></tr>
                <tr><td>Windows</td><td><code>%APPDATA%\Claude\claude_desktop_config.json</code></td></tr>
                <tr><td>Cursor</td><td>Settings → MCP → Add server</td></tr>
              </tbody>
            </table>

            <h4>Example prompts once connected</h4>
            <ul>
              <li><em>"Generate an NDA between Acme Inc. and John Smith, 2 years, mutual, Nigerian law."</em></li>
              <li><em>"Create a freelance contract for a $5,000 web project."</em></li>
              <li><em>"Here's our WhatsApp conversation — turn it into a tenancy agreement."</em></li>
              <li><em>"Create an invoice for Acme Corp — 3 hours consulting at $150/hour, due in 30 days."</em></li>
              <li><em>"Generate a receipt for the $500 payment I received from John Smith."</em></li>
              <li><em>"What legal document types do you support?"</em></li>
              <li><em>"How many documents have I generated this month?"</em></li>
            </ul>

            <p>
              The MCP server is also listed on{' '}
              <a href="https://smithery.ai/server/ebenova/legal-docs" target="_blank" rel="noopener noreferrer">Smithery</a>.
              Source code on <a href="https://github.com/dgtalquantumleap-ai/legal-docs-mcp" target="_blank" rel="noopener noreferrer">GitHub</a>.
            </p>
          </section>

          {/* ── Billing ── */}
          <section id="billing">
            <h2>Billing API</h2>
            <p>Programmatically create subscription checkouts for your users.</p>

            <h3>Create Checkout Session</h3>
            <p><code>POST /v1/billing/checkout</code></p>
            <p>Creates a Stripe Checkout session and returns a URL to redirect users to.</p>

            <h4>Request Body</h4>
            <table className="docs-table">
              <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>tier</code></td><td>string</td><td>Yes</td><td><code>starter</code>, <code>growth</code>, or <code>scale</code></td></tr>
                <tr><td><code>email</code></td><td>string</td><td>No</td><td>Pre-fill customer email</td></tr>
                <tr><td><code>success_url</code></td><td>string</td><td>No</td><td>Redirect URL after successful payment</td></tr>
                <tr><td><code>cancel_url</code></td><td>string</td><td>No</td><td>Redirect URL if user cancels</td></tr>
              </tbody>
            </table>

            <h4>Example</h4>
            <pre className="code-block">{`curl -X POST https://api.ebenova.dev/v1/billing/checkout \\
  -H "Content-Type: application/json" \\
  -d '{
    "tier": "starter",
    "email": "user@example.com",
    "success_url": "https://yourapp.com/success",
    "cancel_url": "https://yourapp.com/pricing"
  }'`}</pre>

            <h4>Response</h4>
            <pre className="code-block">{`{
  "success": true,
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_live_...",
  "session_id": "cs_live_...",
  "tier": "starter",
  "label": "Starter — 100 docs/month"
}`}</pre>
            <p>Redirect your user to <code>checkout_url</code> to complete payment.</p>

            <h3>Customer Portal</h3>
            <p><code>POST /v1/billing/portal</code> (requires authentication)</p>
            <p>Creates a Stripe Customer Portal session for managing subscriptions, updating payment methods, and viewing invoices.</p>
            <pre className="code-block">{`curl -X POST https://api.ebenova.dev/v1/billing/portal \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{ "return_url": "https://yourapp.com/dashboard" }'`}</pre>
          </section>

          {/* ── Pricing ── */}
          <section id="pricing">
            <h2>Pricing</h2>
            <table className="docs-table">
              <thead><tr><th>Plan</th><th>Documents/month</th><th>Price</th></tr></thead>
              <tbody>
                <tr><td>Free</td><td>5</td><td>$0/month</td></tr>
                <tr><td>Starter</td><td>100</td><td>$29/month</td></tr>
                <tr><td>Growth</td><td>500</td><td>$79/month</td></tr>
                <tr><td>Scale</td><td>2,000</td><td>$199/month</td></tr>
                <tr><td>Enterprise</td><td>Custom</td><td>Contact us</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── Errors ── */}
          <section id="errors">
            <h2>Error Codes</h2>
            <p>All errors return a consistent JSON structure:</p>
            <pre className="code-block">{`{
  "success": false,
  "error": {
    "code": "MONTHLY_LIMIT_REACHED",
    "message": "Monthly document limit reached (100)",
    "hint": "Upgrade your plan at ebenova.dev/pricing"
  }
}`}</pre>
            <table className="docs-table">
              <thead><tr><th>HTTP Status</th><th>Code</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td>400</td><td><code>MISSING_FIELD</code></td><td>Required parameter missing or invalid</td></tr>
                <tr><td>400</td><td><code>UNSUPPORTED_TYPE</code></td><td>Unknown document_type</td></tr>
                <tr><td>401</td><td><code>MISSING_AUTH</code></td><td>No Authorization header provided</td></tr>
                <tr><td>401</td><td><code>INVALID_API_KEY</code></td><td>API key not found or invalid</td></tr>
                <tr><td>403</td><td><code>KEY_DISABLED</code></td><td>This key has been disabled</td></tr>
                <tr><td>405</td><td><code>METHOD_NOT_ALLOWED</code></td><td>Wrong HTTP method</td></tr>
                <tr><td>429</td><td><code>MONTHLY_LIMIT_REACHED</code></td><td>Monthly document quota exceeded</td></tr>
                <tr><td>500</td><td><code>GENERATION_FAILED</code></td><td>AI generation failed — retry</td></tr>
                <tr><td>500</td><td><code>SERVER_ERROR</code></td><td>Internal server error</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── Insights API ── */}
          <section id="insights">
            <h2>Insights API</h2>
            <p>
              Monitor Reddit and Nairaland 24/7 for mentions relevant to your product.
              Get email alerts with AI-drafted replies. Requires an Insights subscription.
            </p>
            <p>Base URL: <code>https://api.ebenova.dev/v1/insights</code></p>

            <h3>Endpoints</h3>
            <table className="docs-table">
              <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td>GET</td><td><code>/v1/insights/monitors</code></td><td>List all your monitors</td></tr>
                <tr><td>POST</td><td><code>/v1/insights/monitors</code></td><td>Create a new monitor</td></tr>
                <tr><td>DELETE</td><td><code>/v1/insights/monitors/:id</code></td><td>Delete a monitor</td></tr>
                <tr><td>GET</td><td><code>/v1/insights/matches</code></td><td>List matches for a monitor</td></tr>
                <tr><td>POST</td><td><code>/v1/insights/matches/draft</code></td><td>Regenerate AI reply draft for a match</td></tr>
                <tr><td>POST</td><td><code>/v1/insights/matches/feedback</code></td><td>Submit feedback on a match</td></tr>
              </tbody>
            </table>

            <h3>Plans</h3>
            <table className="docs-table">
              <thead><tr><th>Plan</th><th>Monitors</th><th>Keywords</th><th>AI Model</th><th>Price</th></tr></thead>
              <tbody>
                <tr><td>Starter</td><td>3</td><td>20 each</td><td>Groq (Llama 3.3 70B)</td><td>$49/mo</td></tr>
                <tr><td>Growth</td><td>20</td><td>100 each</td><td>Claude Haiku</td><td>$99/mo</td></tr>
                <tr><td>Scale</td><td>100</td><td>500 each</td><td>Claude Haiku</td><td>$249/mo</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── Vigil Fraud Alert API ── */}
          <section id="vigil">
            <h2>Vigil Fraud Alert API</h2>
            <p>
              Proximity-based card fraud detection. Authorize transactions using GPS proximity,
              manage card profiles, compute risk scores, and generate AI-powered fraud analysis
              and AML compliance reports. All endpoints require authentication.
            </p>

            <h3>Endpoints</h3>
            <table className="docs-table">
              <thead><tr><th>Method</th><th>Endpoint</th><th>Tier</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td>POST</td><td>/v1/vigil/authorize</td><td>Starter+</td><td>Authorize a card transaction via GPS proximity</td></tr>
                <tr><td>GET</td><td>/v1/vigil/score</td><td>Starter+</td><td>Get live risk score for a card</td></tr>
                <tr><td>GET/POST/PUT</td><td>/v1/vigil/card</td><td>Starter+</td><td>Register, retrieve, or update card profiles</td></tr>
                <tr><td>POST</td><td>/v1/vigil/gps</td><td>Starter+</td><td>Submit device GPS location for a card</td></tr>
                <tr><td>POST</td><td>/v1/vigil/analyze</td><td>Growth+</td><td>AI fraud analysis (Claude Haiku)</td></tr>
                <tr><td>POST</td><td>/v1/vigil/report</td><td>Scale+</td><td>AML compliance report (Claude Sonnet)</td></tr>
              </tbody>
            </table>

            <h3>Authorize Transaction</h3>
            <p><code>POST /v1/vigil/authorize</code></p>
            <pre className="code-block">{`curl -X POST "https://api.ebenova.dev/v1/vigil/authorize" \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "card_id": "card_abc123",
    "merchant_name": "Tim Hortons",
    "merchant_country": "CA",
    "amount_cents": 450,
    "currency": "CAD"
  }'`}</pre>
            <p>
              The engine checks the card&apos;s GPS proximity, mode (normal/travel/lockdown),
              and travel plans. Returns an approve/decline decision with reason code and distance.
            </p>

            <h3>Get Risk Score</h3>
            <p><code>GET /v1/vigil/score?card_id=CARD_ID</code></p>
            <pre className="code-block">{`curl "https://api.ebenova.dev/v1/vigil/score?card_id=card_abc123" \\
  -H "Authorization: Bearer sk_live_your_api_key"`}</pre>
            <p>Returns a 0&ndash;1.0 risk score with breakdown: block rate, outside-radius events, and lockdown history.</p>

            <h3>Register Card</h3>
            <p><code>POST /v1/vigil/card</code></p>
            <pre className="code-block">{`curl -X POST "https://api.ebenova.dev/v1/vigil/card" \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "card_id": "card_abc123",
    "home_lat": 43.6532,
    "home_lng": -79.3832,
    "home_country": "CA",
    "radius_km": 25
  }'`}</pre>

            <h3>Submit GPS</h3>
            <p><code>POST /v1/vigil/gps</code></p>
            <pre className="code-block">{`curl -X POST "https://api.ebenova.dev/v1/vigil/gps" \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "card_id": "card_abc123",
    "lat": 43.6510,
    "lng": -79.3470,
    "accuracy_meters": 15
  }'`}</pre>
            <p>GPS data expires after 1 hour. Submit regularly from the cardholder&apos;s device.</p>

            <h3>AI Fraud Analysis (Growth+)</h3>
            <p><code>POST /v1/vigil/analyze</code></p>
            <pre className="code-block">{`curl -X POST "https://api.ebenova.dev/v1/vigil/analyze" \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "card_id": "card_abc123",
    "merchant_name": "CryptoExchange",
    "merchant_country": "NG",
    "amount_cents": 500000,
    "currency": "USD",
    "mcc": "6051"
  }'`}</pre>
            <p>Claude Haiku analyzes velocity, geography, MCC risk, time-of-day, and amount patterns.</p>

            <h3>AML Report (Scale+)</h3>
            <p><code>POST /v1/vigil/report</code></p>
            <pre className="code-block">{`curl -X POST "https://api.ebenova.dev/v1/vigil/report" \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "card_id": "card_abc123",
    "period": "last 30 days",
    "report_type": "standard"
  }'`}</pre>
            <p>Claude Sonnet generates audit-ready AML compliance reports with risk assessment, transaction analysis, and regulatory recommendations.</p>

            <h3>Plans &amp; Limits</h3>
            <table className="docs-table">
              <thead><tr><th>Plan</th><th>Price</th><th>Authorizations/mo</th><th>AI Analysis</th><th>AML Reports</th></tr></thead>
              <tbody>
                <tr><td>Starter</td><td>$29/mo</td><td>500</td><td>-</td><td>-</td></tr>
                <tr><td>Growth</td><td>$79/mo</td><td>5,000</td><td>Included</td><td>-</td></tr>
                <tr><td>Scale</td><td>$199/mo</td><td>25,000</td><td>Included</td><td>Included</td></tr>
                <tr><td>Enterprise</td><td>Custom</td><td>100,000+</td><td>Included</td><td>Included</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── FieldOps Agent API ── */}
          <section id="fieldops">
            <h2>FieldOps Agent API</h2>
            <p>
              WhatsApp-native booking, revenue recovery, and staff coordination for service businesses
              (cleaners, mechanics, electricians, salons). FieldOps runs as a separate Railway service that
              the Ebenova API proxies into — your API key authenticates to Ebenova, Ebenova authenticates
              to FieldOps with an internal key.
            </p>
            <p>
              <strong>Separate-service deployment.</strong> The FieldOps server is not bundled with the
              standard Ebenova API. To enable FieldOps on your account, email{' '}
              <a href="mailto:info@ebenova.net">info@ebenova.net</a> with your business details.
            </p>

            <h3>Endpoints</h3>
            <table className="docs-table">
              <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td>POST</td><td>/v1/bookings</td><td>Create a new booking (sends WhatsApp confirmation to customer + staff briefing)</td></tr>
                <tr><td>GET</td><td>/v1/bookings/:id</td><td>Get booking status, payment state, and assignment</td></tr>
              </tbody>
            </table>

            <h3>Create a booking</h3>
            <pre className="code-block">{`curl -X POST "https://api.ebenova.dev/v1/bookings" \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_name":  "Mrs. Adeyemi",
    "customer_phone": "+2348012345678",
    "service":        "Deep clean — 3-bedroom apartment",
    "date":           "2026-05-02",
    "time":           "10:00",
    "address":        "Flat 4B, 22 Bourdillon Rd, Ikoyi, Lagos",
    "amount_cents":   3500000,
    "currency":       "NGN",
    "notes":          "Has 2 cats — please use pet-safe products."
  }'`}</pre>

            <h3>Required fields</h3>
            <p><code>customer_name</code>, <code>customer_phone</code>, <code>service</code>, <code>date</code>, <code>time</code>, <code>address</code>.</p>

            <h3>What FieldOps does for each booking</h3>
            <ul>
              <li>WhatsApp confirmation message to the customer with booking summary + payment link</li>
              <li>Staff briefing sent to assigned worker (job details, address pin, customer notes)</li>
              <li>3-step automated invoice recovery (24h, 72h, 7d reminders) if unpaid after job complete</li>
              <li>Payment via OxaPay (USDT) or Polar (Mastercard) — your choice per region</li>
            </ul>
            <p>If the FieldOps server is not configured, this endpoint returns <code>503 FIELDOPS_UNAVAILABLE</code>.</p>
          </section>

          <section id="support">
            <h2>Support</h2>
            <p>
              Questions? Email <a href="mailto:info@ebenova.net">info@ebenova.net</a> or
              open an issue on <a href="https://github.com/dgtalquantumleap-ai/signova" target="_blank" rel="noopener noreferrer">GitHub</a>.
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}
