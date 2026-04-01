import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { track } from '../lib/analytics'
import './ApiLanding.css'

const API_CARDS = [
  {
    id: 'scope-guard',
    icon: '🛡️',
    title: 'Scope Guard™ API',
    desc: 'Your client just asked for something not in the contract. Paste the contract + their message. Get back: what they\'re violating, 3 professional response drafts, and a change order price. One API call.',
    features: ['Detects 6 violation types', '3 professional response drafts', 'Auto-calculated change order pricing', 'Zero API competitors — industry first'],
    endpoint: 'POST /v1/scope/analyze',
    cta: 'View API Docs',
    link: '/docs#scope-guard',
    highlight: true,
  },
  {
    id: 'documents',
    icon: '📄',
    title: 'Legal Documents API',
    desc: 'Generate 27 document types across 18 jurisdictions. NDAs, contracts, tenancy agreements, and more.',
    features: ['27 document types', '18 jurisdictions', 'AI-powered drafting'],
    endpoint: 'POST /v1/documents/generate',
    cta: 'Generate Document',
    link: '/docs#generate',
  },
  {
    id: 'invoices',
    icon: '🧾',
    title: 'Invoice & Receipt API',
    desc: 'Create professional invoices, receipts, and proforma invoices with multi-currency support.',
    features: ['PDF + HTML output', '12+ currencies', 'Auto-calculations'],
    endpoint: 'POST /v1/invoices/generate',
    cta: 'Generate Invoice',
    link: '/docs#invoices',
  },
  {
    id: 'extraction',
    icon: '💬',
    title: 'WhatsApp Extraction API',
    desc: 'Paste any conversation — WhatsApp, email, chat. Extract structured fields and generate contracts.',
    features: ['Field extraction', 'Auto-document generation', '10k context window'],
    endpoint: 'POST /v1/extract/conversation',
    cta: 'Extract Fields',
    link: '/docs#extract',
  },
  {
    id: 'templates',
    icon: '📋',
    title: 'Document Templates API',
    desc: 'Get field schemas for all 27 document types. Build dynamic forms, validate input, or understand requirements before generating.',
    features: ['27 document schemas', 'Field types & validation', 'Zero AI cost'],
    endpoint: 'GET /v1/documents/templates',
    cta: 'View Templates',
    link: '/docs#templates',
  },
  {
    id: 'batch',
    icon: '📦',
    title: 'Batch Generation API',
    desc: 'Generate up to 10 legal documents in a single API call. Perfect for onboarding multiple clients or vendors at once.',
    features: ['Up to 10 docs per call', 'Independent processing', 'Detailed results'],
    endpoint: 'POST /v1/documents/batch',
    cta: 'View Docs',
    link: '/docs#batch',
  },
  {
    id: 'contract-link',
    icon: '🔗',
    title: 'Contract-Payment Linking API',
    desc: 'Associate contracts with payment references. Track which contracts have been paid, look up by bank transfer ref or contract ID.',
    features: ['Bidirectional lookup', 'Payment status tracking', 'Redis-backed storage'],
    endpoint: 'POST /v1/contracts/link',
    cta: 'View Docs',
    link: '/docs#contract-link',
  },
  {
    id: 'insights',
    icon: '📡',
    title: 'Insights — Reddit Monitor API',
    desc: 'Monitor Reddit and Nairaland for keywords about your product. Get email alerts with AI-drafted replies every 15 minutes. Built for founders doing distribution.',
    features: ['Reddit + Nairaland monitoring', 'AI reply drafts (community tone)', 'Subreddit safety system', 'Multi-tenant — serve multiple clients'],
    endpoint: 'POST /v1/monitors',
    cta: 'Learn More',
    link: '/insights',
  },
  {
    id: 'payouts',
    icon: '💸',
    title: 'Africa Payouts API',
    desc: 'Send payments to bank accounts and mobile money across 10+ African countries.',
    features: ['Join waitlist for early access', 'Mobile money + bank', 'Real-time settlement'],
    endpoint: 'POST /v1/payouts/send',
    cta: 'Join Waitlist',
    link: '/contact',
    disabled: true,
  },
]

