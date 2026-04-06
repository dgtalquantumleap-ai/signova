// Tests for body parsing utility
import { describe, it, expect, vi } from 'vitest'
import { parseBody } from '../../lib/parse-body.js'

describe('lib/parse-body.js', () => {
  it('should return body if already parsed (Vercel middleware)', async () => {
    const req = { body: { name: 'test', email: 'test@example.com' } }
    const result = await parseBody(req)
    expect(result).toEqual({ name: 'test', email: 'test@example.com' })
  })

  it('should parse JSON from stream', async () => {
    const chunks = ['{"name":"test","value":123}']
    const req = {
      body: undefined,
      on: (event, cb) => {
        if (event === 'data') chunks.forEach(chunk => cb(chunk))
        if (event === 'end') setTimeout(() => cb(), 0)
      },
    }
    const result = await parseBody(req)
    expect(result).toEqual({ name: 'test', value: 123 })
  })

  it('should return empty object for empty body', async () => {
    const req = {
      body: undefined,
      on: (event, cb) => {
        if (event === 'end') setTimeout(() => cb(), 0)
      },
    }
    const result = await parseBody(req)
    expect(result).toEqual({})
  })

  it('should return empty object for invalid JSON', async () => {
    const chunks = ['not valid json']
    const req = {
      body: undefined,
      on: (event, cb) => {
        if (event === 'data') chunks.forEach(chunk => cb(chunk))
        if (event === 'end') setTimeout(() => cb(), 0)
      },
    }
    const result = await parseBody(req)
    expect(result).toEqual({})
  })
})
