import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { canAccessIdentity, listAccessibleIdentities } from "@/lib/identities";
import { fetchQuota } from "@/lib/mail/service";

export async function GET(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const identityId = new URL(request.url).searchParams.get("identityId");
  if (identityId) {
    const access = await canAccessIdentity(authResult.userId, identityId);
    if (!access) return jsonError("Forbidden", 403);
    return NextResponse.json({
      email: access.identity.email,
      type: access.identity.type,
      ...(await fetchQuota(access.identity)),
    });
  }

  const identities = await listAccessibleIdentities(authResult.userId);
  const rows = [];
  for (const identity of identities) {
    try {
      rows.push({
        email: identity.email,
        type: identity.type,
        ...(await fetchQuota(identity)),
      });
    } catch {
      rows.push({
        email: identity.email,
        type: identity.type,
        supported: false,
        message: "Could not read quota",
      });
    }
  }
  return NextResponse.json(rows);
}
