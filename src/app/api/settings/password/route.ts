import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

const schema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const body = schema.parse(await request.json());
  const user = await prisma.user.findUnique({ where: { id: authResult.userId } });
  if (!user) return jsonError("User not found", 404);

  if (user.passwordHash && body.currentPassword) {
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return jsonError("Current password is incorrect", 400);
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(body.newPassword),
      mustChangePassword: false,
    },
  });

  return NextResponse.json({ ok: true });
}
