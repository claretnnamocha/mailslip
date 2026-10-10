import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { resolvePublicHost } from "@/lib/public-url";

/** Ensure Auth.js sees a public Host (not Railway 0.0.0.0:8080). */
function withPublicHost(req: NextRequest): NextRequest {
  const headers = new Headers(req.headers);
  const host = resolvePublicHost(headers);
  headers.set("x-forwarded-host", host);
  headers.set("host", host);
  headers.set(
    "x-forwarded-proto",
    host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https",
  );

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
