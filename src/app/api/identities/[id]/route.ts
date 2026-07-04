import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canAccessIdentity } from "@/lib/identities";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  const access = await canAccessIdentity(authResult.userId, id);
  if (!access || access.permission === "READ_ONLY") {
    return jsonError("Forbidden", 403);
  }

  await prisma.mailIdentity.delete({ where: { id } });
  return NextResponse.json({
    ok: true,
    message: "Identity disconnected. Mail on your server was not touched.",
  });
}
