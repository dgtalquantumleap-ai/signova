import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import './LegalPage.css'

export default function VigilTerms() {
  const navigate = useNavigate()
  return (
    <div className="legal-page">
      <Helmet>
        <title>Vigil Fraud Alert API — Terms Addendum | Ebenova</title>
        <meta name="description" content="Terms of Service addendum for the Vigil Fraud Alert API. Covers card data handling, GPS/location data, AI decisioning, acceptable use, SLA, and compliance obligations." />
        <link rel="canonical" href="https://www.ebenova.dev/vigil/terms" />
      </Helmet>

      <nav className="legal-nav">
        <button className="legal-back" onClick={() => navigate('/vigil')}>← Back to Vigil</button>
        <div className="logo">
          <span className="logo-mark">E</span>
          <span className="logo-text">ebenova.dev</span>
        </div>
      </nav>

      <div className="legal-body">
        <h1>Vigil Fraud Alert API — Terms Addendum</h1>
        <p className="legal-date">Effective: April 2026 · Version 1.0</p>

        <p>
          This addendum supplements the <a href="/terms">Ebenova Terms of Use</a> and applies
          specifically to your use of the <strong>Vigil Fraud Alert API</strong> ("Vigil"),
          including the REST endpoints under <code>/v1/vigil/*</code> and the MCP tools
          <code> vigil_*</code> exposed at <code>/mcp</code>. By calling any Vigil endpoint
          with your API key, you agree to both documents. If they conflict, this addendum
          controls with respect to Vigil.
        </p>

        <h2>1. Scope and purpose</h2>
        <p>
          Vigil is a developer API that combines GPS-based proximity checks with Claude AI
          (Haiku and Sonnet) to help you decide whether to approve, decline, or escalate
          card-not-present and card-present transactions, and to help generate Anti-Money
          Laundering ("AML") review reports. Vigil is an <em>advisory</em> service. It does
          not replace your obligations under card-network rules (Visa, Mastercard,
          Interac, etc.), payment-processor agreements, or applicable law.
        </p>

        <h2>2. Not a regulated financial service</h2>
        <p>
          Ebenova Solutions ("we", "us") is not a bank, payment processor, card issuer,
          money-services business, or regulated financial institution. Vigil does not
          settle funds, issue or manage cards, or act as your AML compliance officer. You
          are solely responsible for final authorize/decline decisions, Suspicious
          Activity Reporting, sanctions screening, and any regulatory filings. Vigil's
          output is signal, not judgment.
        </p>

        <h2>3. Your data handling responsibilities</h2>
        <p>You may only submit to Vigil data you have a lawful basis to process, and you agree to the following:</p>
        <ul>
          <li><strong>Never submit full PANs.</strong> Vigil's <code>card_id</code> field is meant for your internal tokens or network IDs — not 16-digit card numbers. If you send a full PAN, we will reject the request and may suspend your key.</li>
          <li><strong>Cardholder consent for GPS.</strong> Before calling <code>POST /v1/vigil/gps</code> with a cardholder's device location, you must have obtained their informed consent in a manner compliant with GDPR, PIPEDA, CCPA, and any other privacy law applicable to that cardholder.</li>
          <li><strong>PII minimization.</strong> Submit only the fields required by the endpoint schema. Do not embed names, addresses, emails, phone numbers, or government IDs in free-text fields.</li>
          <li><strong>DPA.</strong> If you process personal data of EU/UK/Canadian/California residents through Vigil, you must sign our Data Processing Addendum before going to production. Email <a href="mailto:api@ebenova.dev">api@ebenova.dev</a> to request one.</li>
        </ul>

        <h2>4. What we store, and for how long</h2>
        <p>
          Vigil stores card profile metadata (home coordinates, radius, travel plans, lock
          status), the most recent device GPS fix (1-hour TTL), a rolling count of
          authorizations, and the last 90 days of transaction decisions for risk scoring.
          Raw AI prompts sent to Anthropic are <em>not retained</em> by us; Anthropic's
          zero-data-retention policy applies when called through the Vercel AI Gateway.
          You can request deletion of your card data at any time via
          <code> DELETE /v1/vigil/card/:id</code> or by emailing us.
        </p>

        <h2>5. AI accuracy and limitations</h2>
        <p>
          AI risk scoring and AML report generation rely on large language models, which
          can produce false positives, false negatives, and occasional hallucinated
          rationale. You must not rely on Vigil as the <em>sole</em> basis for blocking a
          cardholder, freezing funds, filing a SAR, or terminating a customer
          relationship. Always combine Vigil signals with your existing fraud/compliance
          stack and human review for high-impact decisions.
        </p>

        <h2>6. Acceptable use</h2>
        <p>You may not use Vigil to:</p>
        <ul>
          <li>Surveil individuals without a lawful basis (e.g., covert GPS tracking of partners, employees without consent, or minors).</li>
          <li>Discriminate against any class protected by applicable law (race, religion, national origin, gender, sexual orientation, disability, etc.).</li>
          <li>Build redlining, social-scoring, predictive-policing, or immigration-enforcement systems.</li>
          <li>Reverse-engineer our scoring weights, extract training data, or train a competing model on Vigil outputs.</li>
          <li>Exceed your tier's monthly authorization quota by rotating keys or creating multiple accounts.</li>
        </ul>
        <p>Violation of this section is grounds for immediate termination without refund.</p>

        <h2>7. Tier limits</h2>
        <p>Monthly authorization quotas apply to the <code>/v1/vigil/authorize</code> endpoint:</p>
        <ul>
          <li><strong>Starter</strong> — 500 authorizations/month (proximity engine only).</li>
          <li><strong>Growth</strong> — 5,000 authorizations/month, plus Claude Haiku AI analysis.</li>
          <li><strong>Scale</strong> — 25,000 authorizations/month, plus Claude Sonnet AML reports.</li>
          <li><strong>Enterprise</strong> — 100,000+ authorizations/month; contact us for pricing.</li>
        </ul>
        <p>Over-quota requests are rejected with HTTP 429. We reserve the right to throttle bursts above 100 req/sec per key.</p>

        <h2>8. Service availability</h2>
        <p>
          We target 99.5% monthly uptime for Vigil's proximity engine (Starter+) and 99.0%
          for AI-backed endpoints (Growth+, Scale+). Uptime excludes scheduled
          maintenance, force majeure, and outages at upstream providers (Anthropic,
          Upstash, Vercel, Railway). We publish incidents at
          <a href="https://status.ebenova.dev" rel="noopener noreferrer" target="_blank"> status.ebenova.dev</a>.
          There is no SLA credit on Starter; Growth and Scale customers receive a 10%
          monthly credit for uptime below the target, applied to the following month.
        </p>

        <h2>9. Integration with upstream Vigil backend</h2>
        <p>
          Vigil's hosted endpoints may optionally proxy to a self-hosted Vigil MCP server
          (the open-source reference implementation at
          <a href="https://github.com/dgtalquantumleap-ai/vigil-fraud-alert-mcp" rel="noopener noreferrer" target="_blank"> github.com/dgtalquantumleap-ai/vigil-fraud-alert-mcp</a>).
          When you run your own backend, you are responsible for its security, patching,
          and compliance. We provide the open-source code as-is, under the MIT license,
          with no warranty.
        </p>

        <h2>10. Confidentiality of risk signals</h2>
        <p>
          Vigil's scoring rationale ("explanation" field) is provided to help you improve
          your review workflow. You may share it internally with reviewers and
          auditors, but you may not display it verbatim to the cardholder whose transaction
          was scored — doing so can tip off fraudsters and weaken future signals for all
          Vigil customers.
        </p>

        <h2>11. Termination</h2>
        <p>
          We may suspend or terminate your Vigil access immediately if we detect (a) full
          PANs in your payloads, (b) scraping or quota-evasion behaviour, (c) use for
          prohibited purposes under section 6, or (d) a security incident affecting you
          or other customers. Your API key remains valid for other Ebenova endpoints
          unless we terminate the underlying subscription.
        </p>

        <h2>12. Liability cap</h2>
        <p>
          Our aggregate liability for any claim arising from Vigil — including wrongful
          approval, wrongful decline, chargebacks, lost revenue, regulatory fines, and
          AI-generated errors — is capped at the fees you paid us for Vigil usage in the
          three (3) months preceding the claim. Vigil is provided on an "AS IS" and "AS
          AVAILABLE" basis, without warranties of any kind.
        </p>

        <h2>13. Governing law</h2>
        <p>
          This addendum is governed by the laws of the Province of Ontario, Canada,
          without regard to conflict-of-laws principles. Disputes shall be resolved in
          the courts of Toronto, Ontario. If you are a consumer in the EU or UK,
          mandatory local protections are unaffected.
        </p>

        <h2>14. Contact</h2>
        <p>
          For DPA requests, security reports, incident coordination, or questions about
          this addendum, email <a href="mailto:api@ebenova.dev">api@ebenova.dev</a>.
          Security vulnerabilities may be reported confidentially to
          <a href="mailto:security@ebenova.dev"> security@ebenova.dev</a>.
        </p>

        <h2>15. Changes</h2>
        <p>
          We will notify you by email and via an in-dashboard banner at least 14 days
          before any material change to this addendum takes effect. Continued use of
          Vigil after the effective date constitutes acceptance.
        </p>
      </div>
    </div>
  )
}
