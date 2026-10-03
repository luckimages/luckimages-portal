import type { Metadata } from "next";

// page.tsx is a client component (the form needs state), so its metadata has
// to live in the segment layout.
export const metadata: Metadata = {
  title: "Book a Dinner — Ethan Simpson, Private Chef | Austin, TX",
  description:
    "Request a date for a private dinner party or event catering in Austin, TX. Choose Classic, Italian, French, or a custom menu.",
  robots: { index: false, follow: false },
};

export default function EthanBookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
