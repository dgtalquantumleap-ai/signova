import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { track } from '../lib/analytics'

// ─── Plan data ───────────────────────────────────────────────────────────────

const FREE_PLAN = {
  tier:        'free',
  name:        'Free',
  price:       0,
  limit:       '5 docs/month',
  description: 'Try the API at no cost.',
  features: [
    '5 API calls per month',
    'All 27 document types',
    '18 jurisdictions',
    'JSON + HTML output',
    'Community support',
  ],
  cta:        'Get Free Key',
  ctaHref:    '/docs#get-started',
  highlight:  false,
}

const PLANS = [
  {
    tier:        'starter',
    name:        'Starter',
    price:       29,
    limit:       '100 docs/month',
    description: 'For freelancers and small teams.',
    features: [
      '100 API calls per month',
      'All 27 document types',
      '18 jurisdictions',
      'Batch generation (up to 10)',
      'WhatsApp extraction',
      'Email support',
    ],
    highlight: false,
    badge:     null,
  },
  {
    tier:        'growth',
    name:        'Growth',
    price:       79,
    limit:       '500 docs/month',
    description: 'For growing agencies and SaaS products.',
    features: [
      '500 API calls per month',
      'Everything in Starter',
      'Scope Guard™ API',
      'Invoice + receipt API',
      'Contract-payment linking',
      'Priority email support',
    ],
    highlight: true,
    badge:     'Most popular',
  },
  {
    tier:        'scale',
    name:        'Scale',
    price:       199,
    limit:       '2,000 docs/month',
    description: 'For platforms and high-volume use cases.',
    features: [
      '2,000 API calls per month',
      'Everything in Growth',
      'AML compliance reports',
      'Vigil Fraud Alert API',
      'FieldOps Agent API',
      'Slack / webhook alerts',
    ],
    highlight: false,
    badge:     null,
  },
]

const FAQS = [
  {
    q: 'How do I get my API key after paying?',
    a: 'As soon as your payment is confirmed, we email your API key to the address you used at checkout. Check your spam folder if it doesn\'t arrive within 2 minutes. You can also retrieve it from your dashboard.',
  },
  {
    q: 'Can I upgrade or downgrade my plan?',
    a: 'Yes. Email api@ebenova.dev or use your Stripe billing portal. Upgrades take effect immediately; downgrades apply at the next billing cycle.',
  },
  {
    q: 'What counts as an API call?',
    a: 'Each successful document generation, invoice, extraction, or Scope Guard analysis counts as one call. Calls that return an error do not count against your limit.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — the free tier gives you 5 calls per month with no credit card required. Get a free key from the docs page.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'All major credit and debit cards via Stripe. We do not store card details — everything is handled by Stripe.',
  },
  {
    q: 'Can I use the API in production right away?',
    a: 'Yes. Keys are provisioned instantly after payment and work in production immediately.',
  },
]

// ─── Email modal ─────────────────────────────────────────────────────────────

