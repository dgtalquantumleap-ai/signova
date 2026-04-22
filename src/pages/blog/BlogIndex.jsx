import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useState, useEffect } from 'react'
import './Blog.css'

export default function BlogIndex() {
  const [posts, setPosts] = useState(null)

  useEffect(() => {
    // Defer loading of blog posts data — not needed for initial render
    let cancelled = false
    import('../../data/blogPosts').then(({ BLOG_POSTS }) => {
      if (!cancelled) setPosts(BLOG_POSTS)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <Helmet>
        <title>Legal Document Guides — Signova Blog | Nigeria, Africa & Global</title>
        <meta name="description" content="Free guides on tenancy agreements, deeds of assignment, NDAs, business proposals and more. Learn what each document requires and generate yours in minutes." />
        <link rel="canonical" href="https://www.getsignova.com/blog" />
      </Helmet>

      <div className="blog-page">
        {/* Header */}
        <header className="blog-header">
          <Link to="/" className="blog-back">← Back to Signova</Link>
          <h1 className="blog-title">Legal Document Guides</h1>
          <p className="blog-subtitle">Everything you need to know about contracts, agreements, and legal documents — written for Nigeria, Africa, and global readers.</p>
        </header>

        {/* Post grid */}
        <main className="blog-grid-wrap">
          {!posts ? (
            <div className="blog-loading">Loading posts...</div>
          ) : (
            <div className="blog-grid">
              {posts.map(post => (
                <Link key={post.slug} to={`/blog/${post.slug}`} className="blog-card">
                  <div className="blog-card-top">
                    <span className="blog-cat">{post.category}</span>
                    <span className="blog-read">{post.readTime}</span>
                  </div>
                  <h2 className="blog-card-title">{post.title}</h2>
                  <p className="blog-card-desc">{post.description}</p>
                  <span className="blog-card-cta">Read guide →</span>
                </Link>
              ))}
            </div>
          )}
        </main>

        {/* Footer CTA */}
        <div className="blog-footer-cta">
          <p>Ready to generate a document?</p>
          <Link to="/" className="btn-blog-cta">See all 28 document types →</Link>
        </div>
      </div>
    </>
  )
}
