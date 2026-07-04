# Mailslip

A calm, provider-agnostic webmail **client** — not an email host. Bring your own IMAP / POP3 / JMAP / SMTP credentials and manage mail in a modern interface.

> Beautiful email, without switching providers.

Domain: `mailslip.woksol.space` · Sub-product of Linqr · MIT

## Architecture

| Layer | Where |
| --- | --- |
| Frontend UI | Next.js App Router (`src/app`, `src/components`) |
| Backend APIs | Next.js Route Handlers (`src/app/api`) |
| App data | PostgreSQL (Docker) |
| Auth (OIDC) | Zitadel (Docker) + Auth.js |
| Mail protocols | IMAP (`imapflow`), SMTP (`nodemailer`) — credentials encrypted at rest |

Everything product-facing lives in this Next.js app. Infrastructure outside the app is Docker only.

## Quick start

### 1. Start infrastructure

```bash
npm run docker:up
# or just Postgres for local/dev auth:
docker compose -f docker/docker-compose.yml up -d postgres
```

### 2. Configure env

```bash
cp .env.example .env
# defaults work for local demo mode
```

### 3. Database

```bash
npm install
npm run db:push
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Dev login** (when `AUTH_DEV_MODE=true`):

- Email: `ada@mailslip.local`
- Password: `mailslip`

With `DEMO_MAIL=true`, onboarding accepts any mailbox credentials and the inbox shows sample messages so you can review the full UI without a real mail server.

## Zitadel (production-style auth)

1. `docker compose -f docker/docker-compose.yml up -d` (Postgres + Zitadel on `:8080`)
2. Open Zitadel console, create a **Web** application with **CODE** auth
3. Redirect URI: `http://localhost:3000/api/auth/callback/zitadel`
4. Set in `.env`:

```bash
ZITADEL_ISSUER=http://localhost:8080
ZITADEL_CLIENT_ID=...
ZITADEL_CLIENT_SECRET=...
AUTH_DEV_MODE=false
```

Login page offers **Continue with Zitadel**. See `docs/zitadel-nextjs-auth-guide.md`.

## Real mailboxes

Set `DEMO_MAIL=false`, connect an identity in onboarding with real IMAP/SMTP hosts, ports, and an app password where required (Gmail/Outlook). Credentials are AES-256-GCM encrypted with `ENCRYPTION_KEY`.

## Product surfaces

- Landing + login
- Onboarding (individual mailbox / domain path)
- Three-panel inbox (sidebar / list / reading pane)
- Compose (reply / forward / undo-send toast)
- Unified “All inboxes” with per-row destination tags
- Scoped alias identities (server-side recipient filter)
- Settings: profile, identities, signatures, filters, team provisioning, domains, appearance, vacation, folders, PGP keys, spam, import, storage, danger zone
- Contacts

## Docs & design

| Path | Contents |
| --- | --- |
| `docs/Mailslip-PRD.md` | Product requirements |
| `docs/design/` | Design canvas + design system HTML |
| `docs/zitadel-nextjs-auth-guide.md` | Auth integration guide |
| `public/logo-512.png` | Logo mark |
| `public/og.png` | Open Graph image |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run docker:up` | Start Postgres + Zitadel |
| `npm run db:push` | Sync Prisma schema |
| `npm run db:studio` | Prisma Studio |

## Security notes

- Mailslip stores **connection settings**, not mail bodies (except optional drafts/scheduled metadata).
- Disconnect / delete-account flows never touch mail on your servers.
- Scoped identities are enforced server-side on message open.
- Team provisioning hands temporary passwords out-of-band (admin model, not email invites).
