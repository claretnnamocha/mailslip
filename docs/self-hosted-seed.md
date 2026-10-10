# Seed the first owner (self-hosted)

On self-hosted installs (`MAILSLIP_MODE=self-hosted`), public signup is disabled. Create the first **workspace owner** with the CLI, then sign in and invite everyone else from **Settings → Team**.

## Prerequisites

1. Copy env and set secrets:

```bash
cp .env.example .env
# set NEXTAUTH_SECRET, AUTH_SECRET, ENCRYPTION_KEY
# MAILSLIP_MODE=self-hosted
# optional: MAILSLIP_VENDOR_NAME=Acme   → tab titles like "Acme: Inbox"
```

2. Start Postgres (and the app, if you use Docker):

```bash
# full stack
npm run docker:up

# or Postgres only + local Next
docker compose -f docker/docker-compose.yml up -d postgres
npm install && npm run db:push
```

3. Confirm `DATABASE_URL` in `.env` points at that database.

## Create the owner

```bash
npm run seed:owner -- \
  --email admin@example.com \
  --password 'choose-a-strong-password' \
  --name 'Admin'
```

Omit `--password` to generate one (printed once):

```bash
npm run seed:owner -- --email admin@example.com --name 'Admin'
```

Optional flags:

| Flag | Meaning |
| --- | --- |
| `--workspace "Acme"` | Workspace display name |
| `--must-change-password` | Force a new password on first sign-in |

You can also pass values via env instead of flags: `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`, `OWNER_WORKSPACE`.

## After seeding

1. Open `/login` and sign in with the owner email and password.
2. Connect a mailbox (onboarding).
3. Add teammates under **Settings → Team** (they get a temporary password and must change it).

## Notes

- The command **refuses** to run if an `OWNER` already exists. That keeps bootstrap one-shot.
- It does not create mail identities — only the Mailslip app account and workspace.
- Cloud mode (`MAILSLIP_MODE=cloud`) can still use `/register`; this seed is mainly for self-hosted.
