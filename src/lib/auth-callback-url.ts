/**
 * After credentials signIn({ redirect: false }), always stay on the current
 * browser host. Auth.js may return an absolute platform URL (NEXTAUTH_URL /
 * bad forwarded host); following that drops __Host- session cookies.
 */
export function clientAuthRedirect(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
  } catch {
    return fallback;
  }
}
