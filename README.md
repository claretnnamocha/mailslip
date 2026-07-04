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
| Auth | Email/password (Auth.js) and optional Zitadel OIDC |
| Mail protocols | IMAP (`imapflow`), POP3, JMAP, SMTP (`nodemailer`) — credentials encrypted at rest |

Everything product-facing lives in this Next.js app. Infrastructure outside the app is Docker only.

There is no demo or mock mail mode. Connecting an identity always tests and uses real servers.

## Quick start (full stack in Docker)

```bash
cp .env.example .env
# set NEXTAUTH_SECRET, AUTH_SECRET, ENCRYPTION_KEY (openssl rand -hex 32 each)

npm run docker:up
```

This builds and starts **Postgres**, **Zitadel**, and the **Next.js app** together.

| Service | URL |
| --- | --- |
| Mailslip | http://localhost:3000 |
| Zitadel Console | http://localhost:9090 |

```bash
npm run docker:logs    # follow logs
npm run docker:ps      # status
npm run docker:down    # stop all
npm run docker:restart # rebuild/restart only the app
```

Create an account at http://localhost:3000/register, then connect a real mailbox in onboarding.

### Local Next.js (host) + Docker infra only

```bash
docker compose -f docker/docker-compose.yml up -d postgres zitadel
npm install && npm run db:push && npm run dev
```

## Zitadel client ID & secret (step by step)

You **cannot invent** these values. Zitadel creates them when you register the Mailslip application.

1. Start the stack (`npm run docker:up`) and wait until Zitadel is up.
2. Open **http://localhost:9090/ui/console** in your browser (not `/ui/v2/login`).
3. Sign in with the first-instance admin (from compose):
   - Username: `zitadel-admin@mailslip.local`
   - Password: `Password1!`
   - You will be forced to set a new password on first login — do that.
4. In the console, open your default **Organization** / **Projects**.
5. Open the default project (or create one named **Mailslip**).
6. Click **New** → **Application**.
7. Name it `mailslip`, application type **Web**, then continue.
8. Authentication method: **Code** (Authorization Code + PKCE). Continue.
9. **Redirect URIs** — add exactly:
   - `http://localhost:3000/api/auth/callback/zitadel`
10. **Post logout redirect URIs** — add:
    - `http://localhost:3000`
11. Enable **Development Mode** (allows http://localhost). Create / save.
12. On the application detail page, copy:
    - **Client ID**
    - **Client Secret** (shown once — save it immediately)
13. Put them in `.env`:

```bash
ZITADEL_ISSUER=http://localhost:9090
ZITADEL_CLIENT_ID=<paste Client ID>
ZITADEL_CLIENT_SECRET=<paste Client Secret>
```

14. Restart the app so it picks up the secrets:

```bash
npm run docker:restart
```

Login/register will then show **Continue with Zitadel**. Email/password works without these values.

**More detail:**

- Local / OIDC integration: [`docs/zitadel-nextjs-auth-guide.md`](docs/zitadel-nextjs-auth-guide.md)
- Production on Railway (Docker): [`docs/zitadel-railway-guide.md`](docs/zitadel-railway-guide.md)

## Mailboxes

In onboarding, enter real IMAP/POP3/JMAP and SMTP hosts (or use Gmail/Outlook presets). Connection is tested before the identity is saved. Credentials are AES-256-GCM encrypted with `ENCRYPTION_KEY`.

## Product surfaces

- Landing, register, login
- Onboarding (individual mailbox / domain path)
- Three-panel inbox (sidebar / list / reading pane)
- Compose (reply / forward / undo-send / schedule / PGP)
- Settings, team provisioning, domains, contacts, import

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