function EmailModal({ plan, onClose }) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)

    try {
      if (import.meta.env.DEV) {
        console.log('[PricingPage] checkout request', { tier: plan.tier, email: trimmed })
      }

      const resp = await fetch('/v1/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier: plan.tier, email: trimmed }),
      })

      const data = await resp.json()

      if (!resp.ok || !data.success) {
        throw new Error(data?.error?.message || 'Checkout failed. Please try again.')
      }

      track('pricing_checkout_started', { tier: plan.tier })
      window.location.href = data.checkout_url
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        background:      'rgba(0,0,0,0.75)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        zIndex:          1000,
        padding:         '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background:   '#161616',
        border:       '1px solid #2a2a2a',
        borderRadius: '16px',
        padding:      '40px 32px',
        maxWidth:     '440px',
        width:        '100%',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display:        'inline-block',
            background:     '#c9a84c22',
            color:          '#c9a84c',
            fontSize:       '11px',
            fontWeight:     700,
            letterSpacing:  '2px',
            textTransform:  'uppercase',
            padding:        '4px 10px',
            borderRadius:   '4px',
            marginBottom:   '12px',
          }}>
            {plan.name} — ${plan.price}/mo
          </div>
          <h2 style={{ color: '#f0ece4', fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>
            Enter your email
          </h2>
          <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
            We'll send your API key here after checkout.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            style={{
              width:        '100%',
              boxSizing:    'border-box',
              background:   '#0e0e0e',
              border:       `1px solid ${error ? '#e05252' : '#333'}`,
              borderRadius: '8px',
              color:        '#f0ece4',
              fontSize:     '15px',
              padding:      '14px 16px',
              marginBottom: '8px',
              outline:      'none',
            }}
          />

          {error && (
            <p style={{ color: '#e05252', fontSize: '13px', margin: '0 0 16px' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width:        '100%',
              background:   loading ? '#7a6530' : '#c9a84c',
              color:        '#0e0e0e',
              border:       'none',
              borderRadius: '8px',
              fontSize:     '15px',
              fontWeight:   700,
              padding:      '14px',
              cursor:       loading ? 'not-allowed' : 'pointer',
              marginTop:    '8px',
              transition:   'background 0.2s',
            }}
          >
            {loading ? 'Redirecting to Stripe…' : `Continue to checkout →`}
          </button>
        </form>

        <button
          onClick={onClose}
          style={{
            display:    'block',
            width:      '100%',
            marginTop:  '16px',
            background: 'transparent',
            border:     'none',
            color:      '#555',
            fontSize:   '13px',
            cursor:     'pointer',
            padding:    '8px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Plan card ───────────────────────────────────────────────────────────────

function PlanCard({ plan, onSelect }) {
  return (
    <div style={{
      background:    plan.highlight ? '#161206' : '#111',
      border:        `1px solid ${plan.highlight ? '#c9a84c55' : '#222'}`,
      borderRadius:  '16px',
      padding:       '32px 28px',
      display:       'flex',
      flexDirection: 'column',
      position:      'relative',
      flex:          '1 1 280px',
      maxWidth:      '340px',
    }}>
      {plan.badge && (
        <div style={{
          position:       'absolute',
          top:            '-13px',
          left:           '50%',
          transform:      'translateX(-50%)',
          background:     '#c9a84c',
          color:          '#0e0e0e',
          fontSize:       '11px',
          fontWeight:     700,
          letterSpacing:  '1.5px',
          textTransform:  'uppercase',
          padding:        '4px 14px',
          borderRadius:   '20px',
          whiteSpace:     'nowrap',
        }}>
          {plan.badge}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#f0ece4', fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>
          {plan.name}
        </h3>
        <p style={{ color: '#888', fontSize: '13px', margin: '0 0 20px' }}>{plan.description}</p>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ color: '#c9a84c', fontSize: '40px', fontWeight: 800, lineHeight: 1 }}>
            ${plan.price}
          </span>
          <span style={{ color: '#555', fontSize: '14px' }}>/month</span>
        </div>
        <p style={{ color: '#c9a84c', fontSize: '13px', fontWeight: 600, margin: '6px 0 0' }}>
          {plan.limit}
        </p>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', flex: 1 }}>
        {plan.features.map(f => (
          <li key={f} style={{
            color:        '#b0aa9e',
            fontSize:     '14px',
            padding:      '6px 0',
            borderBottom: '1px solid #1a1a1a',
            display:      'flex',
            alignItems:   'flex-start',
            gap:          '10px',
          }}>
            <span style={{ color: '#c9a84c', flexShrink: 0, marginTop: '1px' }}>&#10003;</span>
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan)}
        style={{
          width:        '100%',
          background:   plan.highlight ? '#c9a84c' : 'transparent',
          color:        plan.highlight ? '#0e0e0e' : '#c9a84c',
          border:       '1px solid #c9a84c',
          borderRadius: '8px',
          fontSize:     '14px',
          fontWeight:   700,
          padding:      '13px',
          cursor:       'pointer',
          transition:   'all 0.2s',
        }}
        onMouseEnter={e => {
          if (!plan.highlight) {
            e.currentTarget.style.background = '#c9a84c'
            e.currentTarget.style.color      = '#0e0e0e'
          }
        }}
        onMouseLeave={e => {
          if (!plan.highlight) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color      = '#c9a84c'
          }
        }}
      >
        Get Started
      </button>
    </div>
  )
}

// ─── Free tier card ──────────────────────────────────────────────────────────

function FreePlanCard() {
  return (
    <div style={{
      background:    '#111',
      border:        '1px solid #1e1e1e',
      borderRadius:  '12px',
      padding:       '20px 28px',
      display:       'flex',
      alignItems:    'center',
      justifyContent:'space-between',
      gap:           '16px',
      flexWrap:      'wrap',
      maxWidth:      '720px',
      margin:        '0 auto',
    }}>
      <div>
        <span style={{ color: '#f0ece4', fontWeight: 700, fontSize: '16px' }}>Free tier</span>
        <span style={{
          marginLeft:    '10px',
          color:         '#555',
          fontSize:      '13px',
          background:    '#1a1a1a',
          padding:       '2px 10px',
          borderRadius:  '20px',
        }}>5 docs/month</span>
        <p style={{ color: '#666', fontSize: '13px', margin: '4px 0 0' }}>
          No credit card required. All document types included.
        </p>
      </div>
      <a
        href="/docs#get-started"
        style={{
          background:   'transparent',
          color:        '#c9a84c',
          border:       '1px solid #333',
          borderRadius: '8px',
          fontSize:     '13px',
          fontWeight:   600,
          padding:      '10px 20px',
          textDecoration:'none',
          whiteSpace:   'nowrap',
          flexShrink:   0,
        }}
      >
        Get free key →
      </a>
    </div>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ({ items }) {
  const [open, setOpen] = useState(null)

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            borderBottom: '1px solid #1e1e1e',
            padding:      '0',
          }}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width:          '100%',
              background:     'transparent',
              border:         'none',
              color:          '#f0ece4',
              fontSize:       '15px',
              fontWeight:     600,
              textAlign:      'left',
              padding:        '20px 0',
              cursor:         'pointer',
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              gap:            '16px',
            }}
          >
            <span>{item.q}</span>
            <span style={{
              color:      '#c9a84c',
              fontSize:   '20px',
              lineHeight: 1,
              flexShrink: 0,
              transform:  open === i ? 'rotate(45deg)' : 'none',
              transition: 'transform 0.2s',
            }}>+</span>
          </button>

          {open === i && (
            <p style={{
              color:        '#888',
              fontSize:     '14px',
              lineHeight:   1.7,
              margin:       '0 0 20px',
              paddingRight: '32px',
            }}>
              {item.a}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState(null)

  function handleSelect(plan) {
    track('pricing_plan_selected', { tier: plan.tier })
    setSelectedPlan(plan)
  }

  return (
    <>
      <Helmet>
        <title>Pricing — Ebenova API</title>
        <meta
          name="description"
          content="Simple, transparent pricing for the Ebenova Legal & Business API. Start free, upgrade when you're ready. Starter $29/mo, Growth $79/mo, Scale $199/mo."
        />
        <meta property="og:title"       content="Pricing — Ebenova API" />
        <meta property="og:description" content="Start free with 5 docs/month. Upgrade to Starter, Growth, or Scale for higher limits and premium features." />
        <link rel="canonical" href="https://ebenova.dev/pricing" />
      </Helmet>

      <div style={{ background: '#0e0e0e', minHeight: '100vh', color: '#f0ece4' }}>

        {/* Nav strip */}
        <nav style={{
          borderBottom: '1px solid #1a1a1a',
          padding:      '16px 24px',
          display:      'flex',
          alignItems:   'center',
          justifyContent:'space-between',
          maxWidth:     '1100px',
          margin:       '0 auto',
        }}>
          <a href="/" style={{ color: '#c9a84c', fontWeight: 800, fontSize: '17px', textDecoration: 'none', letterSpacing: '0.5px' }}>
            Ebenova
          </a>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <a href="/docs"      style={{ color: '#888', fontSize: '14px', textDecoration: 'none' }}>Docs</a>
            <a href="/dashboard" style={{ color: '#888', fontSize: '14px', textDecoration: 'none' }}>Dashboard</a>
            <a href="/docs#get-started" style={{
              background: '#c9a84c', color: '#0e0e0e',
              padding: '8px 18px', borderRadius: '6px',
              fontSize: '13px', fontWeight: 700, textDecoration: 'none',
            }}>
              Get API key
            </a>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '80px 24px 56px' }}>
          <div style={{
            display:       'inline-block',
            background:    '#c9a84c18',
            color:         '#c9a84c',
            fontSize:      '11px',
            fontWeight:    700,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            padding:       '5px 14px',
            borderRadius:  '20px',
            marginBottom:  '20px',
          }}>
            Simple pricing
          </div>
          <h1 style={{
            fontSize:   'clamp(32px, 5vw, 52px)',
            fontWeight: 800,
            margin:     '0 0 16px',
            lineHeight: 1.15,
            color:      '#f0ece4',
          }}>
            Pay for what you use.<br />
            <span style={{ color: '#c9a84c' }}>No surprises.</span>
          </h1>
          <p style={{
            color:     '#888',
            fontSize:  'clamp(15px, 2vw, 18px)',
            maxWidth:  '520px',
            margin:    '0 auto 12px',
            lineHeight:1.6,
          }}>
            All plans include every API endpoint. Upgrade or cancel any time.
          </p>
        </div>

        {/* Plan cards */}
        <div style={{
          display:        'flex',
          flexWrap:       'wrap',
          gap:            '24px',
          justifyContent: 'center',
          padding:        '0 24px 64px',
          maxWidth:       '1100px',
          margin:         '0 auto',
        }}>
          {PLANS.map(plan => (
            <PlanCard key={plan.tier} plan={plan} onSelect={handleSelect} />
          ))}
        </div>

        {/* Free tier banner */}
        <div style={{ padding: '0 24px 80px' }}>
          <FreePlanCard />
        </div>

        {/* FAQ */}
        <div style={{
          borderTop: '1px solid #1a1a1a',
          padding:   '72px 24px 96px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ color: '#f0ece4', fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 700, margin: '0 0 8px' }}>
              Frequently asked questions
            </h2>
            <p style={{ color: '#555', fontSize: '15px', margin: 0 }}>
              Still have questions?{' '}
              <a href="mailto:api@ebenova.dev" style={{ color: '#c9a84c', textDecoration: 'none' }}>
                Email us
              </a>
            </p>
          </div>
          <FAQ items={FAQS} />
        </div>

        {/* Footer */}
        <div style={{
          borderTop:  '1px solid #111',
          padding:    '28px 24px',
          textAlign:  'center',
        }}>
          <p style={{ color: '#333', fontSize: '13px', margin: 0 }}>
            &copy; {new Date().getFullYear()} Ebenova &mdash;{' '}
            <a href="/privacy" style={{ color: '#444', textDecoration: 'none' }}>Privacy</a>
            {' · '}
            <a href="/terms"   style={{ color: '#444', textDecoration: 'none' }}>Terms</a>
            {' · '}
            <a href="mailto:api@ebenova.dev" style={{ color: '#444', textDecoration: 'none' }}>api@ebenova.dev</a>
          </p>
        </div>
      </div>

      {/* Email modal */}
      {selectedPlan && (
        <EmailModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </>
  )
}
