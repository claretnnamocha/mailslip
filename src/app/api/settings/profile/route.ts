import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = await request.json();
  const user = await prisma.user.update({
    where: { id: authResult.userId },
    data: {
      name: body.name,
      theme: body.theme,
      density: body.density,
      keepEmailWhite: body.keepEmailWhite,
      undoSendSeconds: body.undoSendSeconds,
    },
  });
  return NextResponse.json(user);
}
