import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolvePublicHost } from "@/lib/public-url";

/**
 * Force a public Host for app pages.
 * For /api/auth: only set x-forwarded-host (Auth.js trustHost). Do not rewrite
 * Host — that stalled credential POST bodies.
 */
export default auth((req) => {
  const publicHost = resolvePublicHost(req.headers);
  const currentForwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
  const currentHost = req.headers.get("host")?.split(",")[0]?.trim().toLowerCase();
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");

  if (isAuthApi) {
    if (currentForwarded === publicHost) return;
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-forwarded-host", publicHost);
    requestHeaders.set(
      "x-forwarded-proto",
      publicHost.startsWith("localhost") || publicHost.startsWith("127.") ? "http" : "https",
    );
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo-512.png|logo-192.png|og.png|sw.js|.*\\.png$).*)",
  ],
};
