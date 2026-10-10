# Platform entry + custom domains

One Mailslip deploy serves everyone.

## Two hosts

| Host | Experience |
| --- | --- |
| **Platform entry** (`mailslip.uselinqr.io`) | General Mailslip: landing, signup, create a workspace |
| **Custom domain** (`mail.acme.com`) | Self-hosted style: sign-in only, your brand, that workspace only |

People always start on the platform. In **Settings → Workspace**, an owner/admin attaches a custom domain and brand. Point DNS (CNAME) at the platform, then open that hostname for the private inbox.

No CLI is required for tenants.

## Environment

```bash
NEXTAUTH_URL=https://mailslip.uselinqr.io
# Comma-separated platform entry hosts (plus NEXTAUTH_URL host is always included)
MAILSLIP_PLATFORM_HOST=mailslip.uselinqr.io
```

TLS: terminate on your host (Railway / Cloudflare). Add each customer hostname there as well when they configure a custom domain.

## Settings

**Settings → Workspace**

- Workspace name  
- Brand name (tab titles on the custom domain)  
- Custom domain (optional)

Saving a custom domain marks that host as self-hosted (no public signup). Clearing it returns the workspace to platform-only access.

## DNS for a customer

1. Customer sets `mail.acme.com` CNAME → your platform host (or ALIAS/A as required).  
2. Admin enters `mail.acme.com` under Workspace and saves.  
3. Visit `https://mail.acme.com/login` — branded, sign-in only.
