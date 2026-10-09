import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { jsonError } from "@/lib/api";
import { allowsPublicSignup } from "@/lib/hosting";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  if (!allowsPublicSignup()) {
    return jsonError("Account creation is disabled on this server", 403);
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return jsonError(body.error.issues[0]?.message || "Invalid input");
  }

  const email = body.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return jsonError("An account with that email already exists", 409);
  }

  const user = await prisma.user.create({
    data: {
      zitadelId: `local:${email}`,
      email,
      name: body.data.name,
      loginName: email,
      passwordHash: await hashPassword(body.data.password),
      mustChangePassword: false,
    },
  });

  await prisma.workspace.create({
    data: {
      name: `${body.data.name.split(/\s+/)[0]}'s workspace`,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
}
