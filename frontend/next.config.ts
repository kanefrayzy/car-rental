import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Images are resized in advance (scripts/images.mjs) and picked by this loader; the
  // server never resizes them. See lib/imageLoader.ts for why.
  images: {
    loader: "custom",
    loaderFile: "./lib/imageLoader.ts",
  },
  // The terms page moved on 2026-10-16; old links and search results still point here.
  async redirects() {
    return [
      { source: "/terms", destination: "/rental-terms", permanent: true },
      // The upload page became the booking page on 2026-10-16; links in emails sent before
      // still say /upload. The query (booking, expires, signature) is passed on as it is.
      { source: "/upload", destination: "/booking", permanent: true },
    ];
  },
  env: {
    // Copyright year, fixed at build time so the page stays fully static.
    NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()),
    // The Search Console code (lib/seo.ts), inlined at build time. Read at runtime it
    // was gone: the home page is regenerated every minute in the running container, which
    // has no build args, and the tag disappeared after the first refresh (2026-10-19).
    GOOGLE_SITE_VERIFICATION: process.env.GOOGLE_SITE_VERIFICATION ?? "",
  },
  turbopack: {
    // The repo root has its own lockfile for tooling; the app root is this folder.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
