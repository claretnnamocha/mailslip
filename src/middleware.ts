import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolvePublicHost } from "@/lib/public-url";

/**
 * Force a public Host for app pages. Do NOT rewrite headers on /api/auth —
 * mutating the request for POSTs can hang credentials sign-in (body stall).
 */
export default auth((req) => {
  if (req.nextUrl.pathname.startsWith("/api/auth")) return;

  const publicHost = resolvePublicHost(req.headers);
  const currentForwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
  const currentHost = req.headers.get("host")?.split(",")[0]?.trim().toLowerCase();
  if (currentForwarded === publicHost && currentHost === publicHost) return;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-forwarded-host", publicHost);
  requestHeaders.set(
    "x-forwarded-proto",
    publicHost.startsWith("localhost") || publicHost.startsWith("127.") ? "http" : "https",
  );
  requestHeaders.set("host", publicHost);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-512.png|og.png|.*\\.png$).*)"],
};