const USE_CASES = [
  {
    icon: '🏠',
    title: 'Property Rental Platforms',
    problem: 'Tenants forge bank transfer receipts. Landlords release keys without payment.',
    solution: 'Link tenancy agreements to payment references. Verify transfers before auto-sending keys.',
  },
  {
    icon: '💼',
    title: 'Freelance Marketplaces',
    problem: 'Clients request "small extras" until scope balloons. Freelancers have no leverage.',
    solution: 'Auto-detect scope violations. Generate change orders with one click. Link payment to deliverables.',
  },
  {
    icon: '🏦',
    title: 'Fintechs & Lenders',
    problem: 'Loan agreements are generic. Jurisdiction enforcement is manual. Default tracking is broken.',
    solution: 'Generate jurisdiction-aware loan agreements. Link to repayment schedules. Auto-track defaults.',
  },
  {
    icon: '🤖',
    title: 'AI Agents & SaaS',
    problem: 'AI agents can draft documents but cannot verify payments or enforce contracts.',
    solution: 'MCP-native API. Connect Claude, Cursor, or custom agents to the full trust stack.',
  },
]

const PRICING_TIERS = [
  {
    name: 'Free',
    price: 0,
    verifications: 50,
    docs: 5,
    cta: 'Get Free API Key',
    tier: 'free',
    highlight: false,
    features: [
      '50 payment verifications/month',
      '5 documents/month',
      'All API endpoints',
      'Community support',
      '10 requests/min',
    ],
  },
  {
    name: 'Starter',
    price: 29,
    verifications: 500,
    docs: 100,
    cta: 'Upgrade to Starter',
    tier: 'starter',
    highlight: true,
    features: [
      '500 payment verifications/month',
      '100 documents/month',
      'All API endpoints',
      'Email support',
      '60 requests/min',
      'Usage analytics',
    ],
  },
  {
    name: 'Growth',
    price: 79,
    verifications: 2000,
    docs: 500,
    cta: 'Upgrade to Growth',
    tier: 'growth',
    highlight: false,
    features: [
      '2,000 payment verifications/month',
      '500 documents/month',
      'All API endpoints',
      'Priority support',
      '120 requests/min',
      'Usage analytics',
      'Custom jurisdictions',
    ],
  },
  {
    name: 'Scale',
    price: 199,
    verifications: 10000,
    docs: 2000,
    cta: 'Contact Sales',
    tier: 'scale',
    highlight: false,
    features: [
      '10,000 payment verifications/month',
      '2,000 documents/month',
      'All API endpoints',
      'Dedicated support',
      '300 requests/min',
      'Custom integrations',
      'SLA guarantee',
    ],
  },
]

const MCP_EXAMPLE = `{
  "mcpServers": {
    "ebenova-legal": {
      "command": "npx",
      "args": ["-y", "@ebenova/legal-docs-mcp"],
      "env": {
        "EBENOVA_API_KEY": "sk_live_xxx"
      }
    }
  }
}`

const CURL_EXAMPLE = `curl -X POST https://api.ebenova.dev/v1/documents/generate \\
  -H "Authorization: Bearer sk_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "document_type": "nda",
    "fields": {
      "disclosingParty": "Acme Inc.",
      "receivingParty": "John Smith",
      "purpose": "Partnership discussion",
      "duration": "2 years",
      "mutual": "Yes"
    },
    "jurisdiction": "Nigeria"
  }'`

