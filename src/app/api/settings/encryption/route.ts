import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  return NextResponse.json(await prisma.pgpKey.findMany({
    where: { userId: authResult.userId },
    select: { id: true, email: true, isDefault: true, createdAt: true },
  }));
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = await request.json();
  const key = await prisma.pgpKey.create({
    data: {
      userId: authResult.userId,
      email: body.email,
      publicKey: body.publicKey,
    },
  });
  return NextResponse.json(key);
}
