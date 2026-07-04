# Zitadel as Your Auth Layer: Offerings + Next.js Integration Guide

A practical reference for replacing Clerk with Zitadel, so your Next.js app delegates all authentication to Zitadel over the OIDC standard.

---

## Part 1: What Zitadel Actually Offers

Zitadel comes in two forms. Understanding the split is the whole point, because the "free forever" answer lives entirely on the self-hosted side.

### Self-hosted (the option you want)

| Aspect               | Detail                                                               |
| -------------------- | -------------------------------------------------------------------- |
| Cost                 | Free. No license fee.                                                |
| User limit           | None. Unlimited users, organizations, projects.                      |
| Feature restrictions | None. Every protocol and feature is available.                       |
| Runtime              | Single Go binary, backed by PostgreSQL (CockroachDB also supported). |
| Container image      | `ghcr.io/zitadel/zitadel:latest`                                     |
| You operate          | Uptime, upgrades, backups, Postgres, TLS, security hardening.        |

This is the deploy-it-once-and-own-everything model you described. One container plus a Postgres database serves auth for all of your apps (Linqr, Keeway, anything future), because a single Zitadel instance can host many projects and applications.

> License caveat worth verifying before you build a commercial product on it: reporting indicates Zitadel's main repo moved from Apache 2.0 to AGPL 3.0 during 2025, with Apache/MIT carve-outs for the SDKs. AGPL has copyleft obligations that matter if you were to distribute a modified Zitadel. For the normal case (running it as-is as a network service behind your apps), this is typically fine, but confirm the current license on `github.com/zitadel/zitadel` for your own peace of mind given the fintech context.

### Zitadel Cloud (managed, for comparison)

You probably will not use this, but for completeness:

- A free tier exists for development and small projects. Reported limits differ across sources (some cite 100 daily active users, some cite a larger monthly-active allowance), so treat the exact number as "verify on the pricing page." Total users are unlimited even on free.
- Paid Cloud starts around **$100/month**, which includes a jump in daily-active-user capacity, an SLA, one custom domain, and support.
- Same image runs on Cloud and self-hosted, so you can start self-hosted and migrate to Cloud later without re-architecting if you ever stop wanting to run Postgres yourself.

### Protocols and auth features (identical on self-hosted and Cloud)

This is your "is OAuth supported / everything like that" checklist:

- **OAuth 2.0** yes, full support.
- **OpenID Connect (OIDC)** yes, and Zitadel is OpenID Connect Certified.
- **SAML 2.0** yes.
- **Authorization Code flow with PKCE** yes (the recommended flow for your Next.js app).
- **Social / external identity providers** Google, GitHub, GitLab, Apple, Microsoft, plus any generic OIDC or SAML provider.
- **Passwordless / MFA** FIDO2 / WebAuthn passkeys, U2F, OTP via authenticator app, OTP via email, OTP via SMS.
- **Multi-tenancy** first-class. Instance to organization to project hierarchy, with per-organization identity-provider config and branding. This maps directly to B2B SaaS where each customer brings their own SSO.
- **RBAC and fine-grained authorization** roles, custom metadata, and "actions" for injecting custom logic into flows.
- **Provisioning** SCIM support.
- **Audit** unlimited, event-sourced audit trail (every change is an event).
- **APIs** full gRPC and REST management APIs, so you can create users, projects, and applications programmatically (useful for automating tenant onboarding).

### The one honest gap versus Clerk

Zitadel does **not** ship drop-in React components like Clerk's `<SignIn />` and `<UserButton />`. There is no Clerk-style "SDK" that renders UI for you. Instead you integrate over the OIDC standard using a standard library (NextAuth.js / Auth.js). You get a hosted login UI from Zitadel (themeable) that your app redirects to, rather than embedded components. If drop-in embedded UI was the main thing you loved about Clerk, know that this is the tradeoff.

---

## Part 2: The Architecture (how auth gets "handed over")

The pattern is standard OIDC delegation:

1. Your Next.js app owns no passwords and runs no login logic.
2. When a user needs to log in, your app redirects them to Zitadel (the hosted login).
3. Zitadel authenticates the user (password, passkey, social, MFA, whatever you configured) and redirects back to your app with an authorization code.
4. Your Next.js backend exchanges that code (secured by PKCE) for tokens.
5. NextAuth.js creates a session for the user. Your app reads the session to know who they are.

Zitadel is the identity provider. Your Next.js backend is just an OIDC client. That is exactly the "hand everything over" model you asked for.

---

## Part 3: Next.js Integration, Step by Step

Zitadel's recommended path for Next.js is **Auth.js (NextAuth.js)** with its built-in Zitadel provider, using the Authorization Code flow with PKCE. There are two official repos you can lean on: `zitadel/example-auth-nextjs` (the newer, fuller example) and `zitadel/zitadel-nextjs` (the template).

### Step 1: Configure the application inside Zitadel

In the Zitadel Console:

1. Create (or open) a **Project**.
2. Add a new **Application**. Choose type **Web**.
3. For the auth method, choose **CODE** (Authorization Code). This keeps a client secret, which stays server-side in your Next.js backend and is never exposed to the browser.
4. Add your **Redirect URIs**:
   - Dev: `http://localhost:3000/api/auth/callback/zitadel`
   - Prod: `https://yourdomain.com/api/auth/callback/zitadel`
