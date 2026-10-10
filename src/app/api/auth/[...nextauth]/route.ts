import { handlers } from "@/lib/auth";
import { resolvePublicHost } from "@/lib/public-url";

/** Ensure Auth.js sees a public Host (not Railway 0.0.0.0:8080). */
function withPublicHost(req: Request): Request {
  const headers = new Headers(req.headers);
  const host = resolvePublicHost(headers);
  headers.set("x-forwarded-host", host);
  headers.set("host", host);
  headers.set(
    "x-forwarded-proto",
    host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https",
  );

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    // @ts-expect-error duplex required for streamed bodies
    init.duplex = "half";
  }
  return new Request(req.url, init);
}

export const GET = (req: Request) => handlers.GET(withPublicHost(req));
export const POST = (req: Request) => handlers.POST(withPublicHost(req));
