import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/install",
        destination: "/download",
      },
    ];
  },
};

export default nextConfig;