5. Add **Post-logout redirect URIs** similarly (for example `.../api/auth/logout/callback`).
6. For local development, enable **dev mode** on the app so it allows non-HTTPS localhost redirects.
7. Copy the **Client ID** and **Client Secret** (the secret is shown once).
8. Optional but handy: in Token settings, enable **User Info inside ID Token** so you get the user's profile claims directly on authentication.

Your **Issuer URL** is on the application detail page (for Cloud it looks like `https://your-instance.zitadel.cloud`; for self-hosted it is your own domain, for example `https://auth.yourdomain.com`).

### Step 2: Install dependencies

```bash
npm install next-auth
```

### Step 3: Environment variables

Create `.env.local`:

```bash
# Your Zitadel issuer (Cloud instance URL or your self-hosted auth domain)
ZITADEL_ISSUER=https://auth.yourdomain.com

# From the Zitadel application you created
ZITADEL_CLIENT_ID=your-client-id
ZITADEL_CLIENT_SECRET=your-client-secret

# NextAuth requires these
NEXTAUTH_URL=http://localhost:3000
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NEXTAUTH_SECRET=your-long-random-string
```

Note: the Authorization Code + PKCE flow does not strictly need a client secret per the OIDC spec, but Auth.js still requires a value in its config, so keep the secret set.

### Step 4: Configure the Zitadel provider (Auth.js v5)

Create `auth.ts` at your project root:

```ts
import NextAuth from "next-auth";
import Zitadel from "next-auth/providers/zitadel";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Zitadel({
      issuer: process.env.ZITADEL_ISSUER,
      clientId: process.env.ZITADEL_CLIENT_ID,
      clientSecret: process.env.ZITADEL_CLIENT_SECRET,
      // Optional: shape the user object from OIDC claims
      async profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          loginName: profile.preferred_username,
          image: profile.picture,
        };
      },
    }),
  ],
});
```

If you want a refresh token, add the `offline_access` scope and persist the token in the JWT callback.

### Step 5: Wire up the route handler

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

This single catch-all endpoint handles login initiation, the callback, and logout.

### Step 6: Protect routes with middleware

Create `middleware.ts` at the root:

```ts
export { auth as middleware } from "@/auth";

export const config = {
  // Protect everything except static assets and the auth API itself
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

Unauthenticated users hitting a protected path get redirected into the Zitadel login flow automatically.

### Step 7: Use the session in your app

Server component:

```ts
import { auth } from "@/auth";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) return <p>Not signed in</p>;
  return <p>Signed in as {session.user?.email}</p>;
}
```

Client component (sign in / out buttons):

```tsx
"use client";
import { signIn, signOut, useSession } from "next-auth/react";

export function AuthButtons() {
  const { data: session } = useSession();
  return session ? (
    <button onClick={() => signOut()}>Sign out</button>
  ) : (
    <button onClick={() => signIn("zitadel")}>Sign in</button>
  );
}
```

Wrap your app in `SessionProvider` (in a client `providers.tsx`) if you use the client-side `useSession` hook.

That is the whole handover. Your Next.js backend never stores a password or verifies credentials. Zitadel does all of it.

---

## Part 4: Running Zitadel Yourself (Docker)

Quickest possible smoke test (do not use these flags in production):

```bash
docker run --name zitadel -p 9090:8080 \
  ghcr.io/zitadel/zitadel:latest start-from-init \
  --masterkey "MasterkeyNeedsToHave32Characters" \
  --tlsMode disabled
```

For anything real you want Docker Compose with a dedicated Postgres, a persisted `masterkey`, TLS enabled, and a proper external domain (Zitadel needs to be reachable at a stable HTTPS domain for OIDC to work, since the issuer URL is baked into tokens). On your existing Railway / Kubernetes setup this slots in as: Zitadel container + managed Postgres + a domain like `auth.yourdomain.com`.

**Railway:** step-by-step deploy for Mailslip is in [`zitadel-railway-guide.md`](./zitadel-railway-guide.md).

Migration path if you ever tire of ops: the same image runs on Zitadel Cloud, so you can lift to managed later without changing your Next.js integration.

---

## Part 5: Quick Decision Summary

- **Free all the time?** Yes, self-hosted. No user cap, no feature gating. Your only cost is the infra you already run.
- **OAuth / OIDC / SAML?** All yes, plus passkeys, MFA, social login, SCIM.
- **One implementation controls everything?** Yes. One Zitadel instance is the identity provider for all your apps.
- **Cost you pay instead of Clerk's bill:** you operate the service (uptime, upgrades, backups, hardening) and you build your own login UI wiring via NextAuth rather than dropping in prebuilt components.

---

## Emerging option (watch, do not depend on yet)

Zitadel is building a "Next Generation" developer flow: `npx @zitadel/cli@alpha setup --framework next` that scaffolds a local-first Next.js auth setup. It is explicitly **alpha and local-only** right now (does not connect to Cloud, no production handoff yet). Keep the stable NextAuth path above for anything you actually ship, and revisit the CLI once it leaves alpha.

---

## Source pointers

- Zitadel Next.js docs and official example repos (`zitadel/example-auth-nextjs`, `zitadel/zitadel-nextjs`)
- Auth.js Zitadel provider (`authjs.dev`)
- Zitadel pricing and self-hosting docs (`zitadel.com`)

Verify the current license and the exact Cloud free-tier numbers directly on Zitadel's site before finalizing, since both have shifted recently.
