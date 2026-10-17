import { NextResponse } from "next/server";
import { pollNewMail } from "@/lib/mail/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.MAILSLIP_CRON_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("authorization") || "";
    return header === `Bearer ${secret}`;
  }
  const host = request.headers.get("host")?.split(",")[0]?.trim().toLowerCase() || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await pollNewMail();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return GET(request);
}
