import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import './Docs.css'

export default function Docs() {
  const navigate = useNavigate()

  return (
    <div className="docs-page">
      <Helmet>
        <title>API Documentation | Ebenova — Legal Document Generation API</title>
        <meta name="description" content="Generate legally compliant contracts, NDAs, and business documents via API. 27 document types, 18 jurisdictions. Simple REST API with JSON responses." />
        <link rel="canonical" href="https://ebenova.dev/docs" />
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
            <li><a href="#extract">Extract from Conversation</a></li>
            <li><a href="#usage">Check Usage</a></li>
            <li><a href="#document-types">Document Type Reference</a></li>
            <li><a href="#sdk">SDKs &amp; MCP</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#errors">Error Codes</a></li>
          </ul>
        </aside>

        <main className="docs-content">
          <h1>Ebenova API</h1>
          <p className="docs-intro">
            Generate professionally drafted legal documents in seconds.
            27 document types, 18 jurisdictions, one simple API.
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
              Get your API key at <a href="https://ebenova.dev/dashboard" target="_blank" rel="noopener noreferrer">ebenova.dev/dashboard</a>.
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
            <p>Returns all 27 document types as a flat list and grouped by category.</p>
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
            <p>27 document types across 5 categories:</p>

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
              <li><em>"What legal document types do you support?"</em></li>
            </ul>

            <p>
              The MCP server is also listed on{' '}
              <a href="https://smithery.ai/server/ebenova/legal-docs" target="_blank" rel="noopener noreferrer">Smithery</a>.
              Source code on <a href="https://github.com/dgtalquantumleap-ai/legal-docs-mcp" target="_blank" rel="noopener noreferrer">GitHub</a>.
            </p>
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

          <section id="support">
            <h2>Support</h2>
            <p>
              Questions? Email <a href="mailto:api@ebenova.dev">api@ebenova.dev</a> or
              open an issue on <a href="https://github.com/ebenova/legal-docs-mcp" target="_blank" rel="noopener noreferrer">GitHub</a>.
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}
