import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["imapflow", "nodemailer", "mailparser", "isomorphic-dompurify"],
  images: {
    unoptimized: true,
  },
  turbopack: {
    // Prevent Turbopack from treating src/app as the workspace root
    root: path.join(__dirname),
  },
};

export default nextConfig;
