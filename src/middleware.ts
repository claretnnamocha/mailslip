import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Promote X-Mailslip-Host (Cloudflare SaaS origin Worker) so Auth.js
 * createActionURL and tenant resolve use the customer domain.
 */
export default auth((req) => {
  const publicHost = req.headers
    .get("x-mailslip-host")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (!publicHost) return;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-forwarded-host", publicHost);
  requestHeaders.set("x-forwarded-proto", "https");
  requestHeaders.set("host", publicHost);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-512.png|og.png|.*\\.png$).*)"],
};
