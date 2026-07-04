import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  return NextResponse.json(await prisma.signature.findMany({ where: { userId: authResult.userId } }));
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = await request.json();
  const sig = await prisma.signature.create({
    data: {
      userId: authResult.userId,
      name: body.name,
      htmlBody: body.htmlBody,
      identityId: body.identityId,
      isDefault: body.isDefault ?? false,
    },
  });
  return NextResponse.json(sig);
}
