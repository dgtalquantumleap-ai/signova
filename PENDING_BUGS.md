# Pending bugs / follow-ups

Items spotted while landing on a different scope. Each entry: where, what,
why-deferred.

## 1. `WhatsApp.jsx` still uses pre-tier `formatPrice(currency)` system

- Files: `src/pages/WhatsApp.jsx` lines 387, 507 (and the `formatPrice`/
  `CURRENCY_MAP` helpers at lines 15-29, 237-252)
- What: same 49-row local-currency display pattern that Landing.jsx + Preview.jsx
  used to have. Was retired from those pages in PR #28 (landing conversion +
  tiered pricing) because it created a bait-and-switch risk between displayed
  local currency and actual Stripe USD charge.
- Why deferred: PR #28 brief explicitly scoped to Landing.jsx, Preview.jsx,
  Pricing.jsx. Wholesale rewrite of WhatsApp.jsx currency state is a separate
  PR — needs its own pricing state, fallback, paystackAvailable gate, and
  removal of `formatPrice`/`CURRENCY_MAP` reads.
- Action: replicate the Landing.jsx pattern (`fetchUserPricing()` + retire the
  local-currency map + display `pricing.display` only).

## 2. Blog post body content still mentions `$4.99` in some places

- File: `src/data/blogPosts.js`
- What: prior PRs left literal `$4.99` references inside blog body content
  (the prominent CTAs at lines 163/200/237/270/1509 were fixed in PR #28).
- Why deferred: blog body rewriting is a content-edit PR, not a code-edit
  PR. Each occurrence needs an editorial decision (mention the price at all?
  reference a tier? link to pricing page?) rather than a mechanical
  find-replace.
- Action: separate content-rewrite PR with a single guideline: blog content
  should not name a USD price; link to a pricing anchor instead.

## 3. Quick-pick ordering audit for non-US regions vs new positioning

- File: `src/pages/Landing.jsx` lines ~172-230 (`QUICKPICK_REGIONS`)
- What: PR #28 reordered `QUICKPICK_REGIONS.US` (and the 10 western
  countries aliased to it: CA/GB/AU/NZ/DE/FR/IT/ES/NL/PT) so the hero's
  `.slice(0,3)` shows Freelance Contract / NDA / Service Agreement —
  which fits the new "Don't start the work until this is signed"
  pre-flight-checklist framing.
- Other regional sets were NOT audited:
  - `NG` (also covers GH/KE/ZA/TZ/UG/ET/SN/CI/CM/EG/ZW): currently leads
    with Founders' Agreement / Tenancy Agreement / Deed of Assignment.
    For the new positioning, freelancer-deal docs (Freelance Contract,
    Service Agreement) might convert better.
  - `IN` (also PK/BD/PH/ID/MY/SG): currently NDA / Freelance Contract /
    Service Agreement — already aligns with new positioning, no change
    expected.
  - `AE` (also SA): MOU / Partnership / NDA — sales-focused; might be
    fine, might not.
  - `BR` (also MX/CO/AR): Freelance Contract / Service Agreement / NDA
    — already aligned.
  - `QUICKPICK_DEFAULT`: Business Proposal / NDA / Freelance Contract.
    "Business Proposal" is the odd one out for the pre-flight framing.
- Why deferred: PR #28 was scoped to the obvious mismatch (US-aliased
  visitors paying $14.99 seeing a SaaS-startup trio). Wider quick-pick
  rework deserves its own PR with a/b consideration per region.
- Action: separate UX PR — audit each region's top-3 against the
  pre-flight-checklist framing, possibly drive ordering off real
  conversion data.

## 4. AboutPage.jsx replaced `$4.99` with "small fixed fee"

- File: `src/pages/AboutPage.jsx` line 62
- What: PR #28 replaced "pay $4.99" with "pay a small fixed fee" to avoid
  the bait-and-switch with western/emerging-tier visitors. The page does
  not currently call `fetchUserPricing()`.
- Why deferred: AboutPage is informational; introducing pricing state for
  a single sentence is over-engineering.
- Action: revisit only if the marketing copy benefits from a concrete number.
  If so, wire `fetchUserPricing()` and use `pricing.display`.
