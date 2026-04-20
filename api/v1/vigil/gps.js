// api/v1/vigil/gps.js — POST /v1/vigil/gps
// Submit GPS location data for a card (from mobile SDK / device).
// This powers the proximity-based authorization decisions.
import { authenticate, buildUsageBlock, trackRequest } from '../../../lib/api-auth.js'
import { logError } from '../../../lib/logger.js'
import {
  AUTH_TIERS, setCors, parseBody, getCardData, saveGpsData,
} from '../../../lib/vigil-helpers.js'

export default async function handler(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  if (!AUTH_TIERS.includes(auth.keyData?.tier)) {
    return res.status(403).json({
      success: false,
      error: { code: 'TIER_REQUIRED', message: 'GPS submission requires Starter plan or above' },
    })
  }

  const body = await parseBody(req)
  const required = ['card_id', 'lat', 'lng']
  for (const f of required) {
    if (body[f] === undefined || body[f] === null) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: `Required: ${f}` } })
    }
  }

  // Validate coordinates
  if (typeof body.lat !== 'number' || body.lat < -90 || body.lat > 90) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_FIELD', message: 'lat must be a number between -90 and 90' } })
  }
  if (typeof body.lng !== 'number' || body.lng < -180 || body.lng > 180) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_FIELD', message: 'lng must be a number between -180 and 180' } })
  }

  await trackRequest(auth, req)

  try {
    // Verify card exists
    const card = await getCardData(auth, body.card_id)
    if (!card) {
      return res.status(404).json({
        success: false,
        error: { code: 'CARD_NOT_FOUND', message: 'Card not registered. POST to /v1/vigil/card first.' },
      })
    }

    const gpsData = {
      lat: body.lat,
      lng: body.lng,
      accuracy_meters: body.accuracy_meters || 0,
      altitude: body.altitude || null,
      speed: body.speed || null,
      heading: body.heading || null,
      is_mock_location: body.is_mock_location || false,
      is_jailbroken: body.is_jailbroken || false,
      device_id: body.device_id || null,
    }

    await saveGpsData(auth, body.card_id, gpsData)

    return res.status(200).json({
      success: true,
      gps: {
        card_id: body.card_id,
        recorded_at: new Date().toISOString(),
        lat: gpsData.lat,
        lng: gpsData.lng,
        accuracy_meters: gpsData.accuracy_meters,
        expires_in_seconds: 3600,
      },
      _usage: buildUsageBlock(auth),
    })
  } catch (err) {
    logError('vigil/gps', err)
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to save GPS data.' },
    })
  }
}
