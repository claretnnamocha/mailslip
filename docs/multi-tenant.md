# Platform entry + tenant hosts

One Mailslip deploy serves everyone. **Never** add customer domains on Railway.

## Hosts

| Host | Experience | Tenant key |
| --- | --- | --- |
| **Platform** `mailslip.uselinqr.io` | Landing, signup, team login | Session |
| **Slug** `{slug}-mail.uselinqr.io` | Sign-in only, workspace brand | `Host` → `Workspace.slug` |
| **BYOD** e.g. `mail.acme.com` | Sign-in only, workspace brand | `Host` → `Workspace.customDomain` |

**Slug and custom domain are independent.** A workspace can use one, the other, or both. They do not need to match.

Slug pattern `{slug}-mail.uselinqr.io` (e.g. `gbese-mail.uselinqr.io`):

- One DNS label under the zone → **free Universal SSL** `*.uselinqr.io`
- Does not take over arbitrary `*.uselinqr.io` names (only `*-mail`)
- No Advanced Certificate Manager

## Per workspace

### Slug

1. **Settings → Workspace**: set **slug** (e.g. `gbese`) + brand → Save.
2. Open `https://gbese-mail.uselinqr.io/login`.

No per-tenant DNS. Operator configures wildcard once (below).

### Custom domain (BYOD)

1. DNS: CNAME customer hostname → `cname.mailslip.uselinqr.io` (proxied OK).
2. **Settings → Workspace**: set custom domain → Save (registers Cloudflare custom hostname when `CLOUDFLARE_*` is set).
3. Open `https://your-domain/login`.

## Platform env (once)

```bash
MAILSLIP_PLATFORM_HOST=mailslip.uselinqr.io
# Defaults: base = parent of platform (uselinqr.io), suffix = -mail
MAILSLIP_TENANT_BASE_DOMAIN=uselinqr.io
MAILSLIP_TENANT_SLUG_SUFFIX=-mail
MAILSLIP_CNAME_TARGET=cname.mailslip.uselinqr.io
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=

# Omit NEXTAUTH_URL / AUTH_URL in production (Auth.js uses request Host).
```

## Operator DNS (uselinqr.io, once)

### Wildcard slug hosts

Cloudflare only treats a leading `*.` as a wildcard. Mid-label names like `*-mail` are **literal** (not wildcards).

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `*` | `mailslip.uselinqr.io` | Proxied |

That matches any **single** label under the zone, including `gbese-mail.uselinqr.io`. More specific records (`mail`, `staging`, `folio`, …) **win over** `*` — **required** for sibling apps.

Delete the invalid `*-mail` record if you created it. Covered by free Universal SSL `*.uselinqr.io`.

**If `folio.uselinqr.io` (or any other product) starts serving Mailslip:**

1. DNS → ensure an **explicit** `folio` record to Folio’s origin (CNAME/A). Do not rely on `*`.
2. Workers → Routes → add `folio.uselinqr.io/*` → **None** (same for every sibling app).
3. Redeploy the SaaS Worker from `docs/cloudflare-saas-origin-worker.js` (it pass-throughs non-Mailslip zone hosts).

### Cloudflare for SaaS (BYOD)

Originless fallback, Fallback Origin Active, `cname.mailslip` → platform. Worker sets `X-Mailslip-Host` for custom hostnames.

Worker routes (more specific wins):

| Route | Worker |
| --- | --- |
| `mailslip.uselinqr.io/*` | None |
| `folio.uselinqr.io/*` (and other apps) | None |
| `saas-origin.uselinqr.io/*` | Mailslip SaaS Worker |
| `*/*` | Mailslip SaaS Worker (BYOD only after exclusions) |

Slug hosts on your zone do **not** need Custom Hostnames — only external BYOD domains do.

## Settings

**Settings → Workspace**

- Workspace name / brand  
- **Slug** → `{slug}-mail.uselinqr.io`  
- **Custom domain** (optional BYOD) + Cloudflare status  

Saving a slug or custom domain makes those hosts self-hosted (no public signup). Clearing both returns platform-only access.
