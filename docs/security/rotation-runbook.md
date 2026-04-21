# Credential Rotation Runbook

**Scope:** Ebenova / Signova production secrets — admin secret, API keys
(owner key, proxy key, customer keys).

**Audience:** Olumide (owner) or a future maintainer with Vercel dashboard
access + Upstash Redis REST credentials + (for proxy-key rotations only)
api.market portal login.

**When to use:** on credential leak, annual hygiene cycle, offboarding, or
when a key exceeds its useful life.

---

## Rotation order (when rotating multiple at once)

Always rotate in this order:

1. **Customer / owner `sk_live_*` keys** first — lowest blast radius, can be
   done live with no downstream portal changes (unless the key is wired into
   a third-party integration like api.market).
2. **`EBENOVA_ADMIN_SECRET`** second — because the admin endpoint is how you
   mint replacement customer keys. Rotate it *after* you've finished minting
   new customer keys; otherwise you lose the ability to mint mid-rotation.
3. **API Market proxy key** last, and only after:
   - Any in-flight api.market listing review has finished (rotating mid-review
     looks like a broken listing and delays approval).
   - You are logged into the api.market portal and ready to update Custom
     Headers immediately after minting.

---

## Pre-flight checklist (all rotations)

- [ ] You have the **current** `EBENOVA_ADMIN_SECRET` in hand (Vercel
      dashboard → Signova project → Settings → Environment Variables, or
      `vercel env pull .env.vercel` if the CLI is installed).
