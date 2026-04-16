// src/components/ScrollToHash.jsx
//
// React Router 7's <Routes> API (the declarative one we use in App.jsx) does
// NOT restore scroll position on route change. Browsers only auto-scroll to
// hash anchors on FULL page loads, so <Link to="/pricing#starter"> lands the
// user at the previous page's scroll offset with no scroll to #starter.
//
// This component fixes both behaviours:
//   1. No hash → scroll to top on every pathname change
//   2. Hash present → scroll the element with that id into view once it's
//      mounted (handles lazy-loaded routes that aren't in the DOM yet when
//      the route changes)
//
// Back/forward buttons: we reset scroll on forward-navigation only. Browsers
// already restore scroll correctly for the back button (via history state).
// We detect this via history.action — 'POP' means back/forward, so we skip.

import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export default function ScrollToHash() {
  const { pathname, hash, key } = useLocation()
  const navType = useNavigationType() // 'POP' | 'PUSH' | 'REPLACE'
  const lastKey = useRef(key)

  useEffect(() => {
    // Back/forward: let the browser restore scroll naturally
    if (navType === 'POP') {
      lastKey.current = key
      return
    }

    if (hash) {
      // Lazy-loaded routes may not have mounted the target yet. Poll briefly.
      const id = hash.startsWith('#') ? hash.slice(1) : hash
      let attempts = 0
      const tryScroll = () => {
        const el = document.getElementById(id)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          // Move keyboard focus too, so screen readers and keyboard users
          // continue from the section they navigated to.
          if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
          el.focus({ preventScroll: true })
        } else if (attempts < 20) {
          attempts += 1
          setTimeout(tryScroll, 50) // give Suspense + lazy import up to 1s
        }
      }
      tryScroll()
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
    lastKey.current = key
  }, [pathname, hash, key, navType])

  return null
}
