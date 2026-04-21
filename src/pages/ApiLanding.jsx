import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { track } from '../lib/analytics'
import SiteFooter from '../components/SiteFooter'
import {
  FileText, Receipt, Shield, Lock, ChatCircle, Link,
  Package, ClipboardText, Robot, Broadcast, ArrowsLeftRight,
  House, Briefcase, Bank, Code,
} from '@phosphor-icons/react'
import './ApiLanding.css'

const API_CARDS = [
  {
    id: 'documents',
    icon: <FileText size={24} weight="duotone" color="currentColor" />,
    title: 'Legal Documents API',
    desc: 'Generate 34 document types across 18 jurisdictions. NDAs, contracts, tenancy agreements, and more.',
    features: ['34 document types', '18 jurisdictions', 'AI-powered drafting'],
    endpoint: 'POST /v1/documents/generate',
    cta: 'Generate Document',
    link: '/docs#generate',
  },
  {
    id: 'invoices',
    icon: <Receipt size={24} weight="duotone" color="currentColor" />,
    title: 'Invoice & Receipt API',
    desc: 'Create professional invoices, receipts, and proforma invoices with multi-currency support.',
    features: ['PDF + HTML output', '12+ currencies', 'Auto-calculations'],
    endpoint: 'POST /v1/invoices/generate',
    cta: 'Generate Invoice',
    link: '/docs#invoices',
  },
  {
    id: 'scope-guard',
    icon: <Shield size={24} weight="duotone" color="currentColor" />,
    title: 'Scope Guard™ API',
    desc: 'Your client just asked for something not in the contract. Paste the contract + their message. Get back: what they\'re violating, 3 professional response drafts, and a change order price. One API call.',
    features: ['Detects 6 violation types', '3 professional response drafts', 'Auto-calculated change order pricing', 'Zero API competitors — industry first'],
    endpoint: 'POST /v1/scope/analyze',
    cta: 'View API Docs',
    link: '/docs#scope-guard',
    highlight: true,
  },
  {
    id: 'vigil',
    icon: <Lock size={24} weight="duotone" color="currentColor" />,
    title: 'Vigil Fraud Alert API',
    desc: 'Proximity-based card fraud detection. GPS haversine engine decides approve/decline in under 150ms. AI risk scoring (Claude Haiku) and AML compliance reports (Claude Sonnet) included on your existing API key — no separate server to deploy.',
    features: ['Real-time proximity authorization', 'AI risk scoring 0–100 (Claude Haiku · Growth+)', 'AML compliance reports (Claude Sonnet · Scale+)', '8 MCP tools — Claude-native'],
    endpoint: 'POST /v1/vigil/authorize',
    cta: 'View Docs',
    link: '/vigil',
    badge: 'Live',
  },
  {
    id: 'extraction',
    icon: <ChatCircle size={24} weight="duotone" color="currentColor" />,
    title: 'WhatsApp Extraction API',
    desc: 'Paste any conversation — WhatsApp, email, chat. Extract structured fields and generate contracts.',
    features: ['Field extraction', 'Auto-document generation', '10k context window'],
    endpoint: 'POST /v1/extract/conversation',
    cta: 'Extract Fields',
    link: '/docs#extract',
  },
  {
    id: 'contract-link',
    icon: <Link size={24} weight="duotone" color="currentColor" />,
    title: 'Contract-Payment Linking API',
    desc: 'Associate contracts with payment references. Track which contracts have been paid, look up by bank transfer ref or contract ID.',
    features: ['Bidirectional lookup', 'Payment status tracking', 'Redis-backed storage'],
    endpoint: 'POST /v1/contracts/link',
    cta: 'View Docs',
    link: '/docs#contract-link',
  },
  {
    id: 'batch',
    icon: <Package size={24} weight="duotone" color="currentColor" />,
    title: 'Batch Generation API',
    desc: 'Generate up to 10 legal documents in a single API call. Perfect for onboarding multiple clients or vendors at once.',
    features: ['Up to 10 docs per call', 'Independent processing', 'Detailed results'],
    endpoint: 'POST /v1/documents/batch',
    cta: 'View Docs',
    link: '/docs#batch',
  },
  {
    id: 'templates',
    icon: <ClipboardText size={24} weight="duotone" color="currentColor" />,
    title: 'Document Templates API',
    desc: 'Get field schemas for all 34 document types. Build dynamic forms, validate input, or understand requirements before generating.',
    features: ['34 document schemas', 'Field types & validation', 'Zero AI cost'],
    endpoint: 'GET /v1/documents/templates',
    cta: 'View Templates',
    link: '/docs#templates',
  },
  {
    id: 'fieldops',
    icon: <Robot size={24} weight="duotone" color="currentColor" />,
    title: 'FieldOps Agent API',
    desc: 'WhatsApp-native booking, revenue recovery, and staff coordination for service businesses. Proxied through the Ebenova API — requires a FieldOps server deployment. Contact info@ebenova.net to get started.',
    features: ['WhatsApp booking + confirmation', '3-step invoice recovery', 'Staff job briefings', '5-tool MCP server', 'OxaPay + Polar payments'],
    endpoint: 'POST /v1/bookings',
    cta: 'View Docs',
    link: '/docs#fieldops',
    highlight: true,
    badge: 'Separate Service',
  },
  {
    id: 'insights',
    icon: <Broadcast size={24} weight="duotone" color="currentColor" />,
    title: 'Insights — Reddit Monitor API',
    desc: 'Monitor Reddit and Nairaland for keywords about your product. Get email alerts with AI-drafted replies every 15 minutes. Built for founders doing distribution.',
    features: ['Reddit + Nairaland monitoring', 'AI reply drafts (community tone)', 'Subreddit safety system', 'Multi-tenant — serve multiple clients'],
    endpoint: 'POST /v1/monitors',
    cta: 'Learn More',
    link: '/insights',
  },
]

