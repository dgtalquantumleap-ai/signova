// Tests for HTML sanitization utilities
import { describe, it, expect } from 'vitest'
import { escapeHtml, escapeHtmlTrunc } from '../../lib/sanitize.js'

describe('escapeHtml', () => {
  it('should escape basic HTML special characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
    expect(escapeHtml("it's")).toBe('it&#x27;s')
  })

  it('should handle backticks', () => {
    expect(escapeHtml('`code`')).toBe('&#x60;code&#x60;')
  })

  it('should handle null and undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('should handle non-string values', () => {
    expect(escapeHtml(123)).toBe('123')
    expect(escapeHtml(true)).toBe('true')
  })

  it('should escape XSS payloads', () => {
    const xss = '<img src=x onerror=alert(1)>'
    const escaped = escapeHtml(xss)
    expect(escaped).not.toContain('<')
    expect(escaped).not.toContain('>')
    expect(escaped).toBe('&lt;img src=x onerror=alert(1)&gt;')
  })
})

describe('escapeHtmlTrunc', () => {
  it('should escape and truncate long strings', () => {
    const long = '<script>'.repeat(100)
    const truncated = escapeHtmlTrunc(long, 50)
    expect(truncated.length).toBeLessThanOrEqual(50)
    expect(truncated).toContain('&lt;')
  })

  it('should handle null and undefined', () => {
    expect(escapeHtmlTrunc(null)).toBe('')
    expect(escapeHtmlTrunc(undefined)).toBe('')
  })

  it('should use default max length of 500', () => {
    const long = 'a'.repeat(600)
    const result = escapeHtmlTrunc(long)
    expect(result.length).toBeLessThanOrEqual(500)
  })
})
