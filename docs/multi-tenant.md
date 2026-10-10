# Platform entry + tenant hosts

One Mailslip deploy serves everyone. **Never** add customer domains on Railway.

## Hosts

| Host | Experience | Tenant key |
| --- | --- | --- |
| **Platform** `mailslip.uselinqr.io` | Landing, signup, team login | Session |
| **Slug** `gbese.mailslip.uselinqr.io` | Sign-in only, workspace brand | `Host` → `Workspace.slug` |
| **BYOD** `gbese.fun` | Same workspace as the slug | `Host` → `Workspace.customDomain` |

`gbese.fun` and `gbese.mailslip.uselinqr.io` resolve to the **same** workspace when slug is `gbese` and custom domain is `gbese.fun`.

## Per workspace

### Slug (recommended default)

1. **Settings → Workspace**: set **slug** (e.g. `gbese`) + brand → Save.
2. Open `https://gbese.mailslip.uselinqr.io/login`.

No per-tenant DNS. Operator configures wildcard once (below).

### Custom domain (BYOD)

1. DNS: CNAME customer hostname → `cname.mailslip.uselinqr.io` (proxied OK).
2. **Settings → Workspace**: set custom domain → Save (registers Cloudflare custom hostname when `CLOUDFLARE_*` is set).
3. Open `https://your-domain/login`.

## Platform env (once)

```bash
MAILSLIP_PLATFORM_HOST=mailslip.uselinqr.io
# {slug}.mailslip.uselinqr.io — defaults to platform host if unset
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

Or point `*.mailslip` at the same originless SaaS path your Worker `*/*` route already covers.

**TLS:** Universal SSL `*.uselinqr.io` does **not** cover `*.mailslip.uselinqr.io`. Add an Advanced Certificate (or Total TLS) for `*.mailslip.uselinqr.io` + `mailslip.uselinqr.io`.

### Cloudflare for SaaS (BYOD)

See prior setup: originless fallback, Worker route `*/*`, `mailslip.uselinqr.io/*` → None, Fallback Origin Active, `cname.mailslip` → platform. Worker sets `X-Mailslip-Host` for custom hostnames.

Slug subdomains on your zone do **not** need Custom Hostnames — only external BYOD domains do.

## Settings

**Settings → Workspace**

- Workspace name / brand  
- **Slug** → `{slug}.mailslip.uselinqr.io`  
- **Custom domain** (optional BYOD) + Cloudflare status  

Saving a slug or custom domain makes those hosts self-hosted (no public signup). Clearing both returns platform-only access.
