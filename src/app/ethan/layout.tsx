import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { UNLISTED } from "@/lib/ethanPrivacy";

// Ethan's private-chef site lives under /ethan as a working draft until it
// moves to his own domain. It deliberately doesn't share the Luck Images
// chrome (HomeNav/footer) — only the Next app and the Tailwind build.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Ethan Simpson — Private Chef | Austin, TX",
  description:
    "Private chef in Austin, Texas. Multi-course dinner parties cooked in your kitchen, plus catering for events of every size. Classic, Italian, French, or a menu built around you.",
  robots: UNLISTED,
  openGraph: {
    title: "Ethan Simpson — Private Chef | Austin, TX",
    description:
      "Private dinner parties and event catering in Austin, Texas. Cooked in your kitchen, served at your table.",
    type: "website",
  },
};

export default function EthanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${cormorant.variable} ${jost.variable} ethan-site`}>{children}</div>
  );
}
