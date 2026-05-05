import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async rewrites() {
    return [
      {
        source: '/revistas_uploads/:path*',
        destination: '/api/media/:path*',
      },
    ]
  },
};

export default nextConfig;
