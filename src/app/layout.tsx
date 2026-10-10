import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { brandName, hostingMode, rootTitleMetadata } from "@/lib/hosting";
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

const brand = brandName();

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: rootTitleMetadata(),
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
      >
        <Providers hosting={hostingMode()}>{children}</Providers>
      </body>
    </html>
  );
}