const COMING_SOON_APIS = [
  {
    id: 'payouts',
    icon: <ArrowsLeftRight size={24} weight="duotone" color="currentColor" />,
    title: 'Africa Payouts API',
    desc: 'Send payments to bank accounts and mobile money across 10+ African countries.',
    features: ['Mobile money + bank', 'Real-time settlement', 'Join waitlist for early access'],
    endpoint: 'POST /v1/payouts/send',
    cta: 'Join Waitlist',
    link: '/contact',
  },
]

const USE_CASES = [
  {
    icon: <House size={24} weight="duotone" color="currentColor" />,
    title: 'Property Rental Platforms',
    problem: 'Tenants forge bank transfer receipts. Landlords release keys without payment.',
    solution: 'Link tenancy agreements to payment references. Verify transfers before auto-sending keys.',
  },
  {
    icon: <Briefcase size={24} weight="duotone" color="currentColor" />,
    title: 'Freelance Marketplaces',
    problem: 'Clients request "small extras" until scope balloons. Freelancers have no leverage.',
    solution: 'Auto-detect scope violations. Generate change orders with one click. Link payment to deliverables.',
  },
  {
    icon: <Bank size={24} weight="duotone" color="currentColor" />,
    title: 'Fintechs & Lenders',
    problem: 'Loan agreements are generic. Jurisdiction enforcement is manual. Default tracking is broken.',
    solution: 'Generate jurisdiction-aware loan agreements. Link to repayment schedules. Auto-track defaults.',
  },
  {
    icon: <Robot size={24} weight="duotone" color="currentColor" />,
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
      "args": ["-y", "ebenova-legal-docs-mcp"],
      "env": { "EBENOVA_API_KEY": "sk_live_xxx" }
    },
    "reddit-monitor": {
      "command": "npx",
      "args": ["-y", "@ebenova/reddit-monitor-mcp"],
      "env": { "GROQ_API_KEY": "gsk_xxx" }
    },
    "fieldops": {
      "command": "npx",
      "args": ["-y", "@ebenova/fieldops-mcp"],
      "env": { "DATABASE_URL": "postgresql://..." }
    }
  }
}`

const CURL_EXAMPLE = `curl -X POST https://api.ebenova.dev/v1/documents/generate \\
  -H "Authorization: Bearer sk_live_YOUR_API_KEY_HERE" \\
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
    navigate('/pricing')
  }

  const handleViewDocs = () => {
    track('api_cta_click', { cta: 'view_docs', location: 'hero' })
    navigate('/docs')
  }

  const isEbenova = typeof window !== 'undefined'
    && (window.location.hostname === 'ebenova.dev'
      || window.location.hostname === 'www.ebenova.dev'
      || window.location.hostname === 'api.ebenova.dev')

  return (
    <div className="api-landing">
      <Helmet>
        {isEbenova ? (
          <>
            <title>Ebenova — The API Layer for Business Agreements</title>
            <meta name="description" content="Generate contracts, verify payments, detect fraud, enforce scope — 34 document types, 18 jurisdictions. MCP-native. Built for Africa, open to the world. Free tier available." />
            <link rel="canonical" href="https://www.ebenova.dev/" />
            <link rel="alternate" hreflang="en" href="https://www.ebenova.dev/" />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="Ebenova" />
            <meta property="og:url" content="https://www.ebenova.dev/" />
            <meta property="og:title" content="Ebenova — The API Layer for Business Agreements" />
            <meta property="og:description" content="Generate contracts, verify payments, detect fraud, enforce scope — 34 document types, 18 jurisdictions. MCP-native. Built for Africa, open to the world." />
            <meta property="og:image" content="https://www.ebenova.dev/og-image-ebenova.png" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content="@quantimleap100" />
            <meta name="twitter:title" content="Ebenova — The API Layer for Business Agreements" />
            <meta name="twitter:description" content="Contracts, invoices, fraud detection, scope enforcement. 34 document types, 18 jurisdictions. MCP-native. Free tier." />
            <meta name="twitter:image" content="https://www.ebenova.dev/og-image-ebenova.png" />
            <script type="application/ld+json">{JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Ebenova API",
              "url": "https://www.ebenova.dev",
              "description": "Developer-first API platform for legal document generation, invoices, contract enforcement, and Reddit monitoring. 34 document types across 18 jurisdictions including Nigeria, Kenya, Ghana, UK, US, and Canada.",
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
                "email": "info@ebenova.net"
              }
            })}</script>
          </>
        ) : (
          <>
            <title>Signova — Professional Legal Documents</title>
            <meta name="robots" content="noindex" />
          </>
        )}
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
            <a href="/pricing">Pricing</a>
            <a href="#mcp">MCP</a>
            <a href="/insights">Insights</a>
            <a href="/docs">Docs</a>
            <a href="/dashboard" className="api-nav-cta">Sign In</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="api-hero" id="main-content">
        <div className="api-hero-glow" />
        <div className="api-hero-inner">
          <div className="api-hero-badge">
            <span className="badge-dot" />
            Now Live · Production Ready
          </div>

          <h1 className="api-hero-title">
            <span className="sr-only">Ebenova — The API Layer for Business Agreements</span>
            <span aria-hidden="true">
              The API layer for<br />
              <span className="highlight">business agreements.</span>
            </span>
          </h1>

          <p className="api-hero-sub">
            One API for contracts, invoices, fraud detection, and scope enforcement —
            34 document types, 18 jurisdictions, MCP-native. Works wherever your
            business operates. Goes deeper where others don't.
          </p>

          {/* API stat cards — social proof */}
          <div className="api-counter-banner">
            <div className="api-counter-grid">
              <div className="counter-item">
                <div className="counter-number">34</div>
                <div className="counter-label">document types</div>
              </div>
              <div className="counter-item">
                <div className="counter-number">18</div>
                <div className="counter-label">jurisdictions</div>
              </div>
              <div className="counter-item">
                <div className="counter-number">3</div>
                <div className="counter-label">MCP servers on NPM</div>
              </div>
            </div>
          </div>

          <div className="api-hero-actions">
            <button className="api-btn-primary api-btn-large" onClick={handleGetApiKey}>
              Get Free API Key
            </button>
          </div>

          <div className="trust-signals">
            <span>✓ No credit card required</span>
            <span>✓ Nigeria · Kenya · Ghana · UK · US · Canada · 8 jurisdictions verified</span>
            <span>✓ 34 Document Types</span>
            <span>✓ Free tier · No commitment</span>
          </div>

          {/* Code Example */}
          <div className="api-hero-code">
            <div className="code-header">
              <span className="code-label">Generate your first document in 60 seconds</span>
              <button
                className="code-copy"
                onClick={() => handleCopyCode(CURL_EXAMPLE, 'hero-curl')}
                aria-label="Copy curl example"
              >
                {copiedCode === 'hero-curl' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre className="code-block">
              <code>{CURL_EXAMPLE}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Who This Is For Section */}
      <section className="who-this-is-for" aria-labelledby="who-heading">
        <div className="section-inner">
          <h2 id="who-heading" className="section-title">Who Ebenova Is For</h2>
          <div className="audience-grid">
            <div className="audience-item">
              <span className="check-icon">✓</span>
              <p>Freelance platforms automating contracts and scope enforcement</p>
            </div>
            <div className="audience-item">
              <span className="check-icon">✓</span>
              <p>AI agent developers who need legal and payment infrastructure</p>
            </div>
            <div className="audience-item">
              <span className="check-icon">✓</span>
              <p>SaaS builders adding document generation to existing products</p>
            </div>
            <div className="audience-item">
              <span className="check-icon">✓</span>
              <p>Property tech startups linking tenancy agreements to payments</p>
            </div>
            <div className="audience-item">
              <span className="check-icon">✓</span>
              <p>Fintechs and lenders in markets underserved by Stripe and DocuSign</p>
            </div>
            <div className="audience-item">
              <span className="check-icon">✓</span>
              <p>Any developer who needs contracts, invoices, or scope guard — without a legal team</p>
            </div>
          </div>
          <div className="not-for" role="note">
            <p><strong>Not the right fit if:</strong> You only need one-off documents as a non-developer (try <a href="https://www.getsignova.com" target="_blank" rel="noopener noreferrer">Signova.com</a>) · You need a full e-signature platform (DocuSign is better) · You need US-only card payment processing (Stripe is better)</p>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="api-use-cases-section" id="use-cases">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Use Cases</p>
            <h2 className="section-title">Built for these workflows</h2>
          </div>

          <div className="api-use-cases-grid">
            {USE_CASES.slice(0, 3).map((useCase, i) => (
              <div key={i} className="api-use-case-card">
                <div className="api-use-case-icon">{useCase.icon}</div>
                <h3 className="api-use-case-title">{useCase.title}</h3>
                <p className="api-use-case-solution">
                  {useCase.solution}
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
                className={`api-card ${card.highlight ? 'highlight' : ''}`}
              >
                {card.badge && (
                  <span className="api-card-badge">{card.badge}</span>
                )}
                <div className="api-card-icon">{card.icon}</div>
                <h3 className="api-card-title">{card.title}</h3>
                <p className="api-card-desc">{card.desc}</p>

                <ul className="api-card-features">
                  {card.features.map((feature, i) => (
                    <li key={i}>✓ {feature}</li>
                  ))}
                </ul>

                <div className="api-card-endpoint">
                  <code>{card.endpoint}</code>
                </div>

                <button
                  className="api-card-cta"
                  onClick={() => navigate(card.link)}
                >
                  {card.cta} <span className="btn-arrow">→</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coming Soon APIs */}
      <section className="api-cards-section" id="coming-soon">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Coming Soon</p>
            <h2 className="section-title">In development</h2>
          </div>

          <div className="api-cards-grid">
            {COMING_SOON_APIS.map(card => (
              <div key={card.id} className={`api-card ${card.status === 'In Development' ? 'highlight' : ''}`}>
                {card.status && (
                  <div className="price-badge" style={{ background: '#f59e0b' }}>{card.status}</div>
                )}
                <div className="api-card-icon">{card.icon}</div>
                <h3 className="api-card-title">{card.title}</h3>
                <p className="api-card-desc">{card.desc}</p>

                <ul className="api-card-features">
                  {card.features.map((feature, i) => (
                    <li key={i}>✓ {feature}</li>
                  ))}
                </ul>

                <div className="api-card-endpoint">
                  <code>{card.endpoint}</code>
                </div>

                <button
                  className="api-card-cta"
                  onClick={() => navigate(card.link)}
                >
                  {card.cta} <span className="btn-arrow">→</span>
                </button>
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
            <h2 className="section-title">The infrastructure gap nobody else filled</h2>
            <p className="section-sub">Stripe handles card payments. DocuSign handles e-signatures. Neither handles informal payment rails, bank transfer verification, jurisdiction-aware contracts, or scope enforcement. Ebenova does all four — with an MCP layer so your AI agents can too.</p>
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
                  <td className="feature">Jurisdiction depth</td>
                  <td className="competitors">US/EU generic templates</td>
                  <td className="ebenova">18 jurisdictions — Nigeria, Kenya, Ghana, UK, US, Canada and more</td>
                </tr>
                <tr>
                  <td className="feature">Payment rails</td>
                  <td className="competitors">Card payments only</td>
                  <td className="ebenova">Bank transfer + Mobile money (M-Pesa, MoMo, OPay) + card</td>
                </tr>
                <tr>
                  <td className="feature">Contract-Payment link</td>
                  <td className="competitors">Two separate systems</td>
                  <td className="ebenova">Native linking API — one call, bidirectional lookup</td>
                </tr>
                <tr>
                  <td className="feature">Scope enforcement</td>
                  <td className="competitors">Not available</td>
                  <td className="ebenova">Scope Guard API — detect violations, draft responses, price change orders</td>
                </tr>
                <tr>
                  <td className="feature">AI Agent ready</td>
                  <td className="competitors">No MCP servers</td>
                  <td className="ebenova">3 MCP servers on NPM — Claude, Cursor, VS Code native</td>
                </tr>
                <tr>
                  <td className="feature">Pricing</td>
                  <td className="competitors">$40–417+/month</td>
                  <td className="ebenova">Free tier · $29 starter</td>
                </tr>
                <tr>
                  <td className="feature">Code examples</td>
                  <td className="competitors">US-focused</td>
                  <td className="ebenova">Nigeria, Kenya, Ghana, UK, US, Canada — all with real curl snippets</td>
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
                Our 3 MCP servers let AI agents generate legal documents,
                monitor Reddit for brand mentions, and manage field service bookings — all through natural language.
              </p>

              <div className="mcp-install-steps">
                <div className="mcp-step">
                  <span className="step-num">1</span>
                  <p>Install any MCP server via npx</p>
                  <code>npx -y ebenova-legal-docs-mcp</code>
                  <code>npx -y @ebenova/reddit-monitor-mcp</code>
                  <code>npx -y @ebenova/fieldops-mcp</code>
                </div>
                <div className="mcp-step">
                  <span className="step-num">2</span>
                  <p>Add to your Claude Desktop config (see example →)</p>
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
                  aria-label="Copy MCP config"
                >
                  {copiedCode === 'mcp-config' ? '✓ Copied' : 'Copy'}
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
              The legal and payment layer your product is missing
            </h2>
            <p className="api-cta-sub">
              Free tier — 50 verifications and 5 documents/month. No credit card. Works in 18 jurisdictions from day one.
            </p>
            <div className="api-cta-actions">
              <button className="api-btn-primary api-btn-large" onClick={handleGetApiKey}>
                Get Free API Key
              </button>
            </div>
            <div className="api-cta-trust">
              <span>✓ No credit card required</span>
              <span>✓ Free tier forever</span>
              <span>✓ Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Built By Section */}
      <section className="built-by" aria-labelledby="founder-heading">
        <div className="section-inner">
          <h2 id="founder-heading" className="sr-only">Built By</h2>
          <div className="founder-card">
            <div className="founder-avatar" aria-hidden="true"><Code size={32} weight="duotone" /></div>
            <div className="founder-content">
              <h3>Olumide Akinsola</h3>
              <p className="founder-title">Fraud Officer @ RBC | Nigerian-Canadian Founder</p>
              <blockquote>
                "I built Ebenova because the standard API stack — Stripe, DocuSign, Twilio — 
                assumes card payments, US courts, and English-language contracts.
                A lot of the world doesn't work that way. I work in fraud at a major bank
                and I've seen what happens when informal deals go wrong with no infrastructure to back them up.
                Ebenova is that infrastructure."
              </blockquote>
              <p className="founder-contact">
                Questions? <a href="mailto:info@ebenova.net">Email me directly</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter variant="ebenova" />
    </div>
  )
}
