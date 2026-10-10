# Platform entry + custom domains

One Mailslip deploy serves everyone. **Never** add customer domains on Railway.

## Product rules

| Tier | Host | Tenant key |
| --- | --- | --- |
| **Free** | Static `mailslip.uselinqr.io` only (no per-user slug) | Session / login |
| **Paid** | Customer BYOD (`alice.com`, `gbese.fun`) | `Host` → workspace |

Customers **CNAME** to `MAILSLIP_CNAME_TARGET` (e.g. `cname.mailslip.uselinqr.io`).

**Never** CNAME customers to Railway or to `mailslip.uselinqr.io`.

## Per workspace (paid — DNS + Mailslip only)

1. **DNS** — CNAME customer hostname → `cname.mailslip.uselinqr.io` (proxied OK).
2. **Mailslip** — **Settings → Workspace**: brand + custom domain → Save  
   (registers Cloudflare custom hostname when `CLOUDFLARE_*` is set; requires paid plan).
3. Open `https://your-domain/login`.

## Platform env (once)

```bash
NEXTAUTH_URL=https://mailslip.uselinqr.io
MAILSLIP_PLATFORM_HOST=mailslip.uselinqr.io
MAILSLIP_CNAME_TARGET=cname.mailslip.uselinqr.io
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=

# Until Stripe: mark paid workspaces
# MAILSLIP_PAID_WORKSPACE_IDS=cuid1,cuid2
# Or Workspace.plan = "paid" in the DB
# MAILSLIP_BYOD_ALLOW_ALL=1  # dev only
```

## Operator setup (Cloudflare for SaaS, once)

On zone **uselinqr.io**:

1. Enable **Cloudflare for SaaS** / Custom Hostnames.
2. Deploy [`cloudflare-saas-origin-worker.js`](./cloudflare-saas-origin-worker.js) on **`saas-origin.uselinqr.io`**.  
   Railway only accepts `Host: mailslip.uselinqr.io`. Workers cannot rewrite `Host` on `fetch`, so the Worker proxies to `mailslip.uselinqr.io` and sets **`X-Mailslip-Host`** to the customer domain (Mailslip reads that for tenancy).
3. **Fallback Origin** = `saas-origin.uselinqr.io` (Active).
4. Proxied DNS: `cname.mailslip` → `mailslip.uselinqr.io`.
5. Railway: add **only** `mailslip.uselinqr.io` as a custom domain (one service). Confirm https://mailslip.uselinqr.io works.

## Why “train has not arrived” / Application not found

DNS reached Railway with a customer `Host` that is not provisioned there. Fix = Cloudflare for SaaS + origin Worker — **not** Railway Custom Domain × N.

## Settings

**Settings → Workspace**

- Workspace name / brand  
- Custom domain (paid only)  
- Cloudflare hostname + certificate status when SaaS is configured  

Saving a custom domain sets mode to self-hosted (no public signup). Clearing it returns platform-only access and removes the Cloudflare custom hostname.
