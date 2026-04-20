import { useParams, Link, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useState, useEffect } from 'react'
import { Lightning } from '@phosphor-icons/react'
import './Blog.css'

export default function BlogPost() {
  const { slug } = useParams()
  const [postData, setPostData] = useState(null)
  const [allPosts, setAllPosts] = useState(null)

  useEffect(() => {
    let cancelled = false
    import('../../data/blogPosts').then(({ getPostBySlug, BLOG_POSTS }) => {
      if (!cancelled) {
        const post = getPostBySlug(slug)
        if (post) {
          setPostData(post)
          setAllPosts(BLOG_POSTS.filter(p => p.slug !== slug).slice(0, 2))
        } else {
          setPostData('not-found')
        }
      }
    })
    return () => { cancelled = true }
  }, [slug])

  if (!postData) {
    // Show minimal loading, but if slug is invalid we'll redirect after data loads
    return (
      <div className="blog-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div>Loading...</div>
      </div>
    )
  }

  // If data loaded and post not found, redirect
  if (postData === 'not-found') return <Navigate to="/blog" replace />

  const post = postData
  const related = allPosts || []

  return (
    <>
      <Helmet>
        <title>{post.title} — Signova</title>
        <meta name="description" content={post.description} />
        <meta name="keywords" content={post.keywords} />
        <link rel="canonical" href={`https://www.getsignova.com/blog/${post.slug}`} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:url" content={`https://www.getsignova.com/blog/${post.slug}`} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.description} />
      </Helmet>

      <div className="blog-page">
        {/* Back nav */}
        <div className="blog-post-nav">
          <Link to="/blog" className="blog-back">← All guides</Link>
          <Link to="/" className="blog-back-home">Signova Home</Link>
        </div>

        {/* Article */}
        <article className="blog-article">
          <div className="blog-article-meta">
            <span className="blog-cat">{post.category}</span>
            <span className="blog-read">{post.readTime}</span>
            <span className="blog-date">{new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>

          <h1 className="blog-article-title">{post.title}</h1>
          <p className="blog-article-intro">{post.description}</p>

          <div className="blog-article-body">
            {post.sections.map((section, i) => (
              <>
                <div key={i} className="blog-section">
                  <h2>{section.heading}</h2>
                  {section.body.split('\n\n').map((para, j) => (
                    <p key={j}>{para}</p>
                  ))}
                </div>
                {/* Mid-article CTA — fires after section 2 (index 1) */}
                {i === 1 && (
                  <Link key="mid-cta" to={post.cta.href} className="blog-mid-cta">
                    <span className="blog-mid-cta-label">Skip the reading — </span>
                    <strong>{post.cta.label}</strong>
                    <span className="blog-mid-cta-note">Free preview · $4.99 to download</span>
                  </Link>
                )}
              </>
            ))}
          </div>

          {/* CTA box */}
          <div className="blog-cta-box">
            <div className="blog-cta-icon"><Lightning size={28} weight="fill" /></div>
            <div className="blog-cta-text">
              <strong>Generate yours in 2 minutes</strong>
              <p>Preview free — download for $4.99. No account needed.</p>
            </div>
            <Link to={post.cta.href} className="btn-blog-cta">{post.cta.label}</Link>
          </div>
        </article>

        {/* Related posts */}
        {related.length > 0 && (
          <div className="blog-related">
            <h3>More Legal Guides</h3>
            <div className="blog-grid blog-grid-sm">
              {related.map(p => (
                <Link key={p.slug} to={`/blog/${p.slug}`} className="blog-card">
                  <div className="blog-card-top">
                    <span className="blog-cat">{p.category}</span>
                    <span className="blog-read">{p.readTime}</span>
                  </div>
                  <h2 className="blog-card-title">{p.title}</h2>
                  <p className="blog-card-desc">{p.description}</p>
                  <span className="blog-card-cta">Read guide →</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
