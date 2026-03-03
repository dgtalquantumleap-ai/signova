# Signova — Lemon Squeezy Setup Guide

Lemon Squeezy replaces Stripe as the payment processor. The checkout API is 
already coded in api/checkout.js. You just need to create the product and 
add 3 environment variables to Vercel.

---

## STEP 1 — Wait for store approval

You've submitted the business details form. Lemon Squeezy typically approves 
within 1-3 business days. You'll get an email confirmation.

---

## STEP 2 — Create the $4.99 product

Once approved:

1. Go to app.lemonsqueezy.com → Products → New Product
2. Fill in:
   - Name: Signova Document Download
   - Description: Professional AI-generated legal document — clean PDF, no watermark
   - Type: Single payment (not subscription)
   - Price: $4.99 USD
3. Under "Variants" — there will be one variant auto-created. Note the variant ID 
   (visible in the URL when you click on it, or in the variant settings)
4. Click Save / Publish

---

## STEP 3 — Get your 3 IDs

**API Key:**
1. app.lemonsqueezy.com → Settings → API
2. Click "Create API key"
3. Name it "Signova Production"
4. Copy the key — you only see it once

**Store ID:**
1. app.lemonsqueezy.com → Settings → Stores
2. Click your store
3. The ID is in the URL: app.lemonsqueezy.com/stores/YOUR_STORE_ID/...
4. Or shown on the store settings page directly

**Variant ID:**
1. app.lemonsqueezy.com → Products → Signova Document Download
2. Click on the variant (usually called "Default")
3. The ID is in the URL or shown in variant settings

---

## STEP 4 — Add to Vercel

1. Go to vercel.com → your Signova project → Settings → Environment Variables
2. Add these 3 variables (in addition to ANTHROPIC_API_KEY already there):

   | Variable | Value |
   |---|---|
   | LEMONSQUEEZY_API_KEY | your API key from Step 3 |
   | LEMONSQUEEZY_STORE_ID | your store ID from Step 3 |
   | LEMONSQUEEZY_VARIANT_ID | your variant ID from Step 3 |

3. Make sure Environment is set to "Production" (and Preview if you want)
4. Click Save

---

## STEP 5 — Redeploy

After adding the env vars, trigger a redeploy so the new variables take effect:

Option A — Push any small change to git (even a comment change)
Option B — In Vercel dashboard → Deployments → click the 3 dots on latest → Redeploy

---

## STEP 6 — Test the full flow

1. Go to getsignova.com
2. Click any document type
3. Fill in the form and click Generate
4. On the preview page, click "Pay $4.99 & Download"
5. You should be redirected to a Lemon Squeezy hosted checkout page
6. Use Lemon Squeezy's test card: 4242 4242 4242 4242, any future date, any CVC
7. After payment, you should be redirected back to /preview?payment=success
8. The watermark should disappear and the download button should appear

---

## STEP 7 — Set up webhook (optional but recommended)

Webhooks let Lemon Squeezy notify your server when a payment completes, 
which is more reliable than relying on the redirect URL.

1. app.lemonsqueezy.com → Settings → Webhooks → Add webhook
2. URL: https://getsignova.com/api/webhook
3. Events: order_created
4. Copy the signing secret

Then add to Vercel env vars:
   LEMONSQUEEZY_WEBHOOK_SECRET = your signing secret

Note: The webhook endpoint (api/webhook.js) is not yet built — 
the redirect URL approach works fine for MVP. Add webhook in Phase 2.

---

## HOW THE CHECKOUT FLOW WORKS (technical summary)

1. User clicks "Pay $4.99" on /preview
2. Browser POSTs to /api/checkout with { docType, docName }
3. api/checkout.js calls Lemon Squeezy API to create a checkout session
4. Lemon Squeezy returns a hosted checkout URL
5. Browser redirects to that URL (Lemon Squeezy hosted page)
6. User completes payment on Lemon Squeezy's page
7. Lemon Squeezy redirects back to /preview?payment=success
8. Preview.jsx detects ?payment=success → sets paid=true → removes watermark

---

## PRICING REFERENCE

| Plan | Lemon Squeezy fee | You receive |
|---|---|---|
| $4.99 one-time | ~5% + $0.50 = ~$0.75 | ~$4.24 per sale |
| $9.99/month (Phase 2) | ~5% + $0.50 = ~$1.00 | ~$8.99 per subscriber/month |

At 100 sales/month: ~$424 revenue, ~$3 Claude API costs = ~$421 profit
At 500 sales/month: ~$2,120 revenue, ~$15 Claude API costs = ~$2,105 profit

---

## STATUS: Waiting for Lemon Squeezy store approval.
## All code is ready. Just needs the 3 env vars added to Vercel.
