import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = subscribeSchema.parse(await request.json());

  const row = await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: {
      userId: authResult.userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent,
    },
    update: {
      userId: authResult.userId,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent,
    },
  });

  return NextResponse.json({ id: row.id });
}

export async function DELETE(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { userId: authResult.userId, endpoint: body.endpoint },
    });
  } else {
    await prisma.pushSubscription.deleteMany({ where: { userId: authResult.userId } });
  }
  return NextResponse.json({ ok: true });
}
