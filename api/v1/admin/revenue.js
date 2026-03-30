// api/v1/admin/revenue.js
// GET /v1/admin/revenue
// Returns revenue metrics (requires admin API key with stripe module access)
// This is an admin endpoint — you may want to add authentication

import Stripe from 'stripe'
import { getRedis } from '../../../lib/redis.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })
  }

  // Admin token validation — always required
  const adminToken = process.env.ADMIN_API_TOKEN
  if (!adminToken) {
    console.error('[API ERROR] ADMIN_API_TOKEN env var not configured')
    return res.status(500).json({ success: false, error: { code: 'SERVER_MISCONFIGURED', message: 'Admin API not configured' } })
  }
  
  const authHeader = req.headers.authorization || ''
  if (!authHeader.includes(adminToken)) {
    return res.status(403).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid admin token' } })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return res.status(500).json({ success: false, error: { code: 'STRIPE_NOT_CONFIGURED' } })
  }

  try {
    const stripe = new Stripe(stripeKey)
    const redis = getRedis()

    // Fetch all subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({ limit: 100 })
    
    let totalMRR = 0
    let activeSubscriptions = 0
    let churnedSubscriptions = 0
    const subscriptionsByTier = { starter: 0, growth: 0, scale: 0 }

    // Map price IDs to tiers
    const priceIdToTier = {
      [process.env.STRIPE_PRICE_STARTER]: 'starter',
      [process.env.STRIPE_PRICE_GROWTH]: 'growth',
      [process.env.STRIPE_PRICE_SCALE]: 'scale',
    }

    for (const sub of subscriptions.data) {
      const item = sub.items.data[0]
      if (!item) continue

      const tier = priceIdToTier[item.price.id]
      const amount = item.price.unit_amount / 100 // Convert cents to dollars

      if (sub.status === 'active') {
        activeSubscriptions++
        totalMRR += amount
        if (tier) subscriptionsByTier[tier]++
      } else if (sub.status === 'canceled') {
        churnedSubscriptions++
      }
    }

    // Calculate historical data
    const invoices = await stripe.invoices.list({ limit: 100 })
    let totalRevenue = 0
    const monthlyRevenue = {}

    for (const invoice of invoices.data) {
      if (invoice.amount_paid > 0) {
        totalRevenue += invoice.amount_paid / 100
        
        // Group by month
        const date = new Date(invoice.created * 1000)
        const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (invoice.amount_paid / 100)
      }
    }

    // Fetch API usage metrics from Redis (count total keys)
    const keys = await redis.keys('key:sk_live_*')
    const totalAPIKeys = keys.length

    // Calculate churn rate
    const churnRate = activeSubscriptions > 0 
      ? ((churnedSubscriptions / (activeSubscriptions + churnedSubscriptions)) * 100).toFixed(2)
      : 0

    return res.status(200).json({
      success: true,
      metrics: {
        mrrUsd: totalMRR.toFixed(2),
        activeSubscriptions,
        churnedSubscriptions,
        churnRatePercent: parseFloat(churnRate),
        totalRevenueUsd: totalRevenue.toFixed(2),
        averageContractValueUsd: (totalRevenue / (activeSubscriptions || 1)).toFixed(2),
      },
      subscriptionsByTier,
      monthlyRevenue: Object.keys(monthlyRevenue).sort().map(month => ({
        month,
        revenueUsd: monthlyRevenue[month].toFixed(2),
      })),
      apiMetrics: {
        totalActiveKeys: totalAPIKeys,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[admin/revenue] error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'QUERY_FAILED', message: err.message } })
  }
}
