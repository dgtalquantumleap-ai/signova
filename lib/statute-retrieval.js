import { createClient } from '@supabase/supabase-js'
import { logInfo, logWarn, logError } from './logger.js'

const ENDPOINT = 'statute-retrieval'

export class StatuteRetrievalError extends Error {
  constructor(message) {
    super(message)
    this.name = 'StatuteRetrievalError'
  }
}

let _client = null

function createSupabaseClient() {
  if (_client) return _client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new StatuteRetrievalError(
      'Missing required env vars: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  _client = createClient(url, key)
  return _client
}

async function cacheLookup(jurisdiction, docType, statuteRef) {
  const supabase = createSupabaseClient()

  const { data, error } = await supabase
    .from('statute_cache')
    .select('*')
    .eq('jurisdiction', jurisdiction)
    .eq('doc_type', docType)
    .eq('statute_ref', statuteRef)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) {
    logWarn(ENDPOINT, { event: 'cache_lookup_error', jurisdiction, docType, statuteRef, error: error.message })
    return null
  }

  if (data) {
    logInfo(ENDPOINT, { event: 'cache_hit', jurisdiction, docType, statuteRef })
    return data
  }

  logInfo(ENDPOINT, { event: 'cache_miss', jurisdiction, docType, statuteRef })
  return null
}

async function cacheWrite(jurisdiction, docType, statuteRef, query, content, sources, olostepAnswerId) {
  const supabase = createSupabaseClient()

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('statute_cache')
    .upsert(
      {
        jurisdiction,
        doc_type: docType,
        statute_ref: statuteRef,
        query,
        content,
        sources_json: sources,
        olostep_answer_id: olostepAnswerId,
        expires_at: expiresAt,
        retrieved_at: new Date().toISOString(),
      },
      { onConflict: 'jurisdiction,doc_type,statute_ref' }
    )

  if (error) {
    logWarn(ENDPOINT, { event: 'cache_write_error', jurisdiction, docType, statuteRef, error: error.message })
  }
}

async function callOlostep(query) {
  const apiKey = process.env.OLOSTEP_API_KEY
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  try {
    const response = await fetch('https://api.olostep.com/v1/answers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: query }),
      signal: controller.signal,
    })

    if (response.status >= 500) {
      throw new StatuteRetrievalError(`Olostep server error: HTTP ${response.status}`)
    }

    if (response.status >= 400) {
      logWarn(ENDPOINT, { event: 'olostep_client_error', status: response.status, query })
      return null
    }

    const data = await response.json()
    return {
      content: data.answer,
      sources: data.sources ?? [],
      answerId: data.id,
    }
  } catch (err) {
    if (err instanceof StatuteRetrievalError) throw err

    logWarn(ENDPOINT, { event: 'olostep_network_error', message: err.message, query })
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function retrieveStatute(jurisdiction, docType, statuteRef, query) {
  if (process.env.STATUTE_RETRIEVAL_ENABLED !== 'true') return null

  try {
    const cached = await cacheLookup(jurisdiction, docType, statuteRef)
    if (cached) {
      return {
        content: cached.content,
        sources: cached.sources_json,
        fromCache: true,
        retrievedAt: cached.retrieved_at,
      }
    }

    const result = await callOlostep(query)
    if (!result) {
      logWarn(ENDPOINT, { event: 'olostep_returned_null', jurisdiction, docType, statuteRef })
      return null
    }

    await cacheWrite(jurisdiction, docType, statuteRef, query, result.content, result.sources, result.answerId)

    return {
      content: result.content,
      sources: result.sources,
      fromCache: false,
      retrievedAt: new Date().toISOString(),
    }
  } catch (err) {
    if (err instanceof StatuteRetrievalError) throw err

    logError(ENDPOINT, { event: 'retrieve_statute_unexpected_error', message: err.message, jurisdiction, docType, statuteRef })
    return null
  }
}

export async function getStatuteBundle(jurisdiction, docType) {
  if (process.env.STATUTE_RETRIEVAL_ENABLED !== 'true') return []

  try {
    const supabase = createSupabaseClient()

    const { data, error } = await supabase
      .from('statute_cache')
      .select('statute_ref, content, sources_json')
      .eq('jurisdiction', jurisdiction)
      .eq('doc_type', docType)
      .gt('expires_at', new Date().toISOString())

    if (error) {
      logWarn(ENDPOINT, { event: 'get_bundle_error', jurisdiction, docType, error: error.message })
      return []
    }

    return (data ?? []).map((row) => ({
      statuteRef: row.statute_ref,
      content: row.content,
      sources: row.sources_json,
    }))
  } catch (err) {
    logWarn(ENDPOINT, { event: 'get_bundle_unexpected_error', jurisdiction, docType, message: err.message })
    return []
  }
}
