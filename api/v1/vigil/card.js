// api/v1/vigil/card.js — GET/POST/PUT /v1/vigil/card
// Card registration and management.
// GET ?card_id= — get card profile
// POST — register a new card
// PUT — update card settings (mode, radius, travel plans)
import { authenticate, buildUsageBlock, trackRequest } from '../../../lib/api-auth.js'
import { logError } from '../../../lib/logger.js'
import {
  AUTH_TIERS, setCors, parseBody, getCardData, saveCardData,
} from '../../../lib/vigil-helpers.js'

export default async function handler(req, res) {
  setCors(res, 'GET, POST, PUT, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  if (!AUTH_TIERS.includes(auth.keyData?.tier)) {
    return res.status(403).json({
      success: false,
      error: { code: 'TIER_REQUIRED', message: 'Card management requires Starter plan or above', hint: 'Upgrade at ebenova.dev/pricing' },
    })
  }

  await trackRequest(auth, req)

  // ── GET: Retrieve card profile ──
  if (req.method === 'GET') {
    const cardId = req.query?.card_id
    if (!cardId) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'Required query param: card_id' } })

    try {
      const card = await getCardData(auth, cardId)
      if (!card) return res.status(404).json({ success: false, error: { code: 'CARD_NOT_FOUND', message: 'Card not registered. POST to /v1/vigil/card to register.' } })
      return res.status(200).json({ success: true, card, _usage: buildUsageBlock(auth) })
    } catch (err) {
      logError('vigil/card GET', err)
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve card data.' } })
    }
  }

  // ── POST: Register new card ──
  if (req.method === 'POST') {
    const body = await parseBody(req)
    if (!body.card_id) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'Required: card_id' } })

    try {
      const existing = await getCardData(auth, body.card_id)
      if (existing) return res.status(409).json({ success: false, error: { code: 'CARD_EXISTS', message: 'Card already registered. Use PUT to update.' } })

      const card = {
        card_id: body.card_id,
        is_active: body.is_active !== false,
        mode: body.mode || 'normal',
        radius_km: body.radius_km || 25,
        home_lat: body.home_lat || null,
        home_lng: body.home_lng || null,
        home_country: body.home_country || null,
        travel_plans: body.travel_plans || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await saveCardData(auth, body.card_id, card)
      return res.status(201).json({ success: true, card, _usage: buildUsageBlock(auth) })
    } catch (err) {
      logError('vigil/card POST', err)
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to register card.' } })
    }
  }

  // ── PUT: Update card settings ──
  if (req.method === 'PUT') {
    const body = await parseBody(req)
    if (!body.card_id) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'Required: card_id' } })

    try {
      const card = await getCardData(auth, body.card_id)
      if (!card) return res.status(404).json({ success: false, error: { code: 'CARD_NOT_FOUND', message: 'Card not registered.' } })

      // Update allowed fields
      if (body.mode !== undefined) card.mode = body.mode
      if (body.is_active !== undefined) card.is_active = body.is_active
      if (body.radius_km !== undefined) card.radius_km = body.radius_km
      if (body.home_lat !== undefined) card.home_lat = body.home_lat
      if (body.home_lng !== undefined) card.home_lng = body.home_lng
      if (body.home_country !== undefined) card.home_country = body.home_country
      if (body.travel_plans !== undefined) card.travel_plans = body.travel_plans
      card.updated_at = new Date().toISOString()

      await saveCardData(auth, body.card_id, card)
      return res.status(200).json({ success: true, card, _usage: buildUsageBlock(auth) })
    } catch (err) {
      logError('vigil/card PUT', err)
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update card.' } })
    }
  }

  return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })
}
