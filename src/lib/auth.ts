import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Zitadel from "next-auth/providers/zitadel";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import {
  isInternalHost,
  platformOrigin,
  prepareAuthHostEnv,
  requestPublicOrigin,
} from "@/lib/public-url";

prepareAuthHostEnv();

const providers = [];

if (process.env.ZITADEL_CLIENT_ID && process.env.ZITADEL_ISSUER) {
  providers.push(
    Zitadel({
      issuer: process.env.ZITADEL_ISSUER,
      clientId: process.env.ZITADEL_CLIENT_ID,
      clientSecret: process.env.ZITADEL_CLIENT_SECRET || "",
      client: {
        token_endpoint_auth_method: "none",
      },
      checks: ["pkce", "state"],
      authorization: {
        params: {
          scope: "openid profile email offline_access",
        },
      },
      async profile(profile) {
        const preferred = profile.preferred_username as string | undefined;
        const email =
          profile.email ||
          (preferred?.includes("@") ? preferred : undefined);
        return {
          id: profile.sub,
          name: profile.name,
          email,
          image: profile.picture,
          loginName: preferred,
        };
      },
    }),
  );
}

providers.push(
  Credentials({
    id: "credentials",
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
      const password = credentials?.password as string | undefined;
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (user?.passwordHash && (await verifyPassword(password, user.passwordHash))) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          loginName: user.loginName || user.email,
          mustChangePassword: user.mustChangePassword,
        };
      }

      return null;
    },
  }),
);

async function ensureUser(params: {
  zitadelId: string;
  email: string;
  name?: string | null;
  image?: string | null;
  loginName?: string | null;
}) {
  if (!params.email) {
    throw new Error("Identity provider did not return an email address");
  }

  const existing = await prisma.user.findUnique({
    where: { zitadelId: params.zitadelId },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email: params.email,
        name: params.name ?? existing.name,
        image: params.image ?? existing.image,
        loginName: params.loginName ?? existing.loginName,
      },
    });
  }

  const byEmail = await prisma.user.findUnique({ where: { email: params.email } });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        zitadelId: params.zitadelId,
        name: params.name ?? byEmail.name,
        image: params.image ?? byEmail.image,
        loginName: params.loginName ?? byEmail.loginName,
      },
    });
  }

  const user = await prisma.user.create({
    data: {
      zitadelId: params.zitadelId,
      email: params.email,
      name: params.name,
      image: params.image,
      loginName: params.loginName,
    },
  });

  await prisma.workspace.create({
    data: {
      name: `${params.name || params.email.split("@")[0]}'s workspace`,
      members: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  return user;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Always return an absolute URL (Auth.js client treats odd relatives as errors).
      let base = baseUrl;
      try {
        if (isInternalHost(new URL(baseUrl).host)) base = platformOrigin();
      } catch {
        base = platformOrigin();
      }
      if (url.startsWith("/")) return `${base}${url}`;
      try {
        const target = new URL(url);
        const path = `${target.pathname}${target.search}${target.hash}` || "/";
        if (isInternalHost(target.host)) return `${base}${path}`;
        // Keep path on the resolved public base (BYOD / platform), never jump hosts.
        return `${base}${path}`;
      } catch {
        return base;
      }
    },
    async jwt({ token, user, account, profile, trigger, session }) {
      if (trigger === "update" && session?.mustChangePassword === false) {
        token.mustChangePassword = false;
      }
      if (user) {
        if (account?.provider === "credentials") {
          token.userId = user.id;
          token.email = user.email?.toLowerCase();
          token.mustChangePassword = Boolean(user.mustChangePassword);
          return token;
        }

        const zitadelId = (profile?.sub as string) || user.id!;
        let email =
          user.email?.toLowerCase() ||
          (profile as { email?: string } | undefined)?.email?.toLowerCase() ||
          "";

        const preferred = (profile as { preferred_username?: string } | undefined)
          ?.preferred_username;
        if (!email && preferred?.includes("@")) {
          email = preferred.toLowerCase();
        }

        if (!email && account?.access_token && process.env.ZITADEL_ISSUER) {
          const userinfo = await fetch(
            `${process.env.ZITADEL_ISSUER}/oidc/v1/userinfo`,
            { headers: { Authorization: `Bearer ${account.access_token}` } },
          );
          if (userinfo.ok) {
            const data = (await userinfo.json()) as { email?: string };
            email = data.email?.toLowerCase() || email;
          }
        }

        if (!email) {
          throw new Error("Zitadel did not return an email for this account");
        }

        const dbUser = await ensureUser({
          zitadelId,
          email,
          name: user.name,
          image: user.image,
          loginName: (user as { loginName?: string }).loginName,
        });
        token.userId = dbUser.id;
        token.mustChangePassword = dbUser.mustChangePassword;
        token.email = email;
        return token;
      }

      // Only verify against the DB in Node. Middleware runs on Edge, where Prisma
      // is unavailable — checking here was immediately invalidating every session.
      if (token.userId && process.env.NEXT_RUNTIME !== "edge") {
        const existing = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { id: true, mustChangePassword: true },
        });
        if (!existing) {
          return {
            ...token,
            userId: undefined,
            sub: undefined,
            mustChangePassword: false,
            email: undefined,
            name: undefined,
            picture: undefined,
          };
        }
        token.mustChangePassword = existing.mustChangePassword;
      }

      return token;
    },
    async session({ session, token }) {
      const userId = (token.userId as string | undefined) || (token.sub as string | undefined);
      if (!userId) {
        return { ...session, user: undefined };
      }
      if (session.user) {
        session.user.id = userId;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname;
      // Signup visibility is enforced in /register and /api/auth/register from the
      // request host (per-tenant). Middleware stays Edge-safe without Prisma.
      const isPublic =
        path === "/" ||
        path.startsWith("/login") ||
        path.startsWith("/register") ||
        path.startsWith("/api/auth") ||
        path.startsWith("/api/health") ||
        path.startsWith("/api/hosting");
      if (isPublic) return true;
      if (!session?.user?.id) return false;
      if (
        session.user.mustChangePassword &&
        !path.startsWith("/change-password") &&
        !path.startsWith("/api/settings/password")
      ) {
        const origin = requestPublicOrigin(request.headers, request.nextUrl);
        return Response.redirect(new URL("/change-password", origin));
      }
      return true;
    },
  },
  trustHost: true,
});
