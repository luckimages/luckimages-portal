import type { Metadata } from "next";

// A shared invoice link is meant for exactly the person it was sent to —
// keep it out of search results even though it needs no login.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function InvoiceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
