// @ebenova/legal-docs — Node.js SDK
// https://ebenova.dev/docs

const DEFAULT_BASE_URL = 'https://api.ebenova.dev'

export class EbenovaError extends Error {
  constructor(message, code, status, hint) {
    super(message)
    this.name = 'EbenovaError'
    this.code = code
    this.status = status
    this.hint = hint
  }
}

/**
 * Ebenova Legal Document API client
 *
 * @example
 * import { EbenovaClient } from '@ebenova/legal-docs'
 *
 * const client = new EbenovaClient({ apiKey: 'sk_live_...' })
 *
 * const result = await client.documents.generate({
 *   document_type: 'nda',
 *   fields: { disclosingParty: 'Acme Inc.', receivingParty: 'John Smith', ... },
 *   jurisdiction: 'Nigeria',
 * })
 *
 * console.log(result.document)
 */
export class EbenovaClient {
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL } = {}) {
    if (!apiKey) throw new EbenovaError('apiKey is required', 'MISSING_API_KEY', 0)
    this._apiKey = apiKey
    this._baseUrl = baseUrl.replace(/\/$/, '')
    this.documents = new DocumentsResource(this)
    this.invoices = new InvoicesResource(this)
    this.extract = new ExtractResource(this)
    this.keys = new KeysResource(this)
  }

  async _request(method, path, body) {
    const url = `${this._baseUrl}${path}`
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this._apiKey}`,
      },
    }
    if (body) options.body = JSON.stringify(body)

    const res = await fetch(url, options)
    const data = await res.json()

    if (!data.success) {
      throw new EbenovaError(
        data.error?.message || `Request failed (${res.status})`,
        data.error?.code || 'UNKNOWN',
        res.status,
        data.error?.hint,
      )
    }

    return data
  }
}

class DocumentsResource {
  constructor(client) { this._client = client }

  /**
   * Generate a legal document.
   *
   * @param {Object} params
   * @param {string} params.document_type - Document type slug (e.g. 'nda', 'tenancy-agreement')
   * @param {Object} params.fields - Document-specific fields
   * @param {string} [params.jurisdiction] - Governing law (e.g. 'Nigeria')
   * @returns {Promise<{ document_type, document, usage, generated_at }>}
   */
  async generate({ document_type, fields, jurisdiction } = {}) {
    return this._client._request('POST', '/v1/documents/generate', { document_type, fields, jurisdiction })
  }

  /**
   * List all supported document types.
   * @returns {Promise<{ total, types, grouped }>}
   */
  async types() {
    return this._client._request('GET', '/v1/documents/types')
  }
}

class InvoicesResource {
  constructor(client) { this._client = client }

  /**
   * Generate an invoice, receipt, proforma invoice, or credit note.
   *
   * @param {Object} params
   * @param {'invoice'|'receipt'|'proforma'|'credit-note'} [params.type='invoice']
   * @param {{ name, address?, email?, phone?, tax_id? }} params.from
   * @param {{ name, address?, email?, phone?, tax_id? }} params.to
   * @param {Array<{ description, quantity, unit_price, notes? }>} params.items
   * @param {string} [params.invoice_number]
   * @param {string} [params.issue_date]
   * @param {string} [params.due_date]
   * @param {string} [params.currency='USD']
   * @param {number} [params.tax_rate=0]
   * @param {number} [params.discount_percent=0]
   * @param {string} [params.notes]
   * @param {string} [params.payment_instructions]
   * @param {string} [params.logo_url]
   * @returns {Promise<{ invoice_id, total, currency, html, usage, generated_at }>}
   */
  async generate(params = {}) {
    return this._client._request('POST', '/v1/invoices/generate', params)
  }
}

class ExtractResource {
  constructor(client) { this._client = client }

  /**
   * Extract structured fields from a raw conversation.
   *
   * @param {Object} params
   * @param {string} params.conversation - Raw conversation text (WhatsApp, email, chat)
   * @param {string} [params.target_document] - Document type to extract for
   * @param {boolean} [params.auto_generate=false] - Also generate the document after extraction
   * @returns {Promise<{ suggested_document, confidence, extracted_fields, missing_fields, document? }>}
   */
  async conversation({ conversation, target_document, auto_generate = false } = {}) {
    return this._client._request('POST', '/v1/extract/conversation', { conversation, target_document, auto_generate })
  }
}

class KeysResource {
  constructor(client) { this._client = client }

  /**
   * Get API key usage stats for the current month.
   * @returns {Promise<{ key, current_month, history }>}
   */
  async usage() {
    return this._client._request('GET', '/v1/keys/usage')
  }
}

export default EbenovaClient
