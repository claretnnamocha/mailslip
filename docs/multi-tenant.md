# Platform entry + custom domains

One Mailslip deploy serves everyone.

## Two hosts

| Host | Experience |
| --- | --- |
| **Platform entry** (`mailslip.uselinqr.io`) | General Mailslip: landing, signup, create a workspace |
| **Custom domain** (`gbese.fun`, `mail.acme.com`) | Self-hosted style: sign-in only, your brand, that workspace only |

## Per workspace (DNS + Mailslip only)

Customers **never** CNAME to the platform entry. That causes Cloudflare→Cloudflare failures.

1. **DNS** — CNAME the customer hostname to the **SaaS CNAME target** (proxied), e.g. `gbese.fun` → `cname.mailslip.uselinqr.io`.
2. **Mailslip** — **Settings → Workspace**: set brand + custom domain, save (registers the hostname on Cloudflare when SaaS env is set).
3. Open `https://your-domain/login`.

No per-domain Railway setup. Cloudflare for SaaS terminates HTTPS for each custom hostname and forwards to your fallback origin; Mailslip picks the workspace from the `Host` header.

## Platform env (once)

```bash
NEXTAUTH_URL=https://mailslip.uselinqr.io
MAILSLIP_PLATFORM_HOST=mailslip.uselinqr.io
# Customers CNAME here — not the platform entry
MAILSLIP_CNAME_TARGET=cname.mailslip.uselinqr.io
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=
```

## Operator setup (Cloudflare for SaaS, once)

On the **platform** Cloudflare zone (e.g. `uselinqr.io`):

1. Enable **Cloudflare for SaaS** / Custom Hostnames.
2. Set a **fallback origin** (your app origin — configured once on the zone, not per customer).
3. Create a proxied DNS record for the CNAME target, e.g. `cname.mailslip` → fallback.
4. Put `MAILSLIP_CNAME_TARGET`, `CLOUDFLARE_ZONE_ID`, and `CLOUDFLARE_API_TOKEN` on the deploy.

Customer DNS stays: `CNAME your-domain → cname.mailslip.uselinqr.io` (proxied on their side is fine).

## Settings fields

**Settings → Workspace**

- Workspace name  
- Brand name (tab titles on the custom domain)  
- Custom domain  

Saving a custom domain makes that host self-hosted (no public signup). Clearing it returns the workspace to platform-only access and removes the Cloudflare custom hostname when SaaS is configured.
