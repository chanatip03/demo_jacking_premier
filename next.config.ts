import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  allowedDevOrigins: ["192.168.1.104"],
};

export default nextConfig;
