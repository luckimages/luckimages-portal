import type { MetadataRoute } from "next";

// /ethan is intentionally NOT disallowed here. It's unlisted via an explicit
// noindex (meta + X-Robots-Tag, see src/lib/ethanPrivacy.ts and next.config.ts)
// — blocking it in robots.txt would stop crawlers from ever reading that
// noindex, which is weaker, not stronger.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/client", "/photographer", "/api", "/invoice"] },
    ],
    sitemap: "https://www.luckimages.com/sitemap.xml",
  };
}
