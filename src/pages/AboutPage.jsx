import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

export default function AboutPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
      <Helmet>
        <title>About Signova — Built by a Nigerian Founder in Calgary</title>
        <meta name="description" content="Signova is built by Olumide, a Nigerian founder in Calgary. Legal documents in 2 minutes for freelancers, landlords, and small businesses." />
        <link rel="canonical" href="https://www.getsignova.com/about" />
      </Helmet>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: '64px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0,
        background: 'rgba(14,14,14,0.95)',
        backdropFilter: 'blur(12px)', zIndex: 10
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '14px', cursor: 'pointer' }}
        >
          ← Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <span style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--gold)', color: '#0e0e0e',
            fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>S</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600 }}>Signova</span>
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'var(--gold)', color: '#0e0e0e',
            border: 'none', borderRadius: '8px',
            padding: '8px 18px', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer'
          }}
        >
          Try it free →
        </button>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: '680px', margin: '0 auto', padding: '72px 24px 48px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px', borderRadius: '100px',
          border: '1px solid rgba(201,168,76,0.3)',
          background: 'rgba(201,168,76,0.06)',
          fontSize: '12px', color: 'var(--gold)',
          letterSpacing: '0.5px', marginBottom: '28px'
        }}>
          🇳🇬 Built by a Nigerian founder · Based in Calgary, Canada
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 5vw, 44px)',
          fontWeight: 700, color: 'var(--text)',
          lineHeight: 1.2, marginBottom: '20px'
        }}>
          Legal documents shouldn't cost<br />more than the deal itself.
        </h1>
        <p style={{
          fontSize: '17px', color: 'var(--text2)',
          lineHeight: 1.75, marginBottom: '0'
        }}>
          Signova started with a simple observation: most freelancers, landlords, and small business
          owners skip contracts — not because they don't understand their value, but because
          getting one drafted costs more than the transaction it's meant to protect.
        </p>
      </section>

      {/* Founder story */}
      <section style={{
        maxWidth: '680px', margin: '0 auto',
        padding: '0 24px 64px', borderTop: '1px solid var(--border)',
        paddingTop: '56px'
      }}>
        <p style={{ fontSize: '12px', color: 'var(--gold)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '24px' }}>
          The story
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {[
            `I'm Olumide — a Nigerian software developer based in Calgary, Canada. I've watched friends, family, and colleagues across Nigeria, Ghana, and Kenya lose money, deals, and sometimes relationships because they had no written agreement. A cousin lent ₦500,000 to a business partner on a handshake. A freelancer built a full website and got ghosted. A landlord couldn't evict a non-paying tenant because the tenancy was verbal.`,
            `The frustrating part isn't that people didn't know they needed a contract. They did. The problem is that getting a lawyer to draft one costs ₦50,000–₦200,000 in Nigeria for what is often a standard document. In Canada and the UK, it's $300–$500/hour. Most people — especially freelancers and small landlords — just skip it and hope for the best.`,
            `Signova changes that. You answer a few questions about your specific situation. We generate a professional, jurisdiction-aware legal document in under 3 minutes. You preview it for free, and pay $4.99 — less than a lunch — to download the clean PDF.`,
            `We now support 27 document types for any jurisdiction worldwide. Nigerian landlords, Kenyan freelancers, Canadian contractors, Indian consultants, UAE business owners — anyone who needs a proper document without paying lawyer rates.`,
          ].map((para, i) => (
            <p key={i} style={{ fontSize: '16px', color: 'var(--text2)', lineHeight: 1.8, margin: 0 }}>
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section style={{
        maxWidth: '680px', margin: '0 auto',
        padding: '0 24px 64px'
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1px', background: 'var(--border)',
          border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden'
        }}>
          {[
            { num: '27', label: 'Document types' },
            { num: '180+', label: 'Countries supported' },
            { num: '$4.99', label: 'Per document' },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--bg2)', padding: '28px 20px', textAlign: 'center'
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700, color: 'var(--gold)', marginBottom: '6px' }}>
                {s.num}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section style={{
        maxWidth: '680px', margin: '0 auto',
        padding: '0 24px 64px', borderTop: '1px solid var(--border)', paddingTop: '56px'
      }}>
        <p style={{ fontSize: '12px', color: 'var(--gold)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '32px' }}>
          What we stand for
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {[
            { title: 'No legal knowledge required', body: 'You shouldn\'t need to understand contract law to protect yourself. Answer plain-English questions. We handle the legal structure.' },
            { title: 'Preview before you pay', body: 'See your complete document before spending a single cent. If it\'s not right, you owe us nothing.' },
            { title: 'Your data stays yours', body: 'We do not store your answers, your names, or your document content. It\'s generated in real time and never saved on our servers.' },
            { title: 'Honest about what we are', body: 'Signova generates professional standard documents — not legal advice. For complex disputes or high-value transactions, consult a qualified attorney. We tell you this because it\'s true.' },
          ].map((v, i) => (
            <div key={i} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700,
                color: 'var(--gold)', flexShrink: 0
              }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>{v.title}</div>
                <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.7 }}>{v.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact + CTA */}
      <section style={{
        maxWidth: '680px', margin: '0 auto',
        padding: '0 24px 64px', borderTop: '1px solid var(--border)', paddingTop: '56px'
      }}>
        <p style={{ fontSize: '12px', color: 'var(--gold)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '24px' }}>
          Get in touch
        </p>
        <p style={{ fontSize: '16px', color: 'var(--text2)', lineHeight: 1.75, marginBottom: '16px' }}>
          Questions, feedback, or a document type you need that we don't have yet — email us at{' '}
          <a href={`mailto:${'info'}@${'ebenova.net'}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>
            <span className="email-obfuscated" data-user="info" data-domain="ebenova.net"></span>
          </a>
          . We read every message.
        </p>
        <p style={{ fontSize: '16px', color: 'var(--text2)', lineHeight: 1.75, marginBottom: '40px' }}>
          Follow the build in public on X:{' '}
          <a href="https://x.com/quantimleap100" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
            @quantimleap100
          </a>
          . Day 18. $0 revenue. Still shipping.
        </p>

        {/* Final CTA */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.02))',
          border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: '16px', padding: '40px',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '24px',
            fontWeight: 700, color: 'var(--text)', marginBottom: '12px'
          }}>
            Ready to generate your document?
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text2)', marginBottom: '24px', lineHeight: 1.6 }}>
            Free preview. $4.99 to download. No account. No subscription. No lawyer needed.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'var(--gold)', color: '#0e0e0e',
              border: 'none', borderRadius: '10px',
              padding: '14px 32px', fontSize: '15px',
              fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '8px'
            }}
          >
            Choose your document →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '28px 24px', textAlign: 'center'
      }}>
        <p style={{ fontSize: '12px', color: 'var(--text3)', margin: 0 }}>
          © 2026 Signova™ · Ebenova Solutions ·{' '}
          <a href="/privacy" style={{ color: 'var(--text3)' }}>Privacy</a> ·{' '}
          <a href="/terms" style={{ color: 'var(--text3)' }}>Terms</a>
        </p>
      </footer>
    </div>
  )
}
