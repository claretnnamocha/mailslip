import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { listAccessibleIdentities } from "@/lib/identities";
import { fetchMessages } from "@/lib/mail/service";
import { processDueScheduledSends } from "@/lib/mail/scheduled";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  await processDueScheduledSends(authResult.userId);

  const { searchParams } = new URL(request.url);
  const folder = searchParams.get("folder") || "INBOX";
  const identityId = searchParams.get("identityId");
  const query = searchParams.get("q");

  const identities = await listAccessibleIdentities(authResult.userId);
  if (identities.length === 0) return NextResponse.json([]);

  const targets = identityId
    ? identities.filter((i) => i.id === identityId)
    : identities;

  if (identityId && targets.length === 0) return jsonError("Identity not found", 404);

  const all = [];
  for (const identity of targets) {
    try {
      if (query) {
        const { searchIdentityMail } = await import("@/lib/mail/service");
        all.push(...(await searchIdentityMail(identity, query, folder)));
      } else {
        all.push(...(await fetchMessages(identity, folder)));
      }
    } catch {
      // Skip identities that fail to connect
    }
  }

  // Hide snoozed messages that are not yet due
  const snoozed = await prisma.snoozedMessage.findMany({
    where: { userId: authResult.userId, wakeAt: { gt: new Date() } },
  });
  const snoozedKeys = new Set(snoozed.map((s) => `${s.identityId}:${s.folder}:${s.uid}`));
  const visible = all.filter(
    (m) => !snoozedKeys.has(`${m.identityId}:${m.folder}:${m.uid}`),
  );

  visible.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return NextResponse.json(visible);
}
