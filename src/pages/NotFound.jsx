import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { FileText } from '@phosphor-icons/react'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <>
      <Helmet>
        <title>404 — Page Not Found | Signova</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px', textAlign: 'center'
    }}>
      <FileText size={56} weight="duotone" color="var(--gold)" style={{ marginBottom: '16px' }} />
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: '32px',
        fontWeight: 700, color: 'var(--text)', marginBottom: '12px'
      }}>Page not found</h1>
      <p style={{
        fontSize: '16px', color: 'var(--text2)',
        marginBottom: '32px', maxWidth: '400px', lineHeight: 1.6
      }}>
        This page doesn't exist. But your next legal document is one click away.
      </p>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'var(--gold)', color: '#0e0e0e',
          border: 'none', borderRadius: '8px',
          padding: '14px 28px', fontSize: '15px',
          fontWeight: 600, cursor: 'pointer'
        }}
      >
        Back to Signova →
      </button>
    </div>
    </>
  )
}
