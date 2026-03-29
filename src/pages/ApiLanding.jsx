import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { track } from '../lib/analytics'
import './ApiLanding.css'

const API_CARDS = [
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
    id: 'scope-guard',
    icon: '🛡️',
    title: 'Scope Guard API',
    desc: 'AI-powered contract enforcement. Detect scope violations and generate professional responses or change orders.',
    features: ['Violation detection', '3 response drafts', 'Change order generation', 'Pro tier required'],
    endpoint: 'POST /v1/scope/analyze',
    cta: 'View API Docs',
    link: '/docs#scope-guard',
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
    id: 'payouts',
    icon: '💸',
    title: 'Africa Payouts API',
    desc: 'Send payments to bank accounts and mobile money across 10+ African countries.',
    features: ['Coming Q2 2026', 'Mobile money + bank', 'Real-time settlement'],
    endpoint: 'POST /v1/payouts/send',
    cta: 'Join Waitlist',
    link: '/contact',
    disabled: true,
  },
]

const BENEFITS = [
  {
    icon: '🤖',
    title: 'Built for AI Agents',
    desc: 'MCP-native design. Connect Claude, Cursor, or custom agents to generate documents programmatically.',
  },
  {
    icon: '🔑',
    title: 'One API Key',
    desc: 'Access all tools with a single key. Documents, invoices, extraction — unified billing and usage tracking.',
  },
  {
    icon: '🌍',
    title: 'African Expertise',
    desc: 'Built for Nigerian, Kenyan, Ghanaian law. We understand African business workflows.',
  },
  {
    icon: '⚡',
    title: '99.9% Uptime',
    desc: 'Production-ready infrastructure. Redis-backed rate limiting. Automatic scaling.',
  },
]

const PRICING_TIERS = [
  {
    name: 'Free',
    price: 0,
    docs: 5,
    cta: 'Get API Key',
    highlight: false,
    features: [
      '5 documents/month',
      'All API endpoints',
      'Community support',
      '10 requests/min',
    ],
  },
  {
    name: 'Starter',
    price: 29,
    docs: 100,
    cta: 'Start Free Trial',
    highlight: true,
    features: [
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
    docs: 500,
    cta: 'Start Free Trial',
    highlight: false,
    features: [
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
    docs: 2000,
    cta: 'Contact Sales',
    highlight: false,
    features: [
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
    navigate('/docs#authentication')
  }

  const handleViewDocs = () => {
    track('api_cta_click', { cta: 'view_docs', location: 'hero' })
    navigate('/docs')
  }

  return (
    <div className="api-landing">
      <Helmet>
        <title>Ebenova API — Legal Documents, Invoices & Extraction API for Developers</title>
        <meta name="description" content="Developer-first API for legal documents, invoices, and conversation extraction. 27 document types, 18 jurisdictions, MCP-native. Free tier available." />
        <link rel="canonical" href="https://ebenova.dev/" />
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
            Now in Public Beta
          </div>

          <h1 className="api-hero-title">
            APIs for African and Global Business Workflows
          </h1>

          <p className="api-hero-sub">
            Legal documents, invoices, payouts. One integration, everything you need.
            Built for developers, SaaS founders, and AI agent builders.
          </p>

          <div className="api-hero-actions">
            <button className="api-btn-primary api-btn-large" onClick={handleGetApiKey}>
              Get API Key — Free <span className="btn-arrow">→</span>
            </button>
            <button className="api-btn-outline api-btn-large" onClick={handleViewDocs}>
              View Documentation
            </button>
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

      {/* Benefits Section */}
      <section className="api-benefits-section">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Why Ebenova</p>
            <h2 className="section-title">Built different</h2>
          </div>

          <div className="api-benefits-grid">
            {BENEFITS.map((benefit, i) => (
              <div key={i} className="api-benefit-card">
                <div className="api-benefit-icon">{benefit.icon}</div>
                <h3 className="api-benefit-title">{benefit.title}</h3>
                <p className="api-benefit-desc">{benefit.desc}</p>
              </div>
            ))}
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
                <p className="price-docs">{tier.docs} documents/month</p>
                
                <ul className="price-features">
                  {tier.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>

                <button className={`api-price-cta ${tier.highlight ? 'highlight' : ''}`}>
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
          © 2026 Ebenova Solutions · Calgary, Alberta
        </div>
      </footer>
    </div>
  )
}
