// src/components/SiteNav.jsx
//
// Shared top nav for both Signova (getsignova.com) and Ebenova (ebenova.dev)
// surfaces. Pages SHOULD use this component instead of hand-rolling nav
// markup — keeps the brand identity (logo/colors), link set, and mobile
// menu behavior consistent across the site.
//
// Two variants:
//   <SiteNav variant="ebenova" />   ← Ebenova API platform nav
//   <SiteNav variant="signova" />   ← Signova consumer nav
//
// Pages with nav-adjacent controls (e.g. Landing's currency toggle) can
// pass them via the `actions` prop, which renders to the right of the
// nav links:
//   <SiteNav variant="signova" actions={<CurrencyToggle />} />
//
// Mobile: at < 720px the links collapse into a hamburger menu.

import { useState, useEffect } from 'react'
import './SiteNav.css'

const EBENOVA_LINKS = [
  { label: 'APIs',     href: '/api' },
  { label: 'Pricing',  href: '/pricing' },
  { label: 'Docs',     href: '/docs' },
  { label: 'Insights', href: '/insights' },
  { label: 'Vigil',    href: '/vigil' },
]

const EBENOVA_CTA = { label: 'Sign In', href: '/dashboard' }

const SIGNOVA_LINKS = [
  { label: 'How it works', href: '/#how' },
  { label: 'Documents',    href: '/#documents' },
  { label: 'Pricing',      href: '/#pricing' },
  { label: 'Blog',         href: '/blog' },
]

const SIGNOVA_CTA = { label: 'Start a Document →', href: '/' }

function Logo({ variant }) {
  if (variant === 'ebenova') {
    return (
      <a href="/" className="sn-logo" aria-label="Ebenova home">
        <span className="sn-logo-mark sn-logo-mark--ebenova" aria-hidden="true">E</span>
        <span className="sn-logo-text">ebenova.dev</span>
      </a>
    )
  }
  return (
    <a href="/" className="sn-logo" aria-label="Signova home">
      <span className="sn-logo-mark" aria-hidden="true">S</span>
      <span className="sn-logo-text">Signova</span>
    </a>
  )
}

export default function SiteNav({
  variant = 'ebenova',
  actions = null,
  showCta = true,
  links: linksOverride,
  cta: ctaOverride,
}) {
  const links = linksOverride || (variant === 'ebenova' ? EBENOVA_LINKS : SIGNOVA_LINKS)
  const cta   = ctaOverride   || (variant === 'ebenova' ? EBENOVA_CTA   : SIGNOVA_CTA)
  const [menuOpen, setMenuOpen] = useState(false)

  // Close menu on Escape + lock body scroll while open
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <nav className={`site-nav site-nav--${variant}`} role="navigation" aria-label="Main navigation">
      <div className="site-nav-inner">
        <Logo variant={variant} />

        <div className="site-nav-right">
          <ul className="site-nav-links" role="list">
            {links.map(link => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>

          {actions && <div className="site-nav-actions">{actions}</div>}

          {showCta && (
            <a href={cta.href} className="site-nav-cta">{cta.label}</a>
          )}

          <button
            className="site-nav-burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="site-nav-mobile"
            onClick={() => setMenuOpen(o => !o)}
          >
            <span className={`site-nav-burger-bar ${menuOpen ? 'open' : ''}`} />
            <span className={`site-nav-burger-bar ${menuOpen ? 'open' : ''}`} />
            <span className={`site-nav-burger-bar ${menuOpen ? 'open' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="site-nav-mobile"
        className={`site-nav-mobile ${menuOpen ? 'open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <ul role="list">
          {links.map(link => (
            <li key={link.href}>
              <a href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>
            </li>
          ))}
          {showCta && (
            <li>
              <a href={cta.href} className="site-nav-mobile-cta" onClick={() => setMenuOpen(false)}>
                {cta.label}
              </a>
            </li>
          )}
        </ul>
      </div>
    </nav>
  )
}
