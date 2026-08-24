import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel handles build output automatically — do NOT use output: "standalone"
     on Vercel (it's for Docker/self-hosting only). */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
