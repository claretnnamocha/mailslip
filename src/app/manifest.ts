import type { MetadataRoute } from "next";
import { resolveHosting } from "@/lib/hosting";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { brand } = await resolveHosting().catch(() => ({ brand: "Mailslip" }));
  return {
    id: "/",
    name: brand,
    short_name: brand,
    description: "A calm, modern client for the email you already own.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F7F6F3",
    theme_color: "#F7F6F3",
    lang: "en",
    categories: ["productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/logo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Inbox",
        short_name: "Inbox",
        url: "/mail",
        icons: [{ src: "/logo-192.png", sizes: "192x192" }],
      },
    ],
  };
}
