import type { Metadata } from "next";
import { brandName, pageTitle, resolveHosting } from "@/lib/hosting";

export { pageTitle };

/** Landing / marketing title that ignores the `{brand}: %s` template. */
export async function absoluteBrandTitle(tagline?: string): Promise<Metadata> {
  const { brand } = await resolveHosting().catch(() => ({ brand: brandName() }));
  return {
    title: {
      absolute: tagline ? `${brand} — ${tagline}` : brand,
    },
  };
}
