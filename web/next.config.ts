import type { NextConfig } from "next";

// Static export: pages read ../data/*.json at build time and the site is
// rebuilt whenever the pipeline commits new stories. Host anywhere static.
// When it's time for accounts, push notifications etc., drop `output: "export"`
// and move the data into a database.
const nextConfig: NextConfig = {
  output: "export",
  // Set by CI for GitHub Pages project sites (served under /<repo>).
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  // One timestamp per build, inlined everywhere: shown as "Updated …" and
  // compared against /version.json by components/LiveRefresh.tsx.
  env: { NEXT_PUBLIC_BUILT_AT: process.env.NEXT_PUBLIC_BUILT_AT ?? new Date().toISOString() },
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
