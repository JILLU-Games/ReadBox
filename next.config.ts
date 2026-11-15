import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "**.run.app",
    "**.googleusercontent.com",
    "**.google.com",
    "127.0.0.1",
  ],
  ...(isDevelopment
    ? {
        experimental: {
          serverActions: {
            allowedOrigins: [
              "**.run.app",
              "**.googleusercontent.com",
              "localhost:3000",
              "127.0.0.1:3000",
            ],
          },
        },
      }
    : {}),
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
