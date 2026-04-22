// src/components/SiteFooter.jsx
//
// Shared footer for both Signova (getsignova.com) and Ebenova (ebenova.dev)
// surfaces. Pages SHOULD use this component instead of inlining footer markup
// to prevent drift (links added to one footer but not another).
//
// Two variants:
//   <SiteFooter variant="signova" />   ← getsignova.com tone, 5 columns
//   <SiteFooter variant="ebenova" />   ← ebenova.dev tone, 4 columns
//
// `info@ebenova.net` is the only operating mailbox — every contact link
// in this file routes there. If that ever changes, update CONTACT_EMAIL
// once here and every footer everywhere updates.
//
// Big-product landing pages (Landing, ApiLanding, Insights, VigilLanding,
// ScopeGuard, Pricing) keep their bespoke footers because they have
// product-specific extras (currency badge, mobile-sticky CTA, etc.).
// They should still use CONTACT_EMAIL from below to stay in sync.

import './SiteFooter.css'

export const CONTACT_EMAIL = 'info@ebenova.net'

const YEAR = new Date().getFullYear()

const SIGNOVA_LINKS = {
  Product: [
    { label: 'How it works', href: '/#how' },
    { label: 'Documents',    href: '/#documents' },
    { label: 'Pricing',      href: '/#pricing' },
    { label: 'Trust & Provenance', href: '/trust' },
  ],
  Tools: [
    { label: 'NDA Generator',     href: '/nda-generator' },
    { label: 'Tenancy Agreement', href: '/tenancy-agreement-nigeria' },
    { label: 'WhatsApp →',        href: '/whatsapp' },
    { label: 'Scope Guard',       href: '/scope-guard' },
  ],
  Company: [
    { label: 'About',   href: '/about' },
    { label: 'Blog',    href: '/blog' },
    { label: 'Contact', href: '/contact' },
  ],
  Legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms',   href: '/terms' },
  ],
}

const EBENOVA_LINKS = {
  Product: [
    { label: 'APIs',         href: '/api' },
    { label: 'Pricing',      href: '/pricing' },
    { label: 'Docs',         href: '/docs' },
    { label: 'MCP Servers',  href: '/api#mcp' },
  ],
  Solutions: [
    { label: 'Vigil Fraud Alert', href: '/vigil' },
    { label: 'Insights',          href: '/insights' },
    { label: 'Sign In',           href: '/dashboard' },
  ],
  Company: [
    { label: 'About',        href: '/about' },
    { label: 'Contact',      href: '/contact' },
    { label: 'Signova',      href: 'https://www.getsignova.com', external: true },
    { label: 'Scope Guard',  href: 'https://www.getsignova.com/scope-guard', external: true },
  ],
  Legal: [
    { label: 'Privacy',      href: '/privacy' },
    { label: 'Terms',        href: '/terms' },
    { label: 'Vigil Terms',  href: '/vigil/terms' },
  ],
}

function FooterLink({ link }) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
    )
  }
  return <a href={link.href}>{link.label}</a>
}

function Logo({ variant }) {
  if (variant === 'ebenova') {
    return (
      <a href="/" className="sf-logo" aria-label="Ebenova home">
        <span className="sf-logo-mark sf-logo-mark--ebenova" aria-hidden="true">E</span>
        <span className="sf-logo-text">ebenova.dev</span>
      </a>
    )
  }
  return (
    <a href="/" className="sf-logo" aria-label="Signova home">
      <span className="sf-logo-mark" aria-hidden="true">S</span>
      <span className="sf-logo-text">Signova</span>
    </a>
  )
}

export default function SiteFooter({ variant = 'signova', disclaimer = true }) {
  const links = variant === 'ebenova' ? EBENOVA_LINKS : SIGNOVA_LINKS
  const tagline = variant === 'ebenova'
    ? 'Developer-first APIs for legal documents, fraud detection, and African business workflows.'
    : 'AI-drafted legal documents in minutes. Built for entrepreneurs, freelancers, and SMBs.'

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Logo variant={variant} />
          <p className="site-footer-tagline">{tagline}</p>
          <a className="site-footer-contact" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>

        <nav className="site-footer-cols" aria-label="Footer navigation">
          {Object.entries(links).map(([heading, items]) => (
            <div key={heading} className="site-footer-col">
              <h4>{heading}</h4>
              {items.map(link => (
                <FooterLink key={link.href + link.label} link={link} />
              ))}
            </div>
          ))}
        </nav>
      </div>

      {disclaimer && (
        <p className="site-footer-disclaimer">
          Signova is a document generation tool, not a law firm. Documents are AI-generated
          starting points — not legal advice. No attorney-client relationship is created.
          For complex or high-stakes matters, consult a qualified attorney before signing.
        </p>
      )}

      <p className="site-footer-copy">
        © {YEAR} Ebenova Solutions Inc. · Calgary, Alberta, Canada
        {variant === 'ebenova' && <> · API v1 · Updated {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</>}
      </p>
    </footer>
  )
}
