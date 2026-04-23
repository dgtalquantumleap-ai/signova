// Single source of truth for the Rosemary Onu-Okeke compliance attribution.
//
// ROSEMARY_ATTRIBUTION_APPROVED gates ALL public-facing display of her name.
// Do not reference ROSEMARY_ATTRIBUTION_STRING on any user-facing surface
// (product pages, generated NDA output, Generator.jsx, schema.org metadata,
// open graph tags, public API responses) until this flag is true.
//
// Internal use (docs/compliance/, PR descriptions, test names, FOLLOW_UPS.md)
// does not require the approval gate.

export const ROSEMARY_ATTRIBUTION_STRING =
  'NDPA/GAID Compliance Review: Barrister Rosemary Onu-Okeke — DataLex Consulting'

export const ROSEMARY_CONTACT_URL = ''
// LinkedIn URL pending — do NOT hardcode any URL until Rosemary provides one.
// Empty string signals "not yet approved for display" to any rendering layer.

export const ROSEMARY_ATTRIBUTION_APPROVED = false
// Flip to true ONLY after Rosemary signs off on final wording and placement
// in writing. Required before enabling:
//   - Nigerian NDA product page credit
//   - Generated Nigerian NDA PDF footer
//   - Generator.jsx Nigerian NDA selection screen
//   - Any marketing copy, schema.org metadata, or open graph tags
//   - LinkedIn announcement tagging her
