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

# BYOD allowed for all by default. Enforce paid later with:
# MAILSLIP_BYOD_REQUIRE_PAID=1
# MAILSLIP_PAID_WORKSPACE_IDS=cuid1,cuid2
# Or Workspace.plan = "paid"
```


## Operator setup (Cloudflare for SaaS, once)

On zone **uselinqr.io** ([Workers as fallback origin](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin/)):

1. Enable **Cloudflare for SaaS** / Custom Hostnames.
2. Deploy [`cloudflare-saas-origin-worker.js`](./cloudflare-saas-origin-worker.js) (proxies to `mailslip.uselinqr.io`, sets **`X-Mailslip-Host`**).
3. **DNS** — create an **originless** fallback record (proxied):

   | Type | Name | Content | Proxy |
   | --- | --- | --- | --- |
   | AAAA | `saas-origin` | `100::` | Proxied |

   (If `saas-origin` already points at a Worker custom domain, edit it to `AAAA 100::` instead.)
4. **Custom Hostnames → Fallback Origin** = `saas-origin.uselinqr.io` (Active).
5. **Workers → mailslip-saas-origin → Triggers / Routes** (on zone `uselinqr.io`):

   | Route | Worker |
   | --- | --- |
   | `*/*` | `mailslip-saas-origin` |
   | `mailslip.uselinqr.io/*` | **None** (bypass — goes to Railway) |
   | `cname.mailslip.uselinqr.io/*` | **None** (optional) |

   Custom hostnames (e.g. `gbese.fun`) enter this zone and match `*/*` → Worker. Do **not** rely on a Worker custom domain alone for SaaS traffic.
6. Proxied DNS: `cname.mailslip` → `mailslip.uselinqr.io`.
7. Railway: add **only** `mailslip.uselinqr.io`. Confirm https://mailslip.uselinqr.io works.

## Why “train has not arrived” / 522

- Railway 404 = customer `Host` hit Railway (no SaaS Worker path).
- Cloudflare **522** after hostname is Active = Fallback Origin set, but no zone Worker route `*/*` (Worker custom domain does not receive vanity Host traffic). Fix routes as above — **not** Railway Custom Domain × N.

## Settings

**Settings → Workspace**

- Workspace name / brand  
- Custom domain (paid only)  
- Cloudflare hostname + certificate status when SaaS is configured  

Saving a custom domain sets mode to self-hosted (no public signup). Clearing it returns platform-only access and removes the Cloudflare custom hostname.
