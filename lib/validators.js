// lib/validators.js
// Shared Zod schemas for API input validation
// Usage: 
//   import { DocumentGenerateSchema } from '../../lib/validators.js'
//   const validated = DocumentGenerateSchema.parse(body)

import { z } from 'zod'

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
]

// Common jurisdictions
const JURISDICTIONS = ['United States', 'United Kingdom', 'Nigeria', 'Kenya', 'Ghana', 'South Africa']

export const DocumentGenerateSchema = z.object({
  document_type: z.enum(SUPPORTED_TYPES, {
    errorMap: () => ({ message: `Invalid document type. Must be one of: ${SUPPORTED_TYPES.join(', ')}` }),
  }),
  fields: z.record(z.string(), z.any()).refine(
    (fields) => Object.keys(fields).length > 0,
    { message: 'At least one field is required' }
  ),
  jurisdiction: z.string().min(2, 'Jurisdiction must be at least 2 characters'),
})

export const ScopeGuardAnalyzeSchema = z.object({
  contract_text: z.string().min(50, 'Contract text must be at least 50 characters'),
  client_message: z.string().min(5, 'Client message must be at least 5 characters'),
  channel: z.enum(['email', 'slack', 'whatsapp', 'other']).default('email'),
})

export const ScopeGuardChangeOrderSchema = z.object({
  contract_text: z.string().min(50, 'Contract text required'),
  original_scope: z.string().min(10, 'Original scope required'),
  additional_work: z.string().min(10, 'Additional work description required'),
  estimated_hours: z.number().min(1, 'Hours must be >= 1').max(1000),
  hourly_rate: z.number().min(0, 'Rate must be > 0'),
})

export const AuthMagicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const AuthVerifySchema = z.object({
  token: z.string().min(20, 'Invalid token'),
})

export const BillingCheckoutSchema = z.object({
  tier: z.enum(['starter', 'growth', 'scale'], {
    errorMap: () => ({ message: 'Invalid tier. Must be: starter, growth, or scale' }),
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
