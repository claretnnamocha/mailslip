import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

export async function POST() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const count = await prisma.pushSubscription.count({ where: { userId: authResult.userId } });
  if (count === 0) return jsonError("No push subscription on this device", 400);
  await sendPushToUser(authResult.userId, {
    title: "Mailslip",
    body: "Notifications are working. New mail will appear here.",
    url: "/mail",
    tag: "mailslip-test",
    force: true,
  });
  return NextResponse.json({ ok: true });
}
