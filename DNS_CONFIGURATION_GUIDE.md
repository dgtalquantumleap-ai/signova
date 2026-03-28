# ═══════════════════════════════════════════════════════════════
# EBENOVA.DEV — DNS CONFIGURATION GUIDE
# ═══════════════════════════════════════════════════════════════
# 
# This guide walks you through configuring DNS for ebenova.dev
# to point to Vercel hosting.
#
# Estimated time: 10 minutes (plus 24-48 hours for DNS propagation)

─────────────────────────────────────────────────────────────────
STEP 1: IDENTIFY YOUR DOMAIN REGISTRAR
─────────────────────────────────────────────────────────────────

Where did you purchase ebenova.dev? Common registrars:

| Registrar       | Login URL                      |
|-----------------|--------------------------------|
| Namecheap       | https://www.namecheap.com/myaccount/ |
| GoDaddy         | https://account.godaddy.com/   |
| Google Domains  | https://domains.google.com/    |
| Cloudflare      | https://dash.cloudflare.com/   |
| Porkbun         | https://porkbun.com/account    |
| Name.com        | https://www.name.com/          |

─────────────────────────────────────────────────────────────────
STEP 2: UPDATE NAMESERVERS TO VERCEL
─────────────────────────────────────────────────────────────────

Log in to your domain registrar and change nameservers to:

    ns1.vercel-dns.com
    ns2.vercel-dns.com

STEP-BY-STEP BY REGISTRAR:

▼ Namecheap:
1. Go to Dashboard → Domain List
2. Click "Manage" next to ebenova.dev
3. Find "Nameservers" section
4. Select "Custom DNS"
5. Enter:
   - ns1.vercel-dns.com
   - ns2.vercel-dns.com
6. Click the green checkmark ✓
7. Wait for confirmation

▼ GoDaddy:
1. Go to My Products → Domains
2. Click ebenova.dev
3. Under "DNS" click "Change"
4. Select "Enter my own nameservers"
5. Enter:
   - ns1.vercel-dns.com
   - ns2.vercel-dns.com
6. Click "Save"

▼ Google Domains:
1. Click ebenova.dev
2. Go to "DNS" tab
3. Under "Custom name servers" click "Manage"
4. Enter:
   - ns1.vercel-dns.com
   - ns2.vercel-dns.com
5. Click "Save"

▼ Cloudflare:
1. Select ebenova.dev from dashboard
2. Note: Cloudflare is both registrar and DNS provider
3. You can either:
   A) Keep Cloudflare nameservers and add CNAME records (see Step 3B)
   B) Remove Cloudflare proxy and use Vercel nameservers

▼ Porkbun:
1. Go to Domain Management
2. Click details icon next to ebenova.dev
3. Under "Nameservers" click "Edit"
4. Select "Custom nameservers"
5. Enter:
   - ns1.vercel-dns.com
   - ns2.vercel-dns.com
6. Click "Save"

─────────────────────────────────────────────────────────────────
STEP 3A: ADD CUSTOM DOMAINS IN VERCEL DASHBOARD
─────────────────────────────────────────────────────────────────

1. Go to vercel.com and log in
2. Click your project (signova)
3. Go to "Settings" → "Domains"
4. Click "Add" button
5. Add these domains one at a time:

   Domain 1: getsignova.com
   Domain 2: www.getsignova.com
   Domain 3: api.ebenova.dev
   Domain 4: ebenova.dev

6. For each domain, Vercel will show:
   - "Configured" (green) if DNS is correct
   - "Invalid Configuration" (red) if still propagating

─────────────────────────────────────────────────────────────────
STEP 3B: ALTERNATIVE — CNAME RECORDS (IF KEEPING EXISTING DNS)
─────────────────────────────────────────────────────────────────

If you don't want to change nameservers, add these CNAME records:

| Type   | Name              | Value                      | TTL     |
|--------|-------------------|----------------------------|---------|
| CNAME  | api               | cname.vercel-dns.com       | Auto    |
| CNAME  | www               | cname.vercel-dns.com       | Auto    |
| A      | @ (root)          | 76.76.21.21                | Auto    |

Note: Root domain (@) requires an A record, not CNAME.

─────────────────────────────────────────────────────────────────
STEP 4: VERIFY DNS PROPAGATION
─────────────────────────────────────────────────────────────────

DNS changes take 24-48 hours to propagate globally.

CHECK PROPAGATION STATUS:

1. Use these tools to check propagation:
   - https://dnschecker.org/
   - https://www.whatsmydns.net/
   - https://dnspropagation.net/

