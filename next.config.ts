import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local test database runs from WebAssembly; keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // The setup page runs migrations on the server, so ship the migration files.
  outputFileTracingIncludes: { "/setup": ["./drizzle/**/*"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
