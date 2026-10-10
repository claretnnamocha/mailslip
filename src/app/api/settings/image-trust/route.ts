import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

function normalizeAddress(value: string) {
  return value.trim().toLowerCase();
}

export async function GET(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("addresses") || searchParams.get("address") || "";
  const addresses = [
    ...new Set(
      raw
        .split(",")
        .map(normalizeAddress)
        .filter((value) => value.includes("@")),
    ),
  ].slice(0, 50);

  if (addresses.length === 0) {
    const all = await prisma.imageTrustedSender.findMany({
      where: { userId: authResult.userId },
      orderBy: { value: "asc" },
    });
    return NextResponse.json({ trusted: all.map((row) => row.value) });
  }

  const rows = await prisma.imageTrustedSender.findMany({
    where: { userId: authResult.userId, value: { in: addresses } },
  });
  return NextResponse.json({ trusted: rows.map((row) => row.value) });
}

const writeSchema = z.object({
  address: z.string().email(),
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const body = writeSchema.safeParse(await request.json());
  if (!body.success) return jsonError("Valid email address required");

  const value = normalizeAddress(body.data.address);
  const row = await prisma.imageTrustedSender.upsert({
    where: {
      userId_value: { userId: authResult.userId, value },
    },
    create: { userId: authResult.userId, value },
    update: {},
  });
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const body = writeSchema.safeParse(await request.json());
  if (!body.success) return jsonError("Valid email address required");

  const value = normalizeAddress(body.data.address);
  await prisma.imageTrustedSender.deleteMany({
    where: { userId: authResult.userId, value },
  });
  return NextResponse.json({ ok: true });
}
