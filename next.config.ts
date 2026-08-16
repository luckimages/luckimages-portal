import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent browsers from guessing content type — stops MIME-sniffing attacks
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only allow same-origin iframes — stops clickjacking from external sites
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Force HTTPS for 2 years, include subdomains
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Don't send the full URL as referrer to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features we don't use
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Basic XSS protection for older browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  // sharp ships native binaries (libvips) — bundling it like a normal JS
  // dependency breaks the native module's dlopen path in the serverless
  // runtime. Marking it external tells Next.js to load it directly from
  // node_modules at runtime instead, which is what actually works on Vercel.
  serverExternalPackages: ["sharp"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
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
