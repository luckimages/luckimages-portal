import Link from "next/link";
import HomeNav from "@/components/HomeNav";

const SERVICES_PRICING = [
  {
    name: "Listing Photos",
    description: "Sharp, well-lit photography that moves properties faster.",
    tiers: [
      { label: "Up to 2,000 sq ft", price: "$225" },
      { label: "2,000 – 3,500 sq ft", price: "$299" },
      { label: "3,500 – 5,000 sq ft", price: "$375" },
      { label: "5,000+ sq ft", price: "Custom" },
    ],
  },
  {
    name: "Video",
    description: "Cinematic walkthroughs that bring listings to life.",
    tiers: [
      { label: "Walkthrough", price: "$399" },
      { label: "Walkthrough + Aerial", price: "$599" },
    ],
  },
  {
    name: "Twilight",
    description: "Dramatic golden hour photography at its finest.",
    tiers: [
      { label: "Add-on to listing photos", price: "$199" },
      { label: "Standalone session", price: "$299" },
    ],
  },
  {
    name: "Drone",
    description: "FAA-certified aerial photography and video.",
    tiers: [
      { label: "Aerial photos", price: "$225" },
      { label: "Photos + Video", price: "$375" },
    ],
  },
  {
    name: "Matterport",
    description: "Immersive 3D virtual tours for any device.",
    tiers: [
      { label: "Up to 2,000 sq ft", price: "$249" },
      { label: "2,000 – 4,000 sq ft", price: "$319" },
      { label: "4,000+ sq ft", price: "$399" },
    ],
  },
  {
    name: "Virtual Staging",
    description: "Digitally furnished rooms — fast and affordable.",
    tiers: [
      { label: "Per room", price: "$65" },
      { label: "5 rooms", price: "$275" },
      { label: "10 rooms", price: "$499" },
    ],
  },
  {
    name: "Floorplans",
    description: "Clean, accurate floorplan diagrams delivered fast.",
    tiers: [
      { label: "Up to 3,000 sq ft", price: "$149" },
      { label: "3,000+ sq ft", price: "$199" },
    ],
  },
  {
    name: "Brochures",
    description: "Print-ready and digital property brochures.",
    tiers: [
      { label: "Digital PDF", price: "$99" },
      { label: "Print-ready", price: "$149" },
    ],
  },
];

const BUNDLES = [
  {
    name: "Essential",
    price: "$349",
    savings: "Save $75",
    includes: ["Listing Photos", "Floorplans"],
    description: "Everything you need for a clean, professional listing.",
  },
  {
    name: "Standard",
    price: "$549",
    savings: "Save $100",
    includes: ["Listing Photos", "Drone Photos", "Floorplans"],
    description: "Ground + aerial coverage with a professional floor plan.",
    featured: true,
  },
  {
    name: "Premium",
    price: "$1,199",
    savings: "Save $250+",
    includes: ["Listing Photos", "Drone Photos + Video", "Video Walkthrough", "Matterport", "Floorplans"],
    description: "The full Luck Images experience. Nothing left on the table.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />

      {/* Header */}
      <div className="pt-32 pb-16 text-center px-6">
        <p className="text-xs tracking-[4px] uppercase text-[#666] mb-4">Transparent Pricing</p>
        <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-6">Pricing</h1>
        <p className="text-[#666] text-lg max-w-lg mx-auto leading-relaxed">
          No hidden fees. No surprises. Just great media delivered fast.
        </p>
      </div>

      {/* Bundles */}
      <section className="px-6 pb-20 max-w-5xl mx-auto w-full">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-8 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          Packages
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BUNDLES.map((b) => (
            <div key={b.name} className={`flex flex-col p-8 border ${b.featured ? "border-white/40 bg-white/[0.03]" : "border-white/10"}`}>
              {b.featured && (
                <span className="text-[10px] tracking-[3px] uppercase text-white/40 mb-4">Most Popular</span>
              )}
              <p className="text-xs tracking-[3px] uppercase text-[#666] mb-2">{b.name}</p>
              <p className="text-4xl font-black mb-1">{b.price}</p>
              <p className="text-xs text-[#4ade80] tracking-[1px] mb-4">{b.savings}</p>
              <p className="text-sm text-[#666] mb-6 leading-relaxed">{b.description}</p>
              <ul className="flex flex-col gap-2 mb-8 flex-1">
                {b.includes.map((item) => (
                  <li key={item} className="text-xs tracking-[1px] text-white/60 flex items-center gap-2">
                    <span className="text-white/30">—</span> {item}
                  </li>
                ))}
              </ul>
              <Link href="/login" className={`text-xs tracking-[3px] uppercase px-6 py-3 text-center transition-all ${b.featured ? "bg-white text-black hover:bg-white/90" : "border border-white/25 hover:border-white hover:bg-white/5"}`}>
                Book Now
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* À la carte */}
      <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-8 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          À La Carte
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border border-white/10">
          {SERVICES_PRICING.map((s) => (
            <div key={s.name} className="bg-[#0c0c0c] p-8">
              <h3 className="text-sm font-semibold tracking-[2px] uppercase mb-1">{s.name}</h3>
              <p className="text-xs text-[#555] mb-5">{s.description}</p>
              <div className="flex flex-col gap-2">
                {s.tiers.map((t) => (
                  <div key={t.label} className="flex items-center justify-between">
                    <span className="text-xs text-[#666]">{t.label}</span>
                    <span className="text-sm font-semibold">{t.price}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 text-center">
        <p className="text-[#666] text-sm mb-6">Not sure what you need? Let's talk.</p>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[3px] uppercase border border-white/25 px-8 py-4 hover:border-white hover:bg-white/5 transition-all">
          Contact Us
        </a>
      </section>

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</a>
      </footer>
    </main>
  );
}