- [ ] You have **Upstash Redis REST URL + token** in hand (same place;
      vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
- [ ] You have a password manager (1Password / Bitwarden / similar) open,
      ready to receive the new secret. *Do not* paste new secrets into chat,
      email, or shared docs.
- [ ] For proxy-key rotation only: api.market portal logged in, on the
      Ebenova listing → Custom Headers page.

---

## Runbook 1 — Rotate a customer or owner `sk_live_*` key

Use for: personal owner key `sk_live_6aedfa59…`, any customer key where the
value has leaked.

### Step 1 — Mint the replacement

```bash
# Export the current admin secret — one-shot, do not persist in shell history.
# Prefix the command with a space if your shell has HISTCONTROL=ignorespace.
 ADMIN="<paste current EBENOVA_ADMIN_SECRET>"

curl -sS -X POST https://api.ebenova.dev/v1/keys/create \
  -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "olumide@ebenova.dev",
    "tier": "enterprise",
    "label": "Personal owner key (rotated YYYY-MM-DD)",
    "env": "live"
  }'

# Response:
# {
#   "success": true,
#   "api_key": "sk_live_<new 48-hex value>",
#   "owner": "olumide@ebenova.dev",
#   "tier": "enterprise",
#   "monthly_limit": 99999,
#   "note": "Store this key securely — it cannot be retrieved again."
# }
```

**Copy the new `api_key` value into your password manager immediately.** The
Redis store keeps the hash-addressable value but there is no "retrieve"
endpoint.

### Step 2 — Verify the new key works

```bash
NEW_KEY="<paste new sk_live_ from step 1>"

curl -sS https://api.ebenova.dev/v1/keys/usage \
  -H "Authorization: Bearer $NEW_KEY" | head -c 300
# Expect: {"success":true,"usage":{...}}
```

### Step 3 — Disable the old key

Two options. Prefer (a) for an audit trail, (b) only if you're certain no
support case will need to reference the historical record.

**Option (a) — mark disabled (soft-delete, auditable):**

```bash
OLD_KEY="sk_live_<old value being retired>"
UPSTASH_URL="<paste UPSTASH_REDIS_REST_URL>"
UPSTASH_TOK="<paste UPSTASH_REDIS_REST_TOKEN>"

# Fetch current record
CURRENT=$(curl -sS "$UPSTASH_URL/get/apikey:$OLD_KEY" \
  -H "Authorization: Bearer $UPSTASH_TOK" | python -c "import sys,json;print(json.load(sys.stdin)['result'])")

# Patch disabled=true (jq preserves other fields)
PATCHED=$(echo "$CURRENT" | python -c "import sys,json;d=json.loads(sys.stdin.read());d['disabled']=True;d['disabledAt']='$(date -u +%Y-%m-%dT%H:%M:%SZ)';d['disabledReason']='rotated';print(json.dumps(d))")

# Write back (URL-encode because SET takes the value in the path)
curl -sS -X POST "$UPSTASH_URL/set/apikey:$OLD_KEY" \
  -H "Authorization: Bearer $UPSTASH_TOK" \
  -H "Content-Type: application/json" \
  -d "{\"value\":$PATCHED}"
```

**Option (b) — hard delete:**

```bash
curl -sS -X POST "$UPSTASH_URL/del/apikey:$OLD_KEY" \
  -H "Authorization: Bearer $UPSTASH_TOK"
```

### Step 4 — Confirm old key is dead

```bash
curl -sS https://api.ebenova.dev/v1/keys/usage \
  -H "Authorization: Bearer $OLD_KEY"
# Expect: 403 with {"error":{"code":"KEY_DISABLED",...}}
# or:     401 with {"error":{"code":"INVALID_API_KEY",...}}
```

### Step 5 — Update anywhere the old key was consumed

Grep your local clones, any server-side .env files, any MCP client configs:

```bash
grep -r "sk_live_<first 12 chars of old key>" ~/.claude/ ~/.config/ ~/projects/ 2>/dev/null
```

For the personal owner key specifically, check:

- [ ] Your local `.env` / `.env.vercel` files
- [ ] MCP client configs (Claude Desktop, Smithery, etc.) that name an
      `EBENOVA_API_KEY` env var
- [ ] Any Postman / Insomnia / API client collections
- [ ] Any iOS/Android shortcuts or third-party integrations

### Step 6 — Clean up shell state

```bash
unset ADMIN NEW_KEY OLD_KEY UPSTASH_URL UPSTASH_TOK CURRENT PATCHED
history -c  # bash — clears current-session history
# Or for zsh: history -p
```

---

## Runbook 2 — Rotate `EBENOVA_ADMIN_SECRET`

This is a plain Vercel env var, not stored in Redis. Rotation = generate new
value, update Vercel env, redeploy. **Do this after runbook 1 has minted any
replacement customer keys you need** — once the admin secret is rotated,
no new keys can be minted until Vercel redeploys with the new value.

### Step 1 — Generate new secret

```bash
# 48 hex chars of cryptographic randomness — matches existing format
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Copy the output to your password manager. Do not paste into chat.

### Step 2 — Update Vercel env

Via dashboard (no CLI required):

1. https://vercel.com/ → signova project → **Settings** → **Environment
   Variables**.
2. Find `EBENOVA_ADMIN_SECRET`. Click the **⋯** → **Edit**.
3. Replace the value with the new secret. Make sure
   **Production + Preview + Development** are all ticked.
4. Save.

Via CLI (if you install `npm i -g vercel` first):

```bash
cd C:/projects/signova
vercel link                                       # one-time, choose signova
vercel env rm  EBENOVA_ADMIN_SECRET production
vercel env add EBENOVA_ADMIN_SECRET production    # paste new value at prompt
vercel env rm  EBENOVA_ADMIN_SECRET preview
vercel env add EBENOVA_ADMIN_SECRET preview
```

### Step 3 — Redeploy production

Dashboard: **Deployments** → latest production deploy → **⋯** → **Redeploy**
(check "Use existing Build Cache" to make it fast).

Or push a trivial commit to master. Wait for the deploy to go live (~2 min).

### Step 4 — Verify new secret works

```bash
NEW_ADMIN="<paste new secret>"

# This should succeed (use a throwaway `label` so the test key is easy to find later)
curl -sS -X POST https://api.ebenova.dev/v1/keys/create \
  -H "Authorization: Bearer $NEW_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"owner":"rotation-test@ebenova.dev","tier":"free","label":"rotation-verification-YYYY-MM-DD","env":"test"}'

# Then delete the test key from Redis (Upstash dashboard or DEL command).
```

### Step 5 — Verify the OLD secret is dead

```bash
OLD_ADMIN="<paste OLD secret>"
curl -sS -X POST https://api.ebenova.dev/v1/keys/create \
  -H "Authorization: Bearer $OLD_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"owner":"should-fail@ebenova.dev","tier":"free"}'
# Expect: 401 {"error":{"code":"UNAUTHORIZED",...}}
```

### Step 6 — Clean up

`unset NEW_ADMIN OLD_ADMIN`, clear shell history as in runbook 1.

---

## Runbook 3 — Rotate the API Market proxy key

**Special risk: this key is wired into api.market's Custom Headers config.
Rotating without updating their side breaks the entire api.market listing
instantly.** Never do this with an open review in flight.

### Pre-conditions

- [ ] Any api.market listing review is **approved and live** (not pending).
- [ ] You are logged into https://api.market portal → Ebenova Listing →
      Custom Headers, with the edit screen open, ready to paste.
- [ ] You have a ~5-minute maintenance window in which api.market proxy
      traffic can 401 (or you're OK with a brief blip).

### Steps

1. Execute **Runbook 1 steps 1 + 2** to mint a new `sk_live_*` under
   `owner: "api-market-proxy@ebenova.dev"`, `tier: "enterprise"`,
   `label: "API Market proxy (rotated YYYY-MM-DD)"`. Verify it works.
2. In the api.market portal edit screen, replace the old
   `x-api-market-key` value *header map* (actually it's the upstream
   `Authorization: Bearer <sk_live_...>` config) with the new key. Save.
3. Smoke the full proxy chain:
   ```bash
   curl -sS -X POST https://prod.api.market/api/v1/ebenova/ebenova/v1/keys/usage \
     -H "x-api-market-key: <your api.market consumer key>"
   # Expect: 200 success
   ```
4. Only after (3) succeeds, execute **Runbook 1 steps 3 + 4** to disable
   the old proxy key. Confirm the old key 401s.
5. Update `memory/api_market_rotation_pending.md` with the rotation date.
6. Clean up (`unset`, `history -c`).

---

## Rollback

If a rotation breaks production:

- **Customer / owner / proxy key rotation:** re-enable the old Redis record
  (`disabled: false`) or `SET apikey:<old_key>` back to its original JSON.
  The old key resumes working immediately. Then investigate why the new
  key's consumer was mis-configured before retrying.
- **Admin secret rotation:** redeploy the previous Vercel deployment
  (Deployments tab → previous prod deploy → **Promote to Production**). The
  old env var value comes back with it.

---

## What NOT to do

- ❌ Don't ask an AI assistant to "rotate and don't show you the new key."
  You are the legitimate owner; you must see every new secret at least once
  so you can record it. An assistant that hides new secrets from you is
  making them permanently unretrievable.
- ❌ Don't rotate the proxy key with an api.market review open. Wait for
  approval first.
- ❌ Don't rotate the admin secret *before* minting replacement customer
  keys — you lock yourself out of minting.
- ❌ Don't paste admin secrets or `sk_live_*` keys into chat, Slack,
  email, or shared docs. Password manager only.
- ❌ Don't use `git add .` after handling secrets — grep and stage
  specific files only.
