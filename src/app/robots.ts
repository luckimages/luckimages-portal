import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/client", "/photographer", "/api"] },
    ],
    sitemap: "https://www.luckimages.com/sitemap.xml",
  };
}
