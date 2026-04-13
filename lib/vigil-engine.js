// lib/vigil-engine.js
// Pure-JS port of ProximityGuard/vigil-fraud-alert-mcp/src/services/engine.ts
// No external dependencies — runs entirely inside Vercel serverless functions.

const STALE_SOFT_MIN = 5
const STALE_HARD_MIN = 15

function toRad(deg) { return (deg * Math.PI) / 180 }

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function dateOnly(date) { return date.toISOString().split('T')[0] }

export function decide(event, card, gps, now = new Date()) {
  const start = Date.now()
  const result = (approved, reason_code, distance_km) => ({
    approved, reason_code, distance_km, processing_ms: Date.now() - start,
  })

  if (!card.is_active)         return result(false, 'CARD_INACTIVE', null)
  if (card.mode === 'lockdown') return result(false, 'LOCKDOWN', null)

  if (card.mode === 'travel') {
    const today = dateOnly(now)
    const matched = (card.travel_plans || []).some(p =>
      p.is_active &&
      p.destination_country === event.merchant.country &&
      p.start_date <= today &&
      p.end_date   >= today
    )
    if (matched) return result(true, 'TRAVEL_MATCH', null)
  }

  if (!gps)                                         return result(false, 'NO_GPS_ON_FILE', null)
  if (gps.is_mock_location || gps.is_jailbroken)    return result(false, 'SPOOFED_DEVICE', null)

  const ageMin = (now.getTime() - new Date(gps.recorded_at).getTime()) / 60_000
  if (ageMin > STALE_HARD_MIN) return result(false, 'GPS_STALE_HARD', null)
  if (ageMin > STALE_SOFT_MIN) return result(false, 'GPS_STALE_SOFT', null)

  const merchantLat = event.merchant.lat ?? card.home_lat
  const merchantLng = event.merchant.lng ?? card.home_lng
  const distance    = haversine(gps.lat, gps.lng, merchantLat, merchantLng)

  const accuracyBuffer  = gps.accuracy_meters > 500 ? gps.accuracy_meters / 1000 : 0
  const effectiveRadius = card.radius_km + accuracyBuffer

  return distance <= effectiveRadius
    ? result(true,  'IN_RADIUS',      distance)
    : result(false, 'OUTSIDE_RADIUS', distance)
}

export function computeRiskScore({ blockRate, falsePositiveRate, recentOutsideRadius, hasLockedDown }) {
  let score = 0
  score += blockRate * 0.4
  score += (1 - falsePositiveRate) * 0.2
  score += Math.min(recentOutsideRadius / 20, 1) * 0.3
  score += hasLockedDown ? 0.1 : 0
  return Math.min(Math.round(score * 100) / 100, 1.0)
}
