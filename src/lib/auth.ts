import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Zitadel from "next-auth/providers/zitadel";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const providers = [];

if (process.env.ZITADEL_CLIENT_ID && process.env.ZITADEL_ISSUER) {
  providers.push(
    Zitadel({
      issuer: process.env.ZITADEL_ISSUER,
      clientId: process.env.ZITADEL_CLIENT_ID,
      clientSecret: process.env.ZITADEL_CLIENT_SECRET || "unused",
      authorization: {
        params: {
          scope: "openid profile email offline_access",
        },
      },
      async profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          loginName: profile.preferred_username,
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

      if (process.env.AUTH_DEV_MODE === "true") {
        const expectedEmail = (process.env.AUTH_DEV_EMAIL || "ada@mailslip.local").toLowerCase();
        const expectedPassword = process.env.AUTH_DEV_PASSWORD || "mailslip";
        if (email === expectedEmail && password === expectedPassword) {
          return {
            id: "dev-user",
            name: "Ada Lovelace",
            email: expectedEmail,
            loginName: expectedEmail,
          };
        }
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (user?.passwordHash && (await verifyPassword(password, user.passwordHash))) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          loginName: user.loginName || user.email,
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
  existingId?: string;
}) {
  if (params.existingId && params.existingId !== "dev-user") {
    const existing = await prisma.user.findUnique({ where: { id: params.existingId } });
    if (existing) return existing;
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
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account, profile, trigger, session }) {
      if (trigger === "update" && session?.mustChangePassword === false) {
        token.mustChangePassword = false;
      }
      if (user) {
        const zitadelId =
          account?.provider === "zitadel"
            ? (profile?.sub as string) || user.id!
            : user.id!;
        const email = user.email!;
        try {
          const dbUser = await ensureUser({
            zitadelId,
            email,
            name: user.name,
            image: user.image,
            loginName: (user as { loginName?: string }).loginName,
            existingId: user.id,
          });
          token.userId = dbUser.id;
          token.mustChangePassword = dbUser.mustChangePassword;
        } catch {
          token.userId = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || (token.sub as string);
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname;
      const isPublic =
        path === "/" ||
        path.startsWith("/login") ||
        path.startsWith("/api/auth") ||
        path.startsWith("/api/health");
      if (isPublic) return true;
      if (!session?.user) return false;
      if (
        session.user.mustChangePassword &&
        !path.startsWith("/change-password") &&
        !path.startsWith("/api/settings/password")
      ) {
        return Response.redirect(new URL("/change-password", request.nextUrl));
      }
      return true;
    },
  },
  trustHost: true,
});
