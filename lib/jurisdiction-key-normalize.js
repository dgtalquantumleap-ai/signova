// lib/jurisdiction-key-normalize.js
//
// Maps free-form jurisdiction strings to canonical JURISDICTION_KEYS.
// API callers may already pass canonical keys; UI passes display-name strings
// like "Nigeria", "United Kingdom", "United States — California".
// Order matters: more-specific patterns before more-general ones.

import { JURISDICTION_KEYS } from './jurisdiction-context.js'

export function normalizeJurisdictionKey(jurRaw) {
  if (!jurRaw) return null
  const s = String(jurRaw).toLowerCase().trim()
  if (JURISDICTION_KEYS.includes(s)) return s
  if (s.includes('nigeria')) return 'nigeria'
  if (s.includes('kenya')) return 'kenya'
  if (s.includes('ghana')) return 'ghana'
  if (s.includes('south africa') || s.includes('rsa')) return 'south_africa'
  if (s.includes('united kingdom') || s === 'uk' || /\bengland\b/.test(s) || /\bwales\b/.test(s)) return 'uk'
  if (s.includes('singapore')) return 'singapore'
  if (/\bindia\b/.test(s)) return 'india'
  if (s.includes('united arab emirates') || /\buae\b/.test(s) || /\bdifc\b/.test(s) || /\badgm\b/.test(s)) return 'uae'
  if (s.includes('european union') || s === 'eu') return 'eu'
  // Canada — province-specific before federal
  if (s.includes('quebec') || s.includes('québec') || s.includes('law 25')) return 'canada_quebec'
  if (s.includes('ontario')) return 'canada_ontario'
  if (s.includes('british columbia') || /\b(bc|b\.c\.)\b/.test(s)) return 'canada_bc'
  if (s.includes('canada') || s.includes('pipeda') ||
      /\b(alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|yukon|nunavut|northwest territories)\b/.test(s)) return 'canada_federal'
  // USA — state-specific before federal
  if (s.includes('california') || s.includes('ccpa') || s.includes('cpra')) return 'usa_california'
  if (s.includes('new york') || /\bny\b/.test(s)) return 'usa_new_york'
  if (/\btexas\b/.test(s)) return 'usa_texas'
  if (/\bflorida\b/.test(s)) return 'usa_florida'
  // Day 5A — Delaware. The negative lookahead excludes "delaware county"
  // (which exists in PA, OH, IN, NY etc.) so callers mentioning a county
  // don't accidentally route to state-of-Delaware law. DGCL and Court of
  // Chancery are Delaware-specific anchors.
  if (/\bdelaware\b(?!\s+county)/.test(s) || /\bdgcl\b/.test(s) || /\bdelaware\s+court\s+of\s+chancery\b/.test(s) || /\b6\s*del\.?\s*c\.?\b/.test(s)) return 'usa_delaware'
  if (s.includes('united states') || /\busa\b/.test(s) || /\bu\.s\.\b/.test(s) ||
      /\b(alabama|alaska|arizona|arkansas|colorado|connecticut|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/.test(s)) return 'usa_federal'
  return null
}
