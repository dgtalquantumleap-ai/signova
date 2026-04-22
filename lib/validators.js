// lib/validators.js
// Shared Zod schemas for API input validation
// Usage: 
//   import { DocumentGenerateSchema } from '../../lib/validators.js'
//   const validated = DocumentGenerateSchema.parse(body)

import { z } from 'zod'
import { JURISDICTION_KEYS } from './jurisdiction-context.js'

// Scope Guard jurisdiction enum — backed by buildJurisdictionContext() in
// lib/jurisdiction-context.js. Adding to this list also requires adding a
// corresponding CONTEXTS entry in that file.
const SCOPE_GUARD_JURISDICTION_ENUM = z.enum(JURISDICTION_KEYS, {
  errorMap: () => ({ message: `jurisdiction must be one of: ${JURISDICTION_KEYS.join(', ')}` }),
}).optional()

// Document types supported
const SUPPORTED_TYPES = [
  'privacy-policy', 'terms-of-service', 'nda', 'freelance-contract',
  'independent-contractor', 'hire-purchase', 'tenancy-agreement', 'quit-notice',
  'deed-of-assignment', 'power-of-attorney', 'landlord-agent-agreement',
  'facility-manager-agreement', 'service-agreement', 'consulting-agreement',
  'employment-offer-letter', 'non-compete-agreement', 'payment-terms-agreement',
  'business-partnership', 'joint-venture', 'loan-agreement', 'shareholder-agreement',
  'mou', 'letter-of-intent', 'distribution-agreement', 'supply-agreement',
  'business-proposal', 'purchase-agreement',
  'founders-agreement', 'ip-assignment-agreement', 'advisory-board-agreement',
  'vesting-agreement', 'term-sheet', 'safe-agreement',
]

// Common jurisdictions
const _JURISDICTIONS = ['United States', 'United Kingdom', 'Nigeria', 'Kenya', 'Ghana', 'South Africa']

// Phase 5 — worker classification enum. Only these three modes are
// supported across the registry. Conditional "required" behaviour is
// enforced in the handler post-parse (based on the requested
// document_type's registry entry), not in Zod — keeps the schema flat
// and avoids Zod's awkward conditional-required syntax.
const WORKER_CLASSIFICATION_VALUES = ['employee', 'independent_contractor', 'exempt_worker_s91']

export const DocumentGenerateSchema = z.object({
  document_type: z.enum(SUPPORTED_TYPES, {
    errorMap: () => ({ message: `Invalid document type. Must be one of: ${SUPPORTED_TYPES.join(', ')}` }),
  }),
  fields: z.record(z.string(), z.any()).refine(
    (fields) => Object.keys(fields).length > 0,
    { message: 'At least one field is required' }
  ),
  jurisdiction: z.string().min(2, 'Jurisdiction must be at least 2 characters'),
  worker_classification: z.enum(WORKER_CLASSIFICATION_VALUES).optional(),
})

export const ScopeGuardAnalyzeSchema = z.object({
  contract_text: z.string().min(50, 'Contract text must be at least 50 characters'),
  client_message: z.string().min(5, 'Client message must be at least 5 characters'),
  channel: z.enum(['email', 'slack', 'whatsapp', 'other']).default('email'),
  // Optional jurisdiction key from the 18-jurisdiction enum. When omitted, the
  // analyze prompt falls back to the Commonwealth common-law baseline (see
  // lib/jurisdiction-context.js buildJurisdictionContext) — never silently to
  // California / Delaware. Was previously a freeform string accepted nowhere.
  jurisdiction: SCOPE_GUARD_JURISDICTION_ENUM,
})

export const ScopeGuardChangeOrderSchema = z.object({
  contract_text: z.string().min(50, 'Contract text required').optional(),
  original_scope: z.string().min(10, 'Original scope required').optional(),
  additional_work: z.string().min(10, 'Additional work description required'),
  additional_cost: z.union([z.number(), z.string().regex(/^[0-9]+(\.[0-9]+)?$/)]),
  estimated_hours: z.number().min(1).max(1000).optional(),
  hourly_rate: z.number().min(0).optional(),
  freelancer_name: z.string().optional(),
  client_name: z.string().optional(),
  currency: z.string().optional(),
  timeline_extension_days: z.number().int().optional(),
  contract_date: z.string().optional(),
  change_order_number: z.number().int().optional(),
  // Same enum-validated jurisdiction as analyze. Replaces the previous
  // freeform `jurisdiction = 'International'` default that accepted any string.
  jurisdiction: SCOPE_GUARD_JURISDICTION_ENUM,
})

export const AuthMagicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const AuthVerifySchema = z.object({
  token: z.string().min(20, 'Invalid token'),
})

export const BillingCheckoutSchema = z.object({
  tier: z.enum(['starter', 'growth', 'scale', 'insights_starter', 'insights_growth', 'insights_scale'], {
    errorMap: () => ({ message: 'Invalid tier. Must be: starter, growth, scale, insights_starter, insights_growth, or insights_scale' }),
  }),
  email: z.string().email('Invalid email'),
})

/**
 * Helper function to format Zod errors into API response format
 */
export function formatValidationError(error) {
  const details = error.errors.map(err => ({
    field: err.path.join('.') || 'body',
    message: err.message,
    code: err.code,
  }))
  return {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details,
  }
}
