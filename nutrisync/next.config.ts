import type { NextConfig } from "next";

const nextConfig = {
  experimental: {
    turbopack: {
      root: __dirname,  // tells Next.js: this folder is the root
    },
  },

};

export default nextConfig;
