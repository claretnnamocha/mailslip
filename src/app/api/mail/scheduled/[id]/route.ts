import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const { id } = await context.params;
  const row = await prisma.scheduledSend.findFirst({
    where: { id, userId: authResult.userId, sent: false },
  });
  if (!row) return jsonError("Not found", 404);
  await prisma.scheduledSend.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
