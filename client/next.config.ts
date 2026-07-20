import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
   allowedDevOrigins: ['192.168.2.16'],
  async rewrites() {
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: "http://127.0.0.1:5000/api/:path*",
        },
        {
          source: "/ws/:path*",
          destination: "http://127.0.0.1:5000/ws/:path*",
        },
      ],
    };
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
