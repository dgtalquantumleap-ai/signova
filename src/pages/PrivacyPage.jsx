import { useNavigate } from 'react-router-dom'
import './LegalPage.css'

export default function PrivacyPage() {
  const navigate = useNavigate()
  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <button className="legal-back" onClick={() => navigate('/')}>← Back to Signova</button>
        <div className="logo">
          <span className="logo-mark">S</span>
          <span className="logo-text">Signova</span>
        </div>
      </nav>
      <div className="legal-body">
        <h1>Privacy Policy</h1>
        <p className="legal-date">Last updated: March 2026</p>

        <h2>What we collect</h2>
        <p>Signova does not require you to create an account. When you generate a document, the information you enter into the form fields is sent to our server solely to produce your document. It is not stored in any database, logged, or associated with any identifier.</p>

        <h2>How your data is used</h2>
        <p>Your form inputs are passed to an AI language model to generate your document. Free previews use Groq (governed by their <a href="https://groq.com/privacy-policy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>). Paid documents use Anthropic Claude (governed by their <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>). We do not use your data for training, analytics, or any other purpose.</p>

        <h2>Payments</h2>
        <p>Payment processing is handled entirely by Polar. Signova never sees or stores your card number or payment details. Polar's privacy practices are described in their <a href="https://polar.sh/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>

        <h2>Cookies and tracking</h2>
        <p>We do not use tracking cookies, analytics services, or advertising pixels. The only browser storage we use is <code>sessionStorage</code> to pass your generated document from the generator page to the preview page within the same browser tab. This data is cleared when the tab is closed.</p>

        <h2>Third-party links</h2>
        <p>Our site may contain links to third-party websites. We are not responsible for the privacy practices of those sites.</p>

        <h2>Children</h2>
        <p>Signova is not directed at children under the age of 13 and we do not knowingly collect information from minors.</p>

        <h2>Contact</h2>
        <p>For any privacy-related questions or requests, email us at <a href={`mailto:${'info'}@${'ebenova.net'}`}>
          <span className="email-obfuscated" data-user="info" data-domain="ebenova.net"></span>
        </a>.</p>
      </div>
    </div>
  )
}
