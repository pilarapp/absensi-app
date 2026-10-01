import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=self, geolocation=self",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  reactStrictMode: false,
  async rewrites() {
    const r2Url = process.env.R2_PUBLIC_URL || "https://pub-2ebea01d20e4406287ae900adafe0102.r2.dev";
    return [
      {
        source: "/install",
        destination: "/download",
      },
      {
        source: "/storage/:path*",
        destination: `${r2Url}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
