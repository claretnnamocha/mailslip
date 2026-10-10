import type { Metadata } from "next";
import { brandName, pageTitle } from "@/lib/hosting";

export { pageTitle };

/** Landing / marketing title that ignores the `{brand}: %s` template. */
export function absoluteBrandTitle(tagline?: string): Metadata {
  const brand = brandName();
  return {
    title: {
      absolute: tagline ? `${brand} — ${tagline}` : brand,
    },
  };
}