2. Enter: api.ebenova.dev
3. Select "CNAME" from dropdown
4. Check if it resolves to: cname.vercel-dns.com
5. Green checkmarks worldwide = propagation complete

COMMAND LINE CHECK:

Windows (Command Prompt):
    nslookup api.ebenova.dev

Mac/Linux (Terminal):
    dig api.ebenova.dev

Expected output should show:
    api.ebenova.dev  canonical name = cname.vercel-dns.com

─────────────────────────────────────────────────────────────────
STEP 5: VERIFY SSL CERTIFICATE
─────────────────────────────────────────────────────────────────

Vercel automatically provisions SSL certificates.

1. After DNS propagates, visit:
   - https://api.ebenova.dev
   - https://ebenova.dev

2. You should see:
   - ✅ Valid HTTPS (green lock)
   - No security warnings
   - Certificate issued by "Vercel" or "Let's Encrypt"

3. If you see SSL errors:
   - Wait 5-10 minutes (certificate provisioning)
   - Clear browser cache
   - Try incognito/private window

─────────────────────────────────────────────────────────────────
STEP 6: TEST API ENDPOINTS
─────────────────────────────────────────────────────────────────

Once DNS is configured, test the API:

1. Test public endpoint (no auth required):

   curl https://api.ebenova.dev/v1/documents/types

   Expected response:
   {
     "success": true,
     "total": 27,
     "types": ["nda", "freelance-contract", ...],
     "grouped": {...}
   }

2. Test authenticated endpoint (will fail without key):

   curl https://api.ebenova.dev/v1/keys/usage

   Expected response:
   {
     "success": false,
     "error": {
       "code": "MISSING_AUTH",
       "message": "Authorization header required"
     }
   }

3. If both work → DNS is configured correctly! ✓

─────────────────────────────────────────────────────────────────
TROUBLESHOOTING
─────────────────────────────────────────────────────────────────

▼ "Invalid Configuration" in Vercel after 48 hours:
  - Double-check nameservers at registrar
  - Ensure no typos in domain names
  - Try removing and re-adding domain in Vercel
  - Contact Vercel support: vercel.com/support

▼ SSL certificate not provisioning:
  - Wait up to 1 hour after DNS propagation
  - Ensure domain is added in Vercel dashboard
  - Check for conflicting DNS records
  - Try: vercel.com → project → domains → click domain → "Re-issue Certificate"

▼ API returns 404:
  - Verify you're using https:// (not http://)
  - Check vercel.json rewrites are correct
  - Ensure API endpoints are deployed (check Vercel deployments)

▼ "Connection refused" or DNS_PROBE_FINISHED_NXDOMAIN:
  - DNS hasn't propagated yet — wait 24-48 hours
  - Flush DNS cache:
    Windows: ipconfig /flushdns
    Mac: sudo dscacheutil -flushcache
    Linux: sudo systemd-resolve --flush-caches

─────────────────────────────────────────────────────────────────
POST-CONFIGURATION CHECKLIST
─────────────────────────────────────────────────────────────────

After DNS is configured, verify:

[ ] https://api.ebenova.dev loads without SSL warnings
[ ] https://api.ebenova.dev/v1/documents/types returns JSON
[ ] https://ebenova.dev/docs shows API documentation
[ ] Vercel dashboard shows all domains as "Configured"
[ ] Environment variables added in Vercel dashboard:
    - ANTHROPIC_API_KEY
    - UPSTASH_REDIS_REST_URL
    - UPSTASH_REDIS_REST_TOKEN
    - EBENOVA_ADMIN_SECRET

─────────────────────────────────────────────────────────────────
CONTACTS
─────────────────────────────────────────────────────────────────

If you get stuck:

- Vercel Documentation: vercel.com/docs
- Vercel Support: vercel.com/support
- Vercel Discord: discord.gg/vercel
- Upstash Support: support@upstash.com
- Anthropic Support: support@anthropic.com

─────────────────────────────────────────────────────────────────
QUICK REFERENCE — WHAT TO DO RIGHT NOW
─────────────────────────────────────────────────────────────────

1. [ ] Log in to domain registrar (where you bought ebenova.dev)
2. [ ] Change nameservers to ns1.vercel-dns.com and ns2.vercel-dns.com
3. [ ] Go to vercel.com → project → Settings → Domains
4. [ ] Add: api.ebenova.dev
5. [ ] Add: ebenova.dev
6. [ ] Add environment variables in Vercel dashboard
7. [ ] Wait 24-48 hours for DNS propagation
8. [ ] Test: curl https://api.ebenova.dev/v1/documents/types
9. [ ] Celebrate! 🎉
