# Pending bugs / follow-ups

Items spotted while landing on a different scope. Each entry: where, what,
why-deferred.

All items from the initial 2026-04-21 list are now resolved. Log kept so
that future entries have a template + historical context for the fixes.

## ~~1. `WhatsApp.jsx` still uses pre-tier `formatPrice(currency)` system~~ DONE

Resolved in PR #30 (the catch-up PR after PRs #28/#29 stranded). Single
`fetchUserPricing()` call now drives both `pricing.display` and the
`countryCode` used by `GEO_DOC_PRIORITY` / `GEO_USECASES`. The local
`CURRENCY_MAP` / `getCurrency` / `formatPrice` helpers were deleted (no
`_RETAINED` constant — they were trivially recoverable from git history
and not consumed elsewhere).

## ~~2. Blog post body content still mentions `$4.99` in some places~~ DONE

Resolved in PR #31. All 45 `$4.99` references and the localised
`AMOUNT (≈ $4.99)` parentheticals were scrubbed from
`src/data/blogPosts.js`. The CTAs now use generic phrasing
("Preview free. Pay when you download.") so the page copy doesn't
drift when tier pricing changes. Blog body text in general-knowledge
sections ("courts in many jurisdictions...") was left alone — it's
factual commentary, not Signova marketing copy.

## ~~3. Quick-pick ordering audit for non-US regions vs new positioning~~ DONE

Resolved in PR #31. All `QUICKPICK_REGIONS` top-3 slots now lead with
pre-flight-checklist primitives:

- `QUICKPICK_DEFAULT`: Freelance Contract / NDA / Service Agreement
  (was Business Proposal / NDA / Freelance Contract).
- `NG` (aliased by GH/KE/ZA/TZ/UG/ET/SN/CI/CM/EG/ZW): Freelance
  Contract / Tenancy Agreement / Loan Agreement (was Founders' /
  Tenancy / Deed of Assignment).
- `AE` (aliased by SA): Service Agreement / NDA / MOU (was MOU /
  Partnership / NDA).
- `US` (aliased by CA/GB/AU/NZ/DE/FR/IT/ES/NL/PT): Freelance Contract /
  NDA / Service Agreement (already done in PR #30 catch-up).
- `IN` (aliased by PK/BD/PH/ID/MY/SG): already aligned — NDA /
  Freelance Contract / Service Agreement. Left alone.
- `BR` (aliased by MX/CO/AR): already aligned — Freelance Contract /
  Service Agreement / NDA. Left alone.

If a/b testing reveals a different optimal order for any region, adjust
the relevant array in `src/pages/Landing.jsx` — the data is colocated
with an explanatory comment at each reorder site.

## ~~4. AboutPage.jsx replaced `$4.99` with "small fixed fee"~~ DONE

Resolved in PR #31. `src/pages/AboutPage.jsx` now calls
`fetchUserPricing()` and shows the tier-accurate price in the founder
story paragraph. Nigerian visitors additionally see the Paystack NGN
option — matching the compound-display convention used on Landing.jsx
and Preview.jsx.
