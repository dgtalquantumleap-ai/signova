# Signova: Stripe Direct Migration Guide

## Why This Migration?

Polar (and other MoR platforms like Paddle, LemonSqueezy) rejected Signova because they classify legal document generation as a "regulated service." With Stripe Direct, **you** are the merchant — Stripe just processes payments. They're more permissive for document generation tools.

---

## What's Been Created

Two new API endpoints have been added:
- `/api/stripe-checkout.js` — Creates Stripe Checkout sessions
- `/api/stripe-verify.js` — Verifies payment completion server-side

Preview.jsx has been updated to use Stripe instead of Polar.

---

## Steps to Complete Migration

### 1. Create Stripe Account (if you don't have one)
Go to: https://dashboard.stripe.com/register

### 2. Get Your API Keys
Go to: https://dashboard.stripe.com/apikeys
- Copy your **Secret key** (starts with `sk_live_` for production)
- Copy your **Publishable key** (starts with `pk_live_` for production)

### 3. Set Vercel Environment Variables
Run these commands or add via Vercel Dashboard:

```bash
cd C:\projects\signova
vercel env add STRIPE_SECRET_KEY
# Paste: sk_live_xxx... (or sk_test_xxx for testing first)
```

### 4. Install Dependencies & Deploy

```bash
cd C:\projects\signova
npm install
git add .
git commit -m "feat: migrate from Polar to Stripe Direct payments"
vercel --prod
```

### 5. Test the Flow
1. Go to getsignova.com
2. Generate a document
3. Click "Unlock Full Document"
4. Complete Stripe Checkout
5. Verify document unlocks

### 6. Remove Old Polar Files (Optional, after testing)
Once Stripe is working, you can delete:
- `api/checkout.js` (old Polar checkout)
- `api/verify-payment.js` (old Polar verification)

Remove these Vercel env vars:
- `POLAR_ACCESS_TOKEN`
- `POLAR_PRODUCT_ID`

---

## Key Differences: Polar vs Stripe Direct

| Aspect | Polar (MoR) | Stripe Direct |
|--------|-------------|---------------|
| Who is merchant? | Polar | You (Ebenova) |
| Tax handling | Polar handles | You handle (or use Stripe Tax) |
| Fees | ~5% + $0.50 | ~2.9% + $0.30 |
| Refunds | Polar manages | You manage |
| Chargebacks | Polar absorbs | You absorb |
| Invoice shows | Polar | Signova/Ebenova |

---

## Tax Considerations

With Stripe Direct, you may need to handle sales tax/VAT yourself:
- **Option 1**: Enable [Stripe Tax](https://stripe.com/tax) (automatic calculation + filing)
- **Option 2**: Use a service like TaxJar or Avalara
- **Option 3**: Include tax in price (simpler for now, works for most digital products)

For a $4.99 digital product with global customers, many solo founders just include tax in the price and keep it simple until revenue grows.

---

## OxaPay Crypto Still Works

Your OxaPay (USDT) payment option is completely separate and continues to work as-is. Nigerian users will still see crypto first, international users will see card first.

---

## Need Help?

If you hit issues during migration, the key files are:
- `C:\projects\signova\api\stripe-checkout.js`
- `C:\projects\signova\api\stripe-verify.js`
- `C:\projects\signova\src\pages\Preview.jsx`
