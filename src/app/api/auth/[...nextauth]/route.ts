import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { resolvePublicHost } from "@/lib/public-url";

function clearPinnedAuthUrl() {
  // Next may have inlined these at build; clear runtime copies for createActionURL.
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
}

/** Ensure Auth.js sees the customer/platform public Host (not Railway bind / pinned URL). */
function withPublicHost(req: NextRequest): NextRequest {
  clearPinnedAuthUrl();
  const headers = new Headers(req.headers);
  const host = resolvePublicHost(headers);
  headers.set("x-forwarded-host", host);
  headers.set("host", host);
  headers.set(
    "x-forwarded-proto",
    host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https",
  );
  // Prefer customer host if Worker sent it (even when CF also set forwarded-host).
  const mailslip = headers.get("x-mailslip-host")?.split(",")[0]?.trim().toLowerCase();
  if (mailslip) {
    headers.set("x-forwarded-host", mailslip);
    headers.set("host", mailslip);
  }

  return new Request(req.url, {
    method: req.method,
    headers,
    body: req.body,
    // @ts-expect-error duplex required for streamed bodies
    duplex: "half",
  }) as unknown as NextRequest;
}

export const GET = (req: NextRequest) => handlers.GET(withPublicHost(req));
export const POST = (req: NextRequest) => handlers.POST(withPublicHost(req));
