import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships native binaries (libvips) — bundling it like a normal JS
  // dependency breaks the native module's dlopen path in the serverless
  // runtime. Marking it external tells Next.js to load it directly from
  // node_modules at runtime instead, which is what actually works on Vercel.
  serverExternalPackages: ["sharp"],
  async redirects() {
    return [
      { source: "/drone",           destination: "/services/drone",           permanent: true },
      { source: "/listing-photos",  destination: "/services/listing-photos",  permanent: true },
      { source: "/video",           destination: "/services/video",           permanent: true },
      { source: "/twilight",        destination: "/services/twilight",        permanent: true },
      { source: "/matterport",      destination: "/services/matterport",      permanent: true },
      { source: "/virtual-staging", destination: "/services/virtual-staging", permanent: true },
      { source: "/floorplans",      destination: "/services/floorplans",      permanent: true },
      { source: "/brochures",       destination: "/services/brochures",       permanent: true },
    ];
  },
};

export default nextConfig;
