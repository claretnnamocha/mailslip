# Platform entry + custom domains

One Mailslip deploy serves everyone.

## Two hosts

| Host | Experience |
| --- | --- |
| **Platform entry** (`mailslip.uselinqr.io`) | General Mailslip: landing, signup, create a workspace |
| **Custom domain** (`inbox.uselinqr.io`, `mail.acme.com`) | Self-hosted style: sign-in only, your brand, that workspace only |

## Per workspace (DNS + Mailslip only)

1. **DNS** — CNAME the hostname to the platform entry, **proxied** through Cloudflare (orange cloud), e.g. `inbox.uselinqr.io` → `mailslip.uselinqr.io`.
2. **Mailslip** — **Settings → Workspace**: set brand + custom domain, save.
3. Open `https://your-domain/login`.

No per-domain setup in Railway (or similar). Cloudflare terminates HTTPS for hostnames on your zone and forwards to the app; Mailslip picks the workspace from the `Host` header.

For a hostname on **another** company’s DNS, they still only CNAME to your platform; you save the domain in Mailslip the same way (keep the zone/proxy arrangement that covers that traffic).

## Platform env (once)

```bash
NEXTAUTH_URL=https://mailslip.uselinqr.io
MAILSLIP_PLATFORM_HOST=mailslip.uselinqr.io
```

## Settings fields

**Settings → Workspace**

- Workspace name  
- Brand name (tab titles on the custom domain)  
- Custom domain  

Saving a custom domain makes that host self-hosted (no public signup). Clearing it returns the workspace to platform-only access.
