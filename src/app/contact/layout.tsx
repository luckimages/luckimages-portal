import type { Metadata } from "next";

// page.tsx is a client component (the form needs interactivity), so
// metadata has to live here in the segment layout instead.
export const metadata: Metadata = {
  title: "Contact — Luck Images | Austin Real Estate Photography",
  description: "Get in touch with Luck Images for real estate photography, drone, Matterport 3D tours, and video in Austin, TX. 24-hour turnaround.",
  openGraph: {
    title: "Contact — Luck Images | Austin Real Estate Photography",
    description: "Get in touch with Luck Images for real estate photography, drone, Matterport 3D tours, and video in Austin, TX.",
    url: "https://www.luckimages.com/contact",
  },
  twitter: {
    card: "summary",
    title: "Contact — Luck Images | Austin Real Estate Photography",
    description: "Get in touch with Luck Images for real estate photography, drone, Matterport 3D tours, and video in Austin, TX.",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
