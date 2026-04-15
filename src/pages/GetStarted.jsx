import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import {
  Warning, Confetti, FileText, Globe, Scales, ShieldCheck, Robot, ChartBar, GlobeHemisphereEast,
} from '@phosphor-icons/react'
import './GetStarted.css'

const GS_ICON = { size: 24, weight: 'duotone', color: 'currentColor' }

const API = import.meta.env.VITE_API_BASE || ''

export default function GetStarted() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [codeTab, setCodeTab] = useState('curl')

  useEffect(() => {
    generateKey()
  }, [])

  async function generateKey() {
    try {
      const res = await fetch(`${API}/api/v1/auth/quick-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      if (data.success) {
        setApiKey(data)
      } else {
        setError(data.error?.message || 'Failed to generate key')
      }
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(apiKey.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyCode() {
    const code = codeTab === 'curl' ? CURL_EXAMPLE(apiKey.key) : PYTHON_EXAMPLE(apiKey.key)
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="gs-container">
        <Helmet><title>Getting Started — Ebenova API</title></Helmet>
        <div className="gs-loading">
          <div className="gs-spinner" />
          <p>Generating your API key...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="gs-container">
        <Helmet><title>Error — Ebenova API</title></Helmet>
        <div className="gs-error">
          <h1><Warning size={28} weight="fill" style={{ verticalAlign: '-5px', marginRight: 8 }} />Something went wrong</h1>
          <p>{error}</p>
          <button className="gs-btn-primary" onClick={generateKey}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="gs-container">
      <Helmet>
        <title>Getting Started — Ebenova API</title>
        <meta name="description" content="Your API key is ready. Generate legal documents in seconds." />
      </Helmet>

      <header className="gs-header">
        <div className="gs-header-inner">
          <h1><Confetti size={28} weight="fill" style={{ verticalAlign: '-5px', marginRight: 8 }} />Your API key is ready!</h1>
          <p>Start generating documents immediately. No credit card required.</p>
        </div>
      </header>

      <main className="gs-main">
        {/* Key Display */}
        <section className="gs-section gs-key-section">
          <h2>Your API Key</h2>
          <div className="gs-key-box">
            <code className="gs-key-display">{apiKey.key}</code>
            <button 
              className="gs-btn-copy"
              onClick={copyKey}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <p className="gs-key-note">
            Keep this secret. Never commit it to version control or share publicly.
          </p>
        </section>

        {/* Usage Info */}
        <section className="gs-section gs-info-grid">
          <div className="gs-info-card">
            <div className="gs-info-icon"><FileText {...GS_ICON} /></div>
            <h3>Documents/Month</h3>
            <div className="gs-info-value">{apiKey.monthlyLimit}</div>
            <p>Increase this by upgrading your plan</p>
          </div>

          <div className="gs-info-card">
            <div className="gs-info-icon"><Globe {...GS_ICON} /></div>
            <h3>Document Types</h3>
            <div className="gs-info-value">{apiKey.documentTypes}</div>
            <p>NDAs, contracts, invoices, and more</p>
          </div>

          <div className="gs-info-card">
            <div className="gs-info-icon"><Scales {...GS_ICON} /></div>
            <h3>Jurisdictions</h3>
            <div className="gs-info-value">{apiKey.jurisdictions}</div>
            <p>Nigeria, Kenya, Ghana, US, EU, and more</p>
          </div>

          <div className="gs-info-card">
            <div className="gs-info-icon">⏰</div>
            <h3>Resets</h3>
            <div className="gs-info-value">Monthly</div>
            <p>{new Date(apiKey.resets_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
          </div>
        </section>

        {/* Code Example */}
        <section className="gs-section gs-code-section">
          <div className="gs-code-header">
            <h2>Make Your First Request</h2>
            <div className="gs-code-tabs">
              <button 
                className={`gs-tab ${codeTab === 'curl' ? 'active' : ''}`}
                onClick={() => setCodeTab('curl')}
              >
                cURL
              </button>
              <button 
                className={`gs-tab ${codeTab === 'python' ? 'active' : ''}`}
                onClick={() => setCodeTab('python')}
              >
                Python
              </button>
            </div>
          </div>

          <div className="gs-code-box">
            <pre className="gs-code">
              <code>
                {codeTab === 'curl' ? CURL_EXAMPLE(apiKey.key) : PYTHON_EXAMPLE(apiKey.key)}
              </code>
            </pre>
            <button className="gs-btn-copy-code" onClick={copyCode}>
              {copied ? '✓ Copied!' : 'Copy code'}
            </button>
          </div>
        </section>

        {/* Next Steps */}
        <section className="gs-section gs-next-steps">
          <h2>What's Next?</h2>
          <div className="gs-steps">
            <div className="gs-step">
              <div className="gs-step-num">1</div>
              <h3>Try the API</h3>
              <p>Use the cURL example above to generate your first document. Replace field values with your own.</p>
            </div>

            <div className="gs-step">
              <div className="gs-step-num">2</div>
              <h3>Read the Docs</h3>
              <p>Learn all 27 document types, parameters, and error handling.</p>
              <a href="/docs" className="gs-link">View API Documentation →</a>
            </div>

            <div className="gs-step">
              <div className="gs-step-num">3</div>
              <h3>Build Your App</h3>
              <p>Integrate into your backend, SaaS, or AI agent. Use our REST API from any language, or connect via MCP for AI tools like Claude and Cursor.</p>
              <a href="/docs#sdk" className="gs-link">View SDKs &amp; MCP →</a>
            </div>

            <div className="gs-step">
              <div className="gs-step-num">4</div>
              <h3>Upgrade When Ready</h3>
              <p>Hit your 5-document limit? Upgrade to Starter (100 docs) or Growth (500 docs) for just $29-$79/month.</p>
              <button className="gs-btn-secondary" onClick={() => navigate('/dashboard')}>
                View Plans →
              </button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="gs-section gs-features">
          <h2>What You Can Build</h2>
          <div className="gs-features-grid">
            <div className="gs-feature">
              <span className="gs-feature-icon"><ShieldCheck {...GS_ICON} /></span>
              <h3>Scope Guard API</h3>
              <p>Detect contract violations automatically (Pro tier)</p>
            </div>

            <div className="gs-feature">
              <span className="gs-feature-icon"><Robot {...GS_ICON} /></span>
              <h3>AI Agent Integration</h3>
              <p>Connect to Claude, GPT-4, or custom agents via MCP</p>
            </div>

            <div className="gs-feature">
              <span className="gs-feature-icon"><ChartBar {...GS_ICON} /></span>
              <h3>Document Analytics</h3>
              <p>Track usage, monitor API performance, see trends</p>
            </div>

            <div className="gs-feature">
              <span className="gs-feature-icon"><GlobeHemisphereEast {...GS_ICON} /></span>
              <h3>Multi-Jurisdiction</h3>
              <p>Generate documents compliant with local laws automatically</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="gs-section gs-cta-section">
          <div className="gs-cta-box">
            <h2>Ready to Scale?</h2>
            <p>Your free tier includes 5 documents/month. Need more?</p>
            <button className="gs-btn-primary gs-btn-large" onClick={() => navigate('/dashboard')}>
              View Upgrade Plans →
            </button>
            <p className="gs-cta-note">
              Or <a href="/docs" className="gs-link">explore the full API docs</a> first.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

function CURL_EXAMPLE(key) {
  return `curl -X POST https://api.ebenova.dev/v1/documents/generate \\
  -H "Authorization: Bearer ${key}" \\
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
}

function PYTHON_EXAMPLE(key) {
  return `import requests

headers = {
    "Authorization": f"Bearer ${key}",
    "Content-Type": "application/json"
}

data = {
    "document_type": "nda",
    "fields": {
        "disclosingParty": "Acme Inc.",
        "receivingParty": "John Smith",
        "purpose": "Partnership discussion",
        "duration": "2 years",
        "mutual": "Yes"
    },
    "jurisdiction": "Nigeria"
}

response = requests.post(
    "https://api.ebenova.dev/v1/documents/generate",
    headers=headers,
    json=data
)

print(response.json())`
}
