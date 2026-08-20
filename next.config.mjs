/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@databricks/sql", "pino"],
  async rewrites() {
    return [{ source: "/health", destination: "/api/health" }];
  }
};

export default nextConfig;
