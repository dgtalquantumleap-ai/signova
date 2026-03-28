// Type definitions for @ebenova/legal-docs

export type DocumentType =
  | 'nda'
  | 'freelance-contract'
  | 'service-agreement'
  | 'consulting-agreement'
  | 'independent-contractor'
  | 'business-partnership'
  | 'joint-venture'
  | 'distribution-agreement'
  | 'supply-agreement'
  | 'business-proposal'
  | 'purchase-agreement'
  | 'employment-offer-letter'
  | 'non-compete-agreement'
  | 'loan-agreement'
  | 'payment-terms-agreement'
  | 'shareholder-agreement'
  | 'hire-purchase'
  | 'tenancy-agreement'
  | 'quit-notice'
  | 'deed-of-assignment'
  | 'power-of-attorney'
  | 'landlord-agent-agreement'
  | 'facility-manager-agreement'
  | 'privacy-policy'
  | 'terms-of-service'
  | 'mou'
  | 'letter-of-intent'

export type FieldValue = string | string[]

export interface UsageBlock {
  documents_used: number
  documents_remaining: number
  monthly_limit: number
  resets_at: string
}

// ─── documents.generate ──────────────────────────────────────────────────────

export interface GenerateDocumentParams {
  document_type: DocumentType
  fields: Record<string, FieldValue>
  jurisdiction?: string
}

export interface GenerateDocumentResult {
  success: true
  document_type: DocumentType
  document: string
  usage: UsageBlock
  generated_at: string
}

// ─── documents.types ─────────────────────────────────────────────────────────

export interface DocumentTypeEntry {
  type: DocumentType
  label: string
}

export interface DocumentTypesResult {
  success: true
  total: number
  types: DocumentType[]
  grouped: Record<string, DocumentTypeEntry[]>
}

// ─── extract.conversation ─────────────────────────────────────────────────────

export interface ExtractConversationParams {
  conversation: string
  target_document?: DocumentType
  /** If true, also generate the document (counts as 1 against monthly quota). Default: false */
  auto_generate?: boolean
}

export interface ExtractConversationResult {
  success: true
  suggested_document: DocumentType | null
  /** Confidence score 0–1. Present when target_document was not specified. */
  confidence?: number
  extracted_fields: Record<string, FieldValue>
  missing_fields: string[]
  /** Present only when auto_generate is true */
  document?: string
  /** Present only when auto_generate is true */
  usage?: UsageBlock
  generated_at?: string
}

// ─── keys.usage ──────────────────────────────────────────────────────────────

export interface KeyInfo {
  owner: string
  tier: 'free' | 'starter' | 'growth' | 'scale' | 'enterprise'
  label: string | null
  created_at: string
}

export interface MonthlyHistory {
  month: string
  documents_generated: number
}

export interface KeyUsageResult {
  success: true
  key: KeyInfo
  current_month: UsageBlock
  history: MonthlyHistory[]
}

// ─── Error ───────────────────────────────────────────────────────────────────

export declare class EbenovaError extends Error {
  name: 'EbenovaError'
  code: string
  status: number
  hint?: string
  constructor(message: string, code: string, status: number, hint?: string)
}

// ─── Resources ───────────────────────────────────────────────────────────────

// ─── invoices.generate ───────────────────────────────────────────────────────

export type InvoiceType = 'invoice' | 'receipt' | 'proforma' | 'credit-note'
export type InvoiceCurrency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'NGN' | 'KES' | 'GHS' | 'ZAR' | 'INR' | 'AED' | 'SGD'

export interface InvoiceParty {
  name: string
  address?: string
  email?: string
  phone?: string
  tax_id?: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  notes?: string
}

export interface GenerateInvoiceParams {
  type?: InvoiceType
  from: InvoiceParty
  to: InvoiceParty
  items: InvoiceItem[]
  invoice_number?: string
  issue_date?: string
  due_date?: string
  currency?: InvoiceCurrency
  tax_rate?: number
  discount_percent?: number
  notes?: string
  payment_instructions?: string
  logo_url?: string
}

export interface GenerateInvoiceResult {
  success: true
  invoice_id: string
  invoice_number: string | null
  type: InvoiceType
  currency: InvoiceCurrency
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  /** Fully rendered HTML — display in an iframe or print-to-PDF */
  html: string
  usage: UsageBlock
  generated_at: string
}

// ─── Resources ───────────────────────────────────────────────────────────────

export declare class DocumentsResource {
  generate(params: GenerateDocumentParams): Promise<GenerateDocumentResult>
  types(): Promise<DocumentTypesResult>
}

export declare class InvoicesResource {
  generate(params: GenerateInvoiceParams): Promise<GenerateInvoiceResult>
}

export declare class ExtractResource {
  conversation(params: ExtractConversationParams): Promise<ExtractConversationResult>
}

export declare class KeysResource {
  usage(): Promise<KeyUsageResult>
}

// ─── Client ──────────────────────────────────────────────────────────────────

export interface EbenovaClientOptions {
  apiKey: string
  baseUrl?: string
}

export declare class EbenovaClient {
  documents: DocumentsResource
  invoices: InvoicesResource
  extract: ExtractResource
  keys: KeysResource
  constructor(options: EbenovaClientOptions)
}

export default EbenovaClient
