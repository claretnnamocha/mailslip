import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { gmailOAuthConfigured } from "@/lib/mail/gmail";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  return NextResponse.json({ configured: gmailOAuthConfigured() });
}
