import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fotos de sobra/descarte chegam reduzidas do celular (~200 KB cada). A Vercel aceita até 4,5 MB por pedido.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
