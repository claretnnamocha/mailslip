import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { resolveHosting, rootTitleMetadata } from "@/lib/hosting";
import { platformOrigin } from "@/lib/public-url";
import { themeInitScript } from "@/lib/theme-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Hosting/vendor/tenant must be read per request, not baked at build. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await resolveHosting();
  return {
    metadataBase: new URL(platformOrigin()),
    title: rootTitleMetadata(brand),
    description:
      "A calm, modern client for the email you already own. Your servers, your data, zero lock-in.",
    openGraph: {
      title: brand,
      description: "A calm, modern client for the email you already own.",
      images: ["/og.png"],
    },
    icons: {
      icon: "/logo-512.png",
      apple: "/logo-512.png",
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { mode, brand } = await resolveHosting();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
      >
        <Providers hosting={mode} brand={brand}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
