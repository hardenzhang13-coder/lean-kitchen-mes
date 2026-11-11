import type { NextConfig } from "next";
import { checkRequiredEnvVars } from "@/lib/server/env-check-node";

// 构建阶段强制检测关键环境变量
checkRequiredEnvVars();

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["jose"],
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/dictionaries", destination: "/settings", permanent: true },
      { source: "/dictionaries/:path*", destination: "/settings/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
