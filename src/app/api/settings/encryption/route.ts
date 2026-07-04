import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const keys = await prisma.pgpKey.findMany({
    where: { userId: authResult.userId },
    select: {
      id: true,
      email: true,
      isDefault: true,
      createdAt: true,
      privateKeyEnc: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    keys.map((k) => ({
      id: k.id,
      email: k.email,
      isDefault: k.isDefault,
      createdAt: k.createdAt,
      hasPrivateKey: Boolean(k.privateKeyEnc),
    })),
  );
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = await request.json();
  if (!body.email || !body.publicKey) {
    return jsonError("Email and public key are required");
  }

  if (body.isDefault) {
    await prisma.pgpKey.updateMany({
      where: { userId: authResult.userId },
      data: { isDefault: false },
    });
  }

  const key = await prisma.pgpKey.create({
    data: {
      userId: authResult.userId,
      email: String(body.email).toLowerCase(),
      publicKey: body.publicKey,
      privateKeyEnc: body.privateKey ? encryptSecret(body.privateKey) : null,
      isDefault: Boolean(body.isDefault),
    },
  });

  return NextResponse.json({
    id: key.id,
    email: key.email,
    isDefault: key.isDefault,
    hasPrivateKey: Boolean(key.privateKeyEnc),
  });
}
