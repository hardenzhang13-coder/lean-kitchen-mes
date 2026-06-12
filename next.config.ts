import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/dictionaries", destination: "/settings", permanent: true },
      { source: "/dictionaries/:path*", destination: "/settings/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
