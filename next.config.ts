import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["imapflow", "nodemailer", "mailparser", "isomorphic-dompurify", "web-push"],
  images: {
    unoptimized: true,
  },
  turbopack: {
    // Prevent Turbopack from treating src/app as the workspace root
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
