# Platform entry + tenant hosts

One Mailslip deploy serves everyone. **Never** add customer domains on Railway.

## Hosts

| Host | Experience | Tenant key |
| --- | --- | --- |
| **Platform** `mailslip.uselinqr.io` | Landing, signup, team login | Session |
| **Slug** `{slug}.mailslip.uselinqr.io` | Sign-in only, workspace brand | `Host` → `Workspace.slug` |
| **BYOD** e.g. `mail.acme.com` | Sign-in only, workspace brand | `Host` → `Workspace.customDomain` |

**Slug and custom domain are independent.** A workspace can use one, the other, or both. They do not need to match. Both hosts resolve to that workspace.

Slug hosts stay under **`mailslip.uselinqr.io`** so the rest of `*.uselinqr.io` can be used by other products.

## Per workspace

### Slug

1. **Settings → Workspace**: set **slug** (e.g. `acme`) + brand → Save.
2. Open `https://acme.mailslip.uselinqr.io/login`.

No per-tenant DNS. Operator configures wildcard + cert once (below).

### Custom domain (BYOD)

1. DNS: CNAME customer hostname → `cname.mailslip.uselinqr.io` (proxied OK).
2. **Settings → Workspace**: set custom domain → Save (registers Cloudflare custom hostname when `CLOUDFLARE_*` is set).
3. Open `https://your-domain/login`.

## Platform env (once)

```bash
MAILSLIP_PLATFORM_HOST=mailslip.uselinqr.io
MAILSLIP_TENANT_BASE_DOMAIN=mailslip.uselinqr.io
MAILSLIP_CNAME_TARGET=cname.mailslip.uselinqr.io
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=

# Omit NEXTAUTH_URL / AUTH_URL in production (Auth.js uses request Host).
# BYOD paid gate (optional): MAILSLIP_BYOD_REQUIRE_PAID=1
```

## Operator DNS (uselinqr.io, once)

### Wildcard slug hosts

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `*.mailslip` | `mailslip.uselinqr.io` | Proxied |

**TLS (required):** Universal SSL only covers `uselinqr.io` + `*.uselinqr.io`. It does **not** cover `*.mailslip.uselinqr.io`.

Subscribe to **Advanced Certificate Manager** (~$10/mo) and order a cert for:

- `*.mailslip.uselinqr.io`
- `mailslip.uselinqr.io`

Without that cert, slug hosts fail with connection closed / TLS handshake errors. This does **not** take over other `*.uselinqr.io` hostnames.

### Cloudflare for SaaS (BYOD)

Originless fallback, Worker route `*/*`, `mailslip.uselinqr.io/*` → None, Fallback Origin Active, `cname.mailslip` → platform. Worker sets `X-Mailslip-Host` for custom hostnames.

Slug subdomains on your zone do **not** need Custom Hostnames — only external BYOD domains do.

## Settings

**Settings → Workspace**

- Workspace name / brand  
- **Slug** → `{slug}.mailslip.uselinqr.io`  
- **Custom domain** (optional BYOD) + Cloudflare status  

Saving a slug or custom domain makes those hosts self-hosted (no public signup). Clearing both returns platform-only access.
