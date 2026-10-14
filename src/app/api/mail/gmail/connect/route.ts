import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getPrimaryWorkspace, isAdminRole } from "@/lib/identities";
import {
  gmailOAuthConfigured,
  gmailRedirectUri,
  googleAuthorizeUrl,
  isGmailReturnPath,
  packGmailState,
} from "@/lib/mail/gmail";
import { requestPublicOrigin } from "@/lib/public-url";

function back(
  origin: string,
  returnTo: string,
  message: string,
  extra?: Record<string, string | undefined>,
) {
  const url = new URL(returnTo, origin);
  url.searchParams.set("gmailError", message.slice(0, 180));
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) url.searchParams.set(key, value.slice(0, 180));
    }
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const origin = requestPublicOrigin(request.headers, request.url);
  const url = new URL(request.url);
  const requestedReturn = url.searchParams.get("returnTo");
  const returnTo = isGmailReturnPath(requestedReturn) ? requestedReturn : "/settings/identities";

  const authResult = await requireUser();
  if ("error" in authResult) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const access = url.searchParams.get("access") === "PERSONAL" ? "PERSONAL" : "SHARED";
  const assignUserId = url.searchParams.get("assignUserId")?.trim() || undefined;
  const displayName = url.searchParams.get("displayName")?.trim().slice(0, 80) || undefined;
  const loginHintRaw = url.searchParams.get("loginHint")?.trim().toLowerCase() || "";
  const loginHint = loginHintRaw.includes("@") ? loginHintRaw : undefined;
  const extra = {
    for: assignUserId,
    email: loginHint,
    access,
    name: displayName,
  };

  if (!gmailOAuthConfigured()) {
    return back(
      origin,
      returnTo,
      "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      extra,
    );
  }

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership) return back(origin, returnTo, "No workspace", extra);
  if (!isAdminRole(membership.role)) {
    return back(origin, returnTo, "Only owners and admins can connect mailboxes", extra);
  }

  if (assignUserId && assignUserId !== authResult.userId) {
    const target = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: membership.workspaceId,
          userId: assignUserId,
        },
      },
    });
    if (!target) return back(origin, returnTo, "That person is not in this workspace", extra);
  }

  try {
    const state = packGmailState({
      userId: authResult.userId,
      assignUserId,
      access,
      displayName,
      loginHint,
      returnTo,
      exp: Date.now() + 10 * 60 * 1000,
    });
    const authorize = googleAuthorizeUrl({
      redirectUri: gmailRedirectUri(origin),
      state,
      loginHint,
    });
    return NextResponse.redirect(authorize);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start Google sign-in";
    return back(origin, returnTo, message, extra);
  }
}
