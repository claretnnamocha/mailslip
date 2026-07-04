# Deploy Zitadel on Railway with Docker (for Mailslip)

Run Zitadel on [Railway](https://railway.com) using the **Docker image in this repo** (`docker/zitadel/`), wired to Mailslip over OIDC.

Use this when you want a stable HTTPS issuer (`https://auth.mailslip.woksol.space`) instead of the local dev stack at `http://localhost:9090`.

| Guide                                                            | Purpose                                        |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| This doc                                                         | Docker → Railway production deploy             |
| [`zitadel-nextjs-auth-guide.md`](./zitadel-nextjs-auth-guide.md) | OIDC / Auth.js integration                     |
| [`README.md`](../README.md)                                      | Local full stack (`docker/docker-compose.yml`) |

---

## What you are building

```mermaid
flowchart LR
  User([User browser])
  App[Mailslip<br/>mailslip.woksol.space]
  Auth[Zitadel Docker<br/>auth.mailslip.woksol.space]
  PG[(Railway Postgres)]

  User --> App
  User --> Auth
  App -->|OIDC| Auth
  Auth --> PG
  App --> PG
```

| Component        | URL                                  | Docker                                           |
| ---------------- | ------------------------------------ | ------------------------------------------------ |
| **Zitadel**      | `https://auth.mailslip.woksol.space` | `docker/zitadel/Dockerfile` on Railway           |
| **Mailslip**     | `https://mailslip.woksol.space`      | Root `Dockerfile` (separate Railway service)     |
| **Postgres × 2** | private Railway URLs                 | Railway managed DB plugins — **one per service** |

---

## Repo Docker layout

```
docker/
├── zitadel/
│   └── Dockerfile          # pins ghcr.io/zitadel/zitadel:v4.15.3
├── docker-compose.yml      # local dev (localhost:9090)
├── docker-compose.railway.yml   # prod-like local test (localhost:8080)
├── railway.toml            # start command + healthcheck
└── .env.railway.example    # copy → .env.railway (never commit secrets)
```

Railway terminates TLS at the edge. Zitadel listens on **8080** inside the container over plain HTTP. Use **`--tlsMode external`** (not `disabled`) so the console API URL is `https://` — otherwise the browser blocks mixed-content requests.

---

## Prerequisites

- Railway account + GitHub repo connected (this Mailslip repo)
- Domain + DNS (example: `mailslip.woksol.space`)
- Docker locally (to test before pushing)

Generate secrets **before first deploy**:

```bash
# Zitadel masterkey — exactly 32 chars, never change after init
openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32; echo

# Mailslip (separate service)
openssl rand -hex 32   # NEXTAUTH_SECRET / AUTH_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY
```

---

## Step 0 — Test the Docker stack locally (recommended)

Validate the production Docker config before Railway:

```bash
cp docker/.env.railway.example docker/.env.railway
```

Edit `docker/.env.railway`:

```bash
ZITADEL_MASTERKEY=<your-32-char-key>
ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD=<strong-password>
# leave DSN empty — compose overrides it for local postgres
```

Start:

```bash
docker compose -f docker/docker-compose.railway.yml up -d --build
```

| Check          | URL                                                    |
| -------------- | ------------------------------------------------------ |
| Console        | http://localhost:8080/ui/console                       |
| OIDC discovery | http://localhost:8080/.well-known/openid-configuration |
| Health         | http://localhost:8080/debug/healthz                    |

Sign in with `ZITADEL_FIRSTINSTANCE_ORG_HUMAN_USERNAME` / password from `.env.railway`.

Stop when done:

```bash
docker compose -f docker/docker-compose.railway.yml down
```

> Local issuer is `http://localhost:8080`. Railway production uses `https://auth.mailslip.woksol.space` — you will re-init on Railway Postgres (fresh database), not reuse this local volume.

---

## Step 1 — Postgres on Railway

1. Railway project → **+ New** → **Database** → **PostgreSQL**
2. Name it `zitadel-postgres`
3. Connect with **Data** tab or `psql` and run:

```sql
CREATE DATABASE zitadel;
```

4. Build the DSN (Railway requires SSL):

```
postgresql://<PGUSER>:<PGPASSWORD>@<PGHOST>:<PGPORT>/zitadel?sslmode=require
```

URL-encode special characters in the password.

---

## Step 2 — Deploy Zitadel on Railway

### Option A — Docker Image (fastest, from Railway UI)

From your Railway project → **Create** → **Docker Image**:

1. Image: `ghcr.io/zitadel/zitadel:v4.15.3`
2. Name the service `zitadel`
3. **Settings → Deploy → Custom Start Command** (must include the binary — Railway replaces the image entrypoint):

```
/app/zitadel start-from-init --masterkeyFromEnv --tlsMode external
```

This reads `ZITADEL_MASTERKEY` from Railway variables (must be **exactly 32 characters**). Do **not** use `--masterkey "$ZITADEL_MASTERKEY"` — Railway does not expand shell variables in the start command.

4. **Settings → Networking** → add custom domain `auth.mailslip.woksol.space` (port **8080**)
5. Set [variables](#environment-reference) on the service (especially `ZITADEL_MASTERKEY` and the Postgres DSN)

### Option B — GitHub repo Dockerfile (pins version in git)

1. **Create** → **GitHub Repository** → select Mailslip
2. Name the service `zitadel`
3. **Settings → Source** → **Root Directory**: `docker`
4. Railway builds `docker/zitadel/Dockerfile` and reads `docker/railway.toml` for the start command
5. Add custom domain + variables as in Option A

### Option C — Railway CLI

```bash
cd docker
cp .env.railway.example .env.railway   # fill values locally for reference
railway link                            # select project
railway service create zitadel
railway up --service zitadel
```

Set variables with `railway variables set KEY=value --service zitadel`.

### Required variables (all options)

| Variable                                            | Value                                 |
| --------------------------------------------------- | ------------------------------------- |
| `ZITADEL_MASTERKEY`                                 | 32-char secret                        |
| `ZITADEL_EXTERNALDOMAIN`                            | `auth.mailslip.woksol.space`          |
| `ZITADEL_EXTERNALPORT`                              | `443`                                 |
| `ZITADEL_EXTERNALSECURE`                            | `true`                                |
| `ZITADEL_DATABASE_POSTGRES_DSN`                     | DSN from Step 1                       |
| `ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED` | `false`                               |
| `ZITADEL_FIRSTINSTANCE_ORG_HUMAN_USERNAME`          | `zitadel-admin@mailslip.woksol.space` |
| `ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD`          | strong password                       |

**Link Postgres without copying secrets** (Railway variable references):

```bash
ZITADEL_DATABASE_POSTGRES_DSN=postgresql://${{zitadel-postgres.PGUSER}}:${{zitadel-postgres.PGPASSWORD}}@${{zitadel-postgres.PGHOST}}:${{zitadel-postgres.PGPORT}}/zitadel?sslmode=require
```

Deploy and watch logs for init → setup → `server is listening`.

---

## Step 3 — DNS + TLS

1. Railway → zitadel → **Networking** → copy CNAME target for `auth.mailslip.woksol.space`
2. Create DNS record:

| Type  | Name   | Target                          |
| ----- | ------ | ------------------------------- |
| CNAME | `auth` | `<your-service>.up.railway.app` |

3. Wait for Railway to provision TLS (5–30 min)

**Verify:**

```bash
curl -sS https://auth.mailslip.woksol.space/.well-known/openid-configuration | head
curl -sS https://auth.mailslip.woksol.space/debug/healthz
open https://auth.mailslip.woksol.space/ui/console
```

If you see **"Instance not found"**, the external URL env vars do not match the public hostname:

- `ZITADEL_EXTERNALDOMAIN` = hostname only (no `https://`)
- `ZITADEL_EXTERNALPORT` = `443`
- `ZITADEL_EXTERNALSECURE` = `true`

---

## Step 4 — Zitadel Console setup

### Change admin password

First login → forced password change. Do not keep defaults.

### Confirm Login V1

Use `/ui/console`, not `/ui/v2/login`. If V2 returns `{"code":5,"message":"Not Found"}`, ensure `ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED=false` was set **before first init**. Otherwise wipe Railway Postgres and redeploy.

### Create Mailslip OIDC application

Console → **Projects** → **Mailslip** → **New Application**:

| Field            | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| Type             | Web                                                       |
| Auth method      | Code (Authorization Code + PKCE)                          |
| Redirect URIs    | `https://mailslip.woksol.space/api/auth/callback/zitadel` |
|                  | `http://localhost:3000/api/auth/callback/zitadel`         |
| Post-logout URIs | `https://mailslip.woksol.space`, `http://localhost:3000`  |
| Development Mode | **On** (allows localhost HTTP)                            |

Copy **Client ID** and **Client Secret** (shown once).

### (Optional) Social login

**Settings → Identity Providers** → add Google/GitHub/etc. → enable in **Login Policy**.

External IdP callback:

```
https://auth.mailslip.woksol.space/ui/login/login/externalidp/callback
```

---

## Step 5 — Deploy Mailslip (Docker on Railway)

Mailslip has its own root `Dockerfile`. Deploy as a **separate** Railway service:

1. **+ New** → **GitHub Repo** → same repo, root directory `/` (default)
2. Add **PostgreSQL** plugin (separate from Zitadel’s DB)
3. Custom domain: `mailslip.woksol.space`
4. Variables:

```bash
NEXTAUTH_URL=https://mailslip.woksol.space
NEXTAUTH_SECRET=<random>
AUTH_SECRET=<same>
ENCRYPTION_KEY=<64 hex chars>
DATABASE_URL=postgresql://…/mailslip?sslmode=require

ZITADEL_ISSUER=https://auth.mailslip.woksol.space
ZITADEL_CLIENT_ID=<from console>
ZITADEL_CLIENT_SECRET=<from console>
```

5. Deploy — login page shows **Continue with Zitadel**

---

## Local dev against Railway Zitadel

Stop local Zitadel; keep only app Postgres if needed:

```bash
docker compose -f docker/docker-compose.yml up -d postgres
```

`.env`:

```bash
NEXTAUTH_URL=http://localhost:3000
ZITADEL_ISSUER=https://auth.mailslip.woksol.space
ZITADEL_CLIENT_ID=<same as prod>
ZITADEL_CLIENT_SECRET=<same secret>
```

```bash
npm run dev
```

Issuer always stays `https://auth.mailslip.woksol.space` — local and prod share one Zitadel instance.

---

## Docker image details

`docker/zitadel/Dockerfile` only pins the upstream image:

```dockerfile
ARG ZITADEL_VERSION=v4.15.3
FROM ghcr.io/zitadel/zitadel:${ZITADEL_VERSION}
EXPOSE 8080
```

Start command (Railway **Custom Start Command** — full path required):

```
/app/zitadel start-from-init --masterkeyFromEnv --tlsMode external
```

> Use `--masterkeyFromEnv` so Zitadel reads `ZITADEL_MASTERKEY` from the environment. Railway does not expand `$VAR` in the start command.

**Upgrade:** bump `ZITADEL_VERSION` in the Dockerfile (or image tag in Railway), backup Postgres, redeploy.

---

## Production checklist

- [ ] `ZITADEL_MASTERKEY` backed up offline — never rotated post-init
- [ ] Admin password changed from default
- [ ] Dedicated Postgres per service; Railway backups enabled
- [ ] Custom domain + correct external URL env vars
- [ ] Login V2 disabled (`LOGINV2_REQUIRED=false`)
- [ ] Zitadel image **pinned** (not `:latest`) in Dockerfile
- [ ] OIDC redirect URIs whitelisted; client secret server-side only
- [ ] SMTP configured in Zitadel (if you need verification emails)

---

## Troubleshooting

| Symptom                         | Fix                                                           |
| ------------------------------- | ------------------------------------------------------------- |
| `[unknown] Failed to fetch` in console | `environment.json` returns `"api":"http://…"` | Change start command to `--tlsMode external` |
| `no master key provided` | Missing `--masterkeyFromEnv` flag | Use `/app/zitadel start-from-init --masterkeyFromEnv --tlsMode external` |
| `masterkey must be 32 bytes` | `ZITADEL_MASTERKEY` wrong length | Must be exactly 32 characters |
| `Instance not found`            | Fix `EXTERNALDOMAIN` / `EXTERNALPORT` / `EXTERNALSECURE`      |
| `/ui/v2/login` Not Found        | Set `LOGINV2_REQUIRED=false`, fresh DB if already initialized |
| DB SSL error                    | Add `?sslmode=require` to DSN                                 |
| OIDC redirect mismatch          | Add exact callback URL in Zitadel app                         |
| Container exits on redeploy     | Masterkey changed — restore original or wipe DB               |
| `start-from-init` could not be found | Railway replaces image entrypoint | Use `/app/zitadel start-from-init …` |
| Build fails on Railway          | Confirm Root Directory = `docker`                             |

**Logs:** Railway → zitadel → Deployments → View Logs

**Local reproduce:**

```bash
docker compose -f docker/docker-compose.railway.yml logs -f zitadel
```

---

## Environment reference

### Zitadel service (Railway)

```bash
ZITADEL_MASTERKEY=<32 chars>
ZITADEL_EXTERNALDOMAIN=auth.mailslip.woksol.space
ZITADEL_EXTERNALPORT=443
ZITADEL_EXTERNALSECURE=true
ZITADEL_DATABASE_POSTGRES_DSN=postgresql://user:pass@host:5432/zitadel?sslmode=require
ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED=false
ZITADEL_FIRSTINSTANCE_ORG_HUMAN_USERNAME=zitadel-admin@mailslip.woksol.space
ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD=<strong>
```

### Mailslip service (Railway)

```bash
NEXTAUTH_URL=https://mailslip.woksol.space
NEXTAUTH_SECRET=<random>
AUTH_SECRET=<random>
ENCRYPTION_KEY=<64 hex>
DATABASE_URL=postgresql://…/mailslip?sslmode=require
ZITADEL_ISSUER=https://auth.mailslip.woksol.space
ZITADEL_CLIENT_ID=<oidc client id>
ZITADEL_CLIENT_SECRET=<oidc client secret>
```

---

## Quick end-to-end test

1. `docker compose -f docker/docker-compose.railway.yml up --build` locally → console works
2. Deploy `docker/` to Railway + attach `auth.mailslip.woksol.space`
3. Create Mailslip OIDC app in console
4. Deploy Mailslip with `ZITADEL_*` env vars
5. `https://mailslip.woksol.space/login` → **Continue with Zitadel** → success

---

## Related links

- [Zitadel self-hosting](https://zitadel.com/docs/self-hosting/deploy/overview)
- [Railway Docker deploy](https://docs.railway.com/guides/dockerfiles)
- [Railway custom domains](https://docs.railway.com/guides/public-networking#custom-domains)
