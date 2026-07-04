import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { listAccessibleIdentities } from "@/lib/identities";
import { fetchMessages } from "@/lib/mail/service";

export async function GET(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

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

  all.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return NextResponse.json(all);
}
