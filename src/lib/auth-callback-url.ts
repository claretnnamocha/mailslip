/** Client-side: never navigate to Railway's bind address after signIn. */
export function clientAuthRedirect(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const host = parsed.hostname.toLowerCase();
    if (host === "0.0.0.0" || host === "127.0.0.1" || host === "::" || host === "[::]") {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
    }
    if (typeof window !== "undefined" && parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
    }
    return url;
  } catch {
    return fallback;
  }
}
