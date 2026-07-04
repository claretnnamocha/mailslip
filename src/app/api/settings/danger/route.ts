import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function DELETE() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  await prisma.user.delete({ where: { id: authResult.userId } });
  return NextResponse.json({
    ok: true,
    message: "Account deleted. Mail on your servers was not touched.",
  });
}
