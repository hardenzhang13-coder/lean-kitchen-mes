import type { NextConfig } from "next";
import { checkRequiredEnvVars } from "@/lib/env-check-node";

// 构建阶段强制检测关键环境变量
checkRequiredEnvVars();

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["jose"],
  async redirects() {
    return [
      { source: "/dictionaries", destination: "/settings", permanent: true },
      { source: "/dictionaries/:path*", destination: "/settings/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
