import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { BLOG_POSTS } from '../../data/blogPosts'
import './Blog.css'

export default function BlogIndex() {
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
          <div className="blog-grid">
            {BLOG_POSTS.map(post => (
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
        </main>

        {/* Footer CTA */}
        <div className="blog-footer-cta">
          <p>Ready to generate a document?</p>
          <Link to="/" className="btn-blog-cta">See all 27 document types →</Link>
        </div>
      </div>
    </>
  )
}
