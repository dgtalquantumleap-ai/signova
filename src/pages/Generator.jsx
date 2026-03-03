import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import './Generator.css'

const DOC_CONFIG = {
  'privacy-policy': {
    name: 'Privacy Policy',
    icon: '🔒',
    fields: [
      { id: 'company', label: 'Company / App name', type: 'text', placeholder: 'e.g. Acme Inc.' },
      { id: 'website', label: 'Website or app URL', type: 'text', placeholder: 'e.g. https://acme.com' },
      { id: 'country', label: 'Country of operation', type: 'select', options: ['United States', 'Canada', 'United Kingdom', 'Australia', 'European Union', 'Other'] },
      { id: 'dataCollected', label: 'What data do you collect?', type: 'checkbox', options: ['Name', 'Email address', 'Phone number', 'Location data', 'Payment information', 'Usage analytics', 'Cookies', 'Device identifiers'] },
      { id: 'thirdParties', label: 'Third-party services used', type: 'checkbox', options: ['Google Analytics', 'Stripe / payments', 'Facebook / Meta', 'Apple / iOS', 'Supabase', 'Firebase', 'Mailchimp', 'RevenueCat'] },
      { id: 'contact', label: 'Contact email for privacy queries', type: 'text', placeholder: 'e.g. privacy@acme.com' },
    ],
  },
  'terms-of-service': {
    name: 'Terms of Service',
    icon: '📋',
    fields: [
      { id: 'company', label: 'Company / App name', type: 'text', placeholder: 'e.g. Acme Inc.' },
      { id: 'website', label: 'Website or app URL', type: 'text', placeholder: 'e.g. https://acme.com' },
      { id: 'country', label: 'Governing law (country/state)', type: 'select', options: ['United States — California', 'United States — Delaware', 'United States — New York', 'Canada — Ontario', 'United Kingdom', 'Australia', 'European Union'] },
      { id: 'serviceType', label: 'What does your service do?', type: 'textarea', placeholder: 'e.g. A mobile app for household management that helps families track tasks, meals and expenses.' },
      { id: 'hasSubscription', label: 'Do you offer paid subscriptions?', type: 'radio', options: ['Yes', 'No'] },
      { id: 'contact', label: 'Contact email', type: 'text', placeholder: 'e.g. legal@acme.com' },
    ],
  },
  'nda': {
    name: 'Non-Disclosure Agreement',
    icon: '🤝',
    fields: [
      { id: 'disclosingParty', label: 'Disclosing party (your company)', type: 'text', placeholder: 'e.g. Acme Inc.' },
      { id: 'receivingParty', label: 'Receiving party (who you\'re sharing with)', type: 'text', placeholder: 'e.g. John Smith / XYZ Consulting' },
      { id: 'purpose', label: 'Purpose of disclosure', type: 'textarea', placeholder: 'e.g. Discussing a potential partnership to develop a mobile application.' },
      { id: 'duration', label: 'Duration of confidentiality', type: 'select', options: ['1 year', '2 years', '3 years', '5 years', 'Indefinite'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['United States — California', 'United States — New York', 'Canada — Ontario', 'United Kingdom', 'Australia'] },
      { id: 'mutual', label: 'Is this mutual (both parties bound)?', type: 'radio', options: ['Yes — mutual NDA', 'No — one-way only'] },
    ],
  },
  'freelance-contract': {
    name: 'Freelance Contract',
    icon: '✍️',
    fields: [
      { id: 'freelancer', label: 'Your name / company', type: 'text', placeholder: 'e.g. Jane Smith / Jane Smith Design' },
      { id: 'client', label: 'Client name / company', type: 'text', placeholder: 'e.g. Acme Inc.' },
      { id: 'services', label: 'Services you are providing', type: 'textarea', placeholder: 'e.g. UI/UX design for a mobile app, including wireframes, prototypes and final design assets.' },
      { id: 'rate', label: 'Payment rate', type: 'text', placeholder: 'e.g. $75/hour or $2,500 flat fee' },
      { id: 'paymentTerms', label: 'Payment terms', type: 'select', options: ['Net 7 (7 days)', 'Net 14 (14 days)', 'Net 30 (30 days)', '50% upfront, 50% on completion', '100% upfront'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['United States — California', 'United States — New York', 'Canada — Ontario', 'United Kingdom', 'Australia'] },
      { id: 'ipOwnership', label: 'Who owns the work product?', type: 'radio', options: ['Client owns all work product', 'Freelancer retains ownership until paid in full', 'Shared ownership'] },
    ],
  },
  'independent-contractor': {
    name: 'Independent Contractor Agreement',
    icon: '🏢',
    fields: [
      { id: 'company', label: 'Company / hiring party', type: 'text', placeholder: 'e.g. Acme Inc.' },
      { id: 'contractor', label: 'Contractor name / company', type: 'text', placeholder: 'e.g. John Smith / Smith Consulting' },
      { id: 'services', label: 'Services to be performed', type: 'textarea', placeholder: 'e.g. Software development services including backend API development and database architecture.' },
      { id: 'compensation', label: 'Compensation', type: 'text', placeholder: 'e.g. $120/hour or $8,000/month' },
      { id: 'term', label: 'Contract duration', type: 'select', options: ['3 months', '6 months', '1 year', 'Ongoing — 30 days notice to terminate', 'Project-based'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['United States — California', 'United States — New York', 'Canada — Ontario', 'United Kingdom', 'Australia'] },
      { id: 'nonCompete', label: 'Include non-compete clause?', type: 'radio', options: ['Yes — restrict working with competitors', 'No — no restrictions'] },
    ],
  },
}

export default function Generator() {
  const { docType } = useParams()
  const navigate = useNavigate()
  const config = DOC_CONFIG[docType]
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!config) {
    navigate('/')
    return null
  }

  const update = (id, val) => setAnswers(p => ({ ...p, [id]: val }))

  const toggleCheckbox = (id, option) => {
    const current = answers[id] || []
    if (current.includes(option)) {
      update(id, current.filter(x => x !== option))
    } else {
      update(id, [...current, option])
    }
  }

  const isValid = () => {
    const required = config.fields.filter(f => f.type === 'text' || f.type === 'textarea' || f.type === 'select')
    return required.every(f => answers[f.id] && answers[f.id].trim && answers[f.id].trim() !== '')
  }

  const handleGenerate = async () => {
    if (!isValid()) { setError('Please fill in all required fields.'); return }
    setError('')
    setLoading(true)
    try {
      // Build the prompt
      const fieldSummary = config.fields.map(f => {
        const val = answers[f.id]
        if (!val || (Array.isArray(val) && val.length === 0)) return null
        const display = Array.isArray(val) ? val.join(', ') : val
        return `${f.label}: ${display}`
      }).filter(Boolean).join('\n')

      const prompt = `Generate a professional, comprehensive ${config.name} document for the following business:

${fieldSummary}

Requirements:
- Write in formal legal language appropriate for the document type
- Be specific and detailed, not generic
- Structure with clear numbered sections and subsections
- Include all standard clauses expected in a ${config.name}
- Tailor the content to the specific business details provided
- Do not include any placeholder text like [INSERT NAME] — use the actual values provided
- End with a signature block

Output the complete document only, no preamble or explanation.`

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Generation failed')
      }

      const data = await response.json()
      const text = data.text || ''

      // Store and navigate to preview
      sessionStorage.setItem('signova_doc', JSON.stringify({
        docType,
        docName: config.name,
        content: text,
        answers,
        generatedAt: new Date().toISOString(),
      }))
      navigate('/preview')
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="gen-page">
      <div className="gen-nav">
        <button className="gen-back" onClick={() => navigate('/')}>← Back</button>
        <div className="logo">
          <span className="logo-mark">S</span>
          <span className="logo-text">Signova</span>
        </div>
      </div>

      <div className="gen-inner">
        <div className="gen-header">
          <span className="gen-icon">{config.icon}</span>
          <h1 className="gen-title">{config.name}</h1>
          <p className="gen-sub">Answer the questions below. Your document will be generated instantly.</p>
        </div>

        <div className="gen-form">
          {config.fields.map(field => (
            <div key={field.id} className="field-group">
              <label className="field-label">
                {field.label}
                {(field.type === 'text' || field.type === 'textarea' || field.type === 'select') && (
                  <span className="field-required">*</span>
                )}
              </label>

              {field.type === 'text' && (
                <input
                  className="field-input"
                  type="text"
                  placeholder={field.placeholder}
                  value={answers[field.id] || ''}
                  onChange={e => update(field.id, e.target.value)}
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  className="field-textarea"
                  placeholder={field.placeholder}
                  value={answers[field.id] || ''}
                  onChange={e => update(field.id, e.target.value)}
                  rows={4}
                />
              )}

              {field.type === 'select' && (
                <select
                  className="field-select"
                  value={answers[field.id] || ''}
                  onChange={e => update(field.id, e.target.value)}
                >
                  <option value="">Select an option</option>
                  {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}

              {field.type === 'radio' && (
                <div className="field-radios">
                  {field.options.map(o => (
                    <label key={o} className="radio-label">
                      <input
                        type="radio"
                        name={field.id}
                        value={o}
                        checked={answers[field.id] === o}
                        onChange={() => update(field.id, o)}
                      />
                      <span className="radio-custom" />
                      {o}
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'checkbox' && (
                <div className="field-checkboxes">
                  {field.options.map(o => (
                    <label key={o} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={(answers[field.id] || []).includes(o)}
                        onChange={() => toggleCheckbox(field.id, o)}
                      />
                      <span className="checkbox-custom" />
                      {o}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {error && <div className="gen-error">{error}</div>}

          <button
            className={`btn-generate ${loading ? 'loading' : ''}`}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Generating your document…
              </>
            ) : (
              <>
                Generate {config.name}
                <span className="btn-arrow">→</span>
              </>
            )}
          </button>
          <p className="gen-note">Preview is free · $4.99 to download clean PDF</p>
        </div>
      </div>
    </div>
  )
}
