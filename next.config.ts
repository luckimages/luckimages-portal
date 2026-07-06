import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