export default function ApiLanding() {
  const navigate = useNavigate()
  const [copiedCode, setCopiedCode] = useState(null)

  const handleCopyCode = (code, id) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    track('code_copied', { code_type: id })
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleGetApiKey = () => {
    track('api_cta_click', { cta: 'get_api_key', location: 'hero' })
    navigate('/dashboard')
  }

  const handlePricingCta = (tier) => {
    track('pricing_cta_click', { tier })
    if (tier === 'free' || tier === 'starter' || tier === 'growth') {
      navigate('/dashboard')
    } else if (tier === 'scale') {
      window.location.href = 'mailto:api@ebenova.dev?subject=Scale%20Tier%20Inquiry'
    }
  }

  const handleViewDocs = () => {
    track('api_cta_click', { cta: 'view_docs', location: 'hero' })
    navigate('/docs')
  }

  return (
    <div className="api-landing">
      <Helmet>
        <title>Ebenova — Developer APIs for Legal Documents, Invoices & Emerging Markets</title>
        <meta name="description" content="Generate 27 legal document types across 18 jurisdictions, create invoices, verify payments, and monitor Reddit — one API platform built for emerging market commerce. Free tier available." />
        <link rel="canonical" href="https://www.ebenova.dev/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Ebenova" />
        <meta property="og:url" content="https://www.ebenova.dev/" />
        <meta property="og:title" content="Ebenova — Developer APIs for Legal Documents & Emerging Markets" />
        <meta property="og:description" content="27 document types, 18 jurisdictions, invoice generation, Reddit monitoring, and MCP servers for AI agents. Free tier. No credit card required." />
        <meta property="og:image" content="https://www.ebenova.dev/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@ebenova_dev" />
        <meta name="twitter:title" content="Ebenova — Developer APIs for Legal Documents & Emerging Markets" />
        <meta name="twitter:description" content="27 document types, 18 jurisdictions, invoice generation, Reddit monitoring, and MCP servers for AI agents. Free tier." />
        <meta name="twitter:image" content="https://www.ebenova.dev/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Ebenova API",
          "url": "https://www.ebenova.dev",
          "description": "Developer-first API platform for legal document generation, invoices, contract enforcement, and Reddit monitoring. 27 document types across 18 jurisdictions including Nigeria, Kenya, Ghana, UK, US, and Canada.",
          "applicationCategory": "DeveloperApplication",
          "operatingSystem": "Web",
          "offers": [
            { "@type": "Offer", "name": "Free Tier", "price": "0", "priceCurrency": "USD" },
            { "@type": "Offer", "name": "Starter", "price": "29", "priceCurrency": "USD", "billingIncrement": "month" },
            { "@type": "Offer", "name": "Growth", "price": "79", "priceCurrency": "USD", "billingIncrement": "month" },
            { "@type": "Offer", "name": "Scale", "price": "199", "priceCurrency": "USD", "billingIncrement": "month" }
          ],
          "provider": {
            "@type": "Organization",
            "name": "Ebenova Solutions",
            "url": "https://www.ebenova.dev",
            "email": "api@ebenova.dev"
          }
        })}</script>
      </Helmet>

      {/* Navigation */}
      <nav className="api-nav">
        <div className="api-nav-inner">
          <div className="api-logo" onClick={() => navigate('/')}>
            <span className="api-logo-mark">E</span>
            <span className="api-logo-text">ebenova.dev</span>
          </div>
          <div className="api-nav-links">
            <a href="#apis">APIs</a>
            <a href="#pricing">Pricing</a>
            <a href="#mcp">MCP</a>
            <a href="/insights">Insights</a>
            <a href="/docs">Docs</a>
            <a href="/contact" className="api-nav-cta">Contact</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="api-hero">
        <div className="api-hero-glow" />
        <div className="api-hero-inner">
          <div className="api-hero-badge">
            <span className="badge-dot" />
            Now Live · Production Ready
          </div>

          <h1 className="api-hero-title">
            Legal document generation for<br />
            <span className="highlight">the markets others skip.</span>
          </h1>

          <p className="api-hero-sub">
            27 document types. Native coverage for Nigeria, Kenya, Ghana, and 180+ countries.
            Contracts, invoices, scope enforcement — one API. MCP-native for AI agents.
          </p>

          {/* API call counter — social proof */}
          <div className="api-counter-banner">
            <div className="api-counter-number">5,000+</div>
            <div className="api-counter-text">
              <div>API calls made</div>
              <div className="api-counter-sub">Across 18 jurisdictions</div>
            </div>
          </div>

          <div className="api-hero-actions">
            <button className="api-btn-primary api-btn-large" onClick={handleGetApiKey}>
              Get API Key — Free <span className="btn-arrow">→</span>
            </button>
            <button className="api-btn-outline api-btn-large" onClick={handleViewDocs}>
              View Documentation
            </button>
          </div>

          <div className="trust-signals">
            <span>✓ No credit card required</span>
            <span>✓ Nigeria · Kenya · Ghana · 180+ countries</span>
            <span>✓ 27 Document Types</span>
            <span>✓ Free tier · No commitment</span>
          </div>

          {/* Code Example */}
          <div className="api-hero-code">
            <div className="code-header">
              <span className="code-label">Generate your first document in 60 seconds</span>
              <button
                className="code-copy"
                onClick={() => handleCopyCode(CURL_EXAMPLE, 'hero-curl')}
              >
                {copiedCode === 'hero-curl' ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
            <pre className="code-block">
              <code>{CURL_EXAMPLE}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="api-use-cases-section" id="use-cases">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Use Cases</p>
            <h2 className="section-title">Built for African Business Workflows</h2>
          </div>

          <div className="api-use-cases-grid">
            {USE_CASES.map((useCase, i) => (
              <div key={i} className="api-use-case-card">
                <div className="api-use-case-icon">{useCase.icon}</div>
                <h3 className="api-use-case-title">{useCase.title}</h3>
                <p className="api-use-case-problem">
                  <strong>Pain:</strong> {useCase.problem}
                </p>
                <p className="api-use-case-solution">
                  <strong>Solution:</strong> {useCase.solution}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Cards Section */}
      <section className="api-cards-section" id="apis">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Our APIs</p>
            <h2 className="section-title">Everything you need to build</h2>
          </div>

          <div className="api-cards-grid">
            {API_CARDS.map(card => (
              <div 
                key={card.id} 
                className={`api-card ${card.disabled ? 'disabled' : ''} ${card.highlight ? 'highlight' : ''}`}
              >
                <div className="api-card-icon">{card.icon}</div>
                <h3 className="api-card-title">{card.title}</h3>
                <p className="api-card-desc">{card.desc}</p>
                
                <ul className="api-card-features">
                  {card.features.map((feature, i) => (
                    <li key={i} className={feature.includes('Coming') ? 'coming-soon' : ''}>
                      {feature.includes('Coming') ? '⏳' : '✓'} {feature}
                    </li>
                  ))}
                </ul>

                <div className="api-card-endpoint">
                  <code>{card.endpoint}</code>
                </div>

                {!card.disabled && (
                  <button 
                    className="api-card-cta"
                    onClick={() => navigate(card.link)}
                  >
                    {card.cta} <span className="btn-arrow">→</span>
                  </button>
                )}
                {card.disabled && (
                  <button 
                    className="api-card-cta api-card-cta-disabled"
                    onClick={() => navigate(card.link)}
                  >
                    {card.cta} <span className="btn-arrow">→</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section className="api-comparison-section" id="why-ebenova">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Why Ebenova</p>
            <h2 className="section-title">Built for African Business, Not Copied from Silicon Valley</h2>
          </div>

          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="competitors">Stripe / DocuSign</th>
                  <th className="ebenova">Ebenova</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="feature">Banking Laws</td>
                  <td className="competitors">US/EU focused</td>
                  <td className="ebenova">Nigerian, Kenyan, Ghanaian banking act compliance</td>
                </tr>
                <tr>
                  <td className="feature">Payment Verify</td>
                  <td className="competitors">Card payments only</td>
                  <td className="ebenova">Bank transfer + Mobile money (M-Pesa, MoMo, OPay)</td>
                </tr>
                <tr>
                  <td className="feature">Jurisdiction</td>
                  <td className="competitors">Generic templates</td>
                  <td className="ebenova">18 jurisdictions with local clause variants</td>
                </tr>
                <tr>
                  <td className="feature">Contract-Payment</td>
                  <td className="competitors">Separate systems</td>
                  <td className="ebenova">Native linking API (one call, bidirectional)</td>
                </tr>
                <tr>
                  <td className="feature">AI Agent Ready</td>
                  <td className="competitors">No MCP servers</td>
                  <td className="ebenova">MCP-native (Claude, Cursor)</td>
                </tr>
                <tr>
                  <td className="feature">Pricing</td>
                  <td className="competitors">$40–417+/month</td>
                  <td className="ebenova">$29–199/month (50 verifications free)</td>
                </tr>
                <tr>
                  <td className="feature">Documentation</td>
                  <td className="competitors">Comprehensive, US-focused examples</td>
                  <td className="ebenova">Full REST docs + MCP guide + Nigeria/Kenya/Ghana code examples</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="api-pricing-section" id="pricing">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Pricing</p>
            <h2 className="section-title">Simple, transparent pricing</h2>
          </div>

          <div className="api-pricing-grid">
            {PRICING_TIERS.map((tier, i) => (
              <div 
                key={i} 
                className={`api-price-card ${tier.highlight ? 'highlight' : ''}`}
              >
                {tier.highlight && (
                  <div className="price-badge">Most Popular</div>
                )}
                <h3 className="price-name">{tier.name}</h3>
                <div className="price-amount">
                  {tier.price === 0 ? 'Free' : `$${tier.price}`}
                  <span className="price-period">/month</span>
                </div>
                <p className="price-verifications">{tier.verifications.toLocaleString()} verifications/month</p>
                <p className="price-docs">{tier.docs.toLocaleString()} documents/month</p>
                
                <ul className="price-features">
                  {tier.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>

                <button 
                  className={`api-price-cta ${tier.highlight ? 'highlight' : ''}`}
                  onClick={() => handlePricingCta(tier.tier)}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MCP Section */}
      <section className="api-mcp-section" id="mcp">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">MCP Servers</p>
            <h2 className="section-title">Connect your AI agents</h2>
          </div>

          <div className="api-mcp-content">
            <div className="api-mcp-text">
              <h3>Use Ebenova in Claude Desktop, Cursor, or VS Code</h3>
              <p>
                Our MCP (Model Context Protocol) servers let AI agents generate legal documents,
                extract fields from conversations, and manage invoices — all through natural language.
              </p>
              
              <div className="mcp-install-steps">
                <div className="mcp-step">
                  <span className="step-num">1</span>
                  <p>Install the MCP server via npm</p>
                  <code>npm install -g @ebenova/legal-docs-mcp</code>
                </div>
                <div className="mcp-step">
                  <span className="step-num">2</span>
                  <p>Add to your Claude Desktop config</p>
                </div>
                <div className="mcp-step">
                  <span className="step-num">3</span>
                  <p>Start chatting with your AI agent</p>
                </div>
              </div>

              <button 
                className="api-btn-outline"
                onClick={() => navigate('/docs#sdk')}
              >
                Full Installation Guide
              </button>
            </div>

            <div className="api-mcp-code">
              <div className="code-header">
                <span className="code-label">claude_desktop_config.json</span>
                <button 
                  className="code-copy" 
                  onClick={() => handleCopyCode(MCP_EXAMPLE, 'mcp-config')}
                >
                  {copiedCode === 'mcp-config' ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>
              <pre className="code-block">
                <code>{MCP_EXAMPLE}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="api-cta-section">
        <div className="section-inner">
          <div className="api-cta-box">
            <h2 className="api-cta-title">
              Start building with African business APIs today
            </h2>
            <p className="api-cta-sub">
              Free tier includes 5 documents/month. No credit card required.
              Upgrade as you scale.
            </p>
            <div className="api-cta-actions">
              <button className="api-btn-primary api-btn-large" onClick={handleGetApiKey}>
                Get Your Free API Key <span className="btn-arrow">→</span>
              </button>
            </div>
            <div className="api-cta-trust">
              <span>✓ No credit card required</span>
              <span>✓ 5 free documents/month</span>
              <span>✓ Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="api-footer">
        <div className="api-footer-inner">
          <div className="api-footer-brand">
            <div className="api-logo">
              <span className="api-logo-mark">E</span>
              <span className="api-logo-text">ebenova.dev</span>
            </div>
            <p className="api-footer-desc">
              Developer-first APIs for legal documents, invoices, and African business workflows.
            </p>
          </div>

          <div className="api-footer-links">
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#apis">APIs</a>
              <a href="/docs#scope-guard">Scope Guard API</a>
              <a href="/insights">Insights</a>
              <a href="#pricing">Pricing</a>
              <a href="#mcp">MCP Servers</a>
              <a href="/docs">Documentation</a>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <a href="/about">About</a>
              <a href="/contact">Contact</a>
              <a href="https://getsignova.com" target="_blank" rel="noopener noreferrer">Signova</a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </div>
            <div className="footer-col">
              <h4>Connect</h4>
              <a href="https://github.com/ebenova" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="mailto:api@ebenova.dev">api@ebenova.dev</a>
              <a href="https://status.ebenova.dev" target="_blank" rel="noopener noreferrer">Status</a>
            </div>
          </div>
        </div>
        <div className="api-footer-copy">
          © 2026 Ebenova Solutions · Africa-first · Built in Canada
        </div>
      </footer>
    </div>
  )
}
