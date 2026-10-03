import type { Metadata } from "next";

/**
 * Ethan's site is unlisted: reachable by link, invisible to search.
 *
 * Note this is NOT paired with a robots.txt `Disallow: /ethan`, and that's
 * deliberate. A disallow stops crawling, which means Google never fetches the
 * page and so never sees the noindex below — and a URL it can't crawl can
 * still get listed (bare, no snippet) if anyone ever links to it. Letting
 * crawlers in to read an explicit noindex is what actually keeps it out of
 * the index, and is Google's own guidance.
 *
 * `noimageindex` is the one that matters for Ryan's food photography: it
 * applies to every image on the page regardless of which URL serves it, which
 * covers the `/_next/image?url=/ethan/...` optimized variants too.
 */
export const UNLISTED: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  noarchive: true,
  nosnippet: true,
  noimageindex: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
    "max-image-preview": "none",
    "max-snippet": 0,
  },
};
