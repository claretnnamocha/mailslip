import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["imapflow", "nodemailer", "mailparser", "isomorphic-dompurify"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
