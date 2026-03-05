# Signova — Polar Setup Guide

Polar replaces Lemon Squeezy as the payment processor.
Polar is a Merchant of Record — they handle all taxes (VAT, GST, Sales Tax) globally.
Accepts payments from customers worldwide including Africa.
Fee: 4% + $0.40 per transaction (~$4.39 you keep on each $4.99 sale).

---

## STEP 1 — Create your Polar account

1. Go to polar.sh and sign up
2. Connect your GitHub account (required)
3. Complete onboarding — connect your bank account for payouts
   - You're in Canada, so Stripe Connect Express will handle payouts to your Canadian bank

---

## STEP 2 — Create the $4.99 product

1. In your Polar dashboard → Products → New Product
2. Fill in:
   - Name: Signova Document Download
   - Description: Professional AI-generated legal document — clean PDF, no watermark
   - Type: One-time purchase
   - Price: $4.99 USD
3. Save and publish it
4. Click on the product — copy the **Product ID** from the URL or product settings
   (it looks like: prod_xxxxxxxxxxxxxxxx)

---

## STEP 3 — Get your Access Token

1. polar.sh → Settings → API → New Token
2. Name it: Signova Production
3. Set scope to: Full access (or at minimum: checkouts:write)
4. Copy the token — you only see it once

---

## STEP 4 — Add to Vercel

Go to vercel.com → Signova project → Settings → Environment Variables.
Add these 2 variables:

| Variable            | Value                          |
|---------------------|--------------------------------|
| POLAR_ACCESS_TOKEN  | your API token from Step 3     |
| POLAR_PRODUCT_ID    | your product ID from Step 2    |

Make sure Environment is set to "Production" (and Preview if you want).
Click Save.

---

## STEP 5 — Redeploy

After adding env vars, trigger a redeploy:
- Option A: Push any small change to git
- Option B: Vercel dashboard → Deployments → 3 dots → Redeploy

---

## STEP 6 — Test the full flow

1. Go to getsignova.com
2. Pick a document, fill the form, click Generate
3. On the preview page, click "Pay $4.99 & Download"
4. You should be redirected to a Polar hosted checkout page
5. Complete payment with a test card: 4242 4242 4242 4242, any future date, any CVC
6. After payment, redirected back to /preview?payment=success
7. Watermark disappears, download button appears ✅

---

## HOW IT WORKS (technical)

1. User clicks "Pay $4.99" on /preview
2. Browser POSTs to /api/checkout with { docType, docName }
3. api/checkout.js calls Polar API to create a checkout session
4. Polar returns a hosted checkout URL
5. Browser redirects to Polar's checkout page
6. User pays — Polar handles tax calculation automatically
7. Polar redirects back to /preview?payment=success
8. Preview.jsx detects ?payment=success → removes watermark → enables download

---

## PRICING BREAKDOWN

| Plan              | Polar fee          | You receive      |
|-------------------|--------------------|------------------|
| $4.99 one-time    | 4% + $0.40 = $0.60 | ~$4.39 per sale  |
| $9.99/mo (Phase 2)| 4% + $0.40 = $0.80 | ~$9.19/subscriber|

At 100 sales/month: ~$439 revenue, ~$3 Claude API = ~$436 profit
At 500 sales/month: ~$2,195 revenue, ~$15 Claude API = ~$2,180 profit

---

## STATUS: Code is ready. Just needs 2 env vars added to Vercel.
