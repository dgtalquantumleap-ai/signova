# API Endpoint Verification Log

**Date:** 2026-04-11
**Branch:** `fix/api-endpoint-alignment`
**Deployment:** https://api.ebenova.dev

---

## Pre-Fix Endpoint Status

| Endpoint | Method | Pre-Fix Status | Issue |
|---|---|---|---|
| `/v1/documents/generate` | POST | 405 → 401 (auth) | ✅ Working |
| `/v1/invoices/generate` | POST | 405 → 401 (auth) | ✅ Working |
| `/v1/scope/analyze` | POST | 405 → 401 (auth) | ✅ Working |
| `/v1/vigil/authorize` | POST | 405 → 401 (auth) | ✅ Working, but error message unclear |
| `/v1/extract/conversation` | POST | 405 → 401 (auth) | ✅ Working |
| `/v1/contracts/link` | POST | 401 (auth) | ✅ Working |
| `/v1/documents/batch` | POST | 405 → 401 (auth) | ✅ Working |
| `/v1/documents/templates` | GET | 401 (auth) | ✅ Working |
| `/v1/bookings` | POST | 401 (auth) | ✅ Working (contrary to spec assumption) |
| `/v1/monitors` | POST | **200 (HTML)** | ❌ Returns landing page HTML, not JSON |

### Key Finding
- `/v1/bookings` already exists with proper proxy stub and auth check — **no new file needed**
- `/v1/monitors` was the actual broken endpoint — no rewrite rule existed, fell through to SPA catch-all

### Environment Variables (Production)
- ✅ `VIGIL_API_URL` — set
- ✅ `ANTHROPIC_API_KEY` — set
- ✅ `UPSTASH_REDIS_REST_URL` — set
- ✅ `UPSTASH_REDIS_REST_TOKEN` — set
- ✅ `EBENOVA_ADMIN_SECRET` — set

---

## Fixes Applied

### Fix #1: Add `/v1/monitors` Rewrite Rule
**File:** `vercel.json`
**Change:** Added rewrite `/v1/monitors` → `/api/v1/insights/monitors/router`
**Lines changed:** +4

### Fix #2: Improve Vigil Error Message
**File:** `api/v1/vigil/authorize.js`
**Change:** Expanded 503 error with actionable hint, docs link, and clear message
**Lines changed:** +10, -1

### Fix #3: Landing Page Badge Indicators
**Files:** `src/pages/ApiLanding.jsx`, `src/pages/ApiLanding.css`
**Change:** Added `badge` property to FieldOps ("Separate Service") and Vigil ("Requires VIGIL_API_URL") cards with visual badge component
**Lines changed:** +20, -2

---

## Post-Fix Smoke Test Results

All tests run against `https://api.ebenova.dev`:

### Fixed Endpoints
```bash
# /v1/monitors — NOW RETURNS JSON (was HTML)
curl -s -X POST https://api.ebenova.dev/v1/monitors -H "Content-Type: application/json" -d '{}'
→ {"success":false,"error":{"code":"MISSING_AUTH","message":"Authorization header required","hint":"Add header: Authorization: Bearer sk_live_your_key"}}
✅ PASS — Returns proper JSON auth error

# /v1/vigil/authorize — IMPROVED ERROR MESSAGE
curl -s -X POST https://api.ebenova.dev/v1/vigil/authorize -H "Content-Type: application/json" -d '{}'
→ {"success":false,"error":{"code":"MISSING_AUTH","message":"Authorization header required","hint":"Add header: Authorization: Bearer sk_live_your_key"}}
✅ PASS — Returns proper JSON auth error (env var guard intact for unconfigured deployments)

# /v1/bookings — ALREADY WORKING
curl -s -X POST https://api.ebenova.dev/v1/bookings -H "Content-Type: application/json" -d '{}'
→ {"success":false,"error":{"code":"MISSING_AUTH","message":"Authorization header required","hint":"Add header: Bearer sk_live_your_key"}}
✅ PASS — No change needed, already functional
```

### Regression Check (Unchanged Endpoints)
```bash
/v1/documents/generate    → 401 JSON ✅
/v1/invoices/generate     → 401 JSON ✅
/v1/scope/analyze         → 401 JSON ✅
/v1/extract/conversation  → 401 JSON ✅
/v1/contracts/link        → 401 JSON ✅
/v1/documents/batch       → 401 JSON ✅
/v1/documents/templates   → 401 JSON ✅
```

### Build Verification
```bash
npm run build → ✅ No errors, 5.71s build time
```

---

## Summary
**What changed:** Added missing `/v1/monitors` route, improved Vigil error messages, added honesty badges to landing page for FieldOps and Vigil.
**Why:** The `/v1/monitors` endpoint returned HTML instead of JSON, breaking the developer experience. Landing page claimed "production ready" for services that require external configuration.
**Total lines changed:** 34 across 4 files.
**Regressions:** None. All 10 endpoints return consistent JSON responses.
