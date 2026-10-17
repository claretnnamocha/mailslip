import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { getVapidKeys } from "@/lib/push";

export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const { publicKey } = await getVapidKeys();
  return NextResponse.json({ publicKey });
}
