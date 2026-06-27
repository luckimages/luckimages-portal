import Link from "next/link";
import HomeNav from "@/components/HomeNav";

const STANDALONE = [
  {
    name: "Listing Photos",
    description: "Sharp, well-lit photography that moves properties faster.",
    tiers: [
      { label: "Up to 1,500 sq ft", price: "$200" },
      { label: "Up to 2,000 sq ft", price: "$250" },
      { label: "Up to 2,500 sq ft", price: "$300" },
      { label: "Up to 3,000 sq ft", price: "$350" },
      { label: "3,500+ sq ft", price: "$400" },
    ],
  },
  {
    name: "Drone Photos",
    description: "FAA-certified aerial photography — standalone shoot.",
    tiers: [
      { label: "20 photos", price: "$200" },
      { label: "Each additional 5 photos", price: "+$50" },
    ],
  },
  {
    name: "Video Walkthrough",
    description: "Cinematic interior walkthroughs that bring listings to life.",
    tiers: [
      { label: "Bronze", price: "$200" },
      { label: "Silver (includes drone)", price: "$300" },
      { label: "Gold", price: "Custom" },
    ],
  },
  {
    name: "Matterport 3D Tour",
    description: "Immersive virtual tours for any device.",
    tiers: [
      { label: "Up to 2,000 sq ft", price: "$200" },
      { label: "Up to 3,000 sq ft", price: "$300" },
      { label: "Up to 4,000 sq ft", price: "$400" },
      { label: "5,000+ sq ft", price: "$500" },
    ],
  },
  {
    name: "Twilight",
    description: "Dramatic golden hour photography — standalone session.",
    tiers: [{ label: "Standalone session (2 photos)", price: "$400" }],
  },
  {
    name: "Virtual Staging",
    description: "Digitally furnished rooms — fast and affordable.",
    tiers: [
      { label: "Per photo", price: "$25" },
      { label: "5 photos", price: "$100" },
      { label: "10 photos", price: "$150" },
    ],
  },
  {
    name: "Floor Plan",
    description: "Clean, accurate floorplan diagrams delivered fast.",
    tiers: [
      { label: "Under 2,500 sq ft", price: "$50" },
      { label: "2,500+ sq ft", price: "$75" },
    ],
  },
  {
    name: "Headshots",
    description: "Professional agent headshots on-location.",
    tiers: [
      { label: "Solo", price: "$200" },
      { label: "Team of 5", price: "$500" },
      { label: "Each additional person", price: "+$50" },
    ],
  },
];

const ADDONS = [
  {
    name: "Drone Photos",
    description: "Aerial stills added to any listing shoot.",
    tiers: [
      { label: "5 photos", price: "$100" },
      { label: "10 photos", price: "$150" },
    ],
  },
  {
    name: "Twilight",
    description: "Golden hour exterior shots added to any listing session.",
    tiers: [
      { label: "2 photos add-on", price: "$150" },
      { label: "2nd trip", price: "$200" },
    ],
  },
  {
    name: "Matterport 3D Tour",
    description: "Virtual tour added to any shoot.",
    tiers: [
      { label: "Up to 2,000 sq ft", price: "$100" },
      { label: "Up to 3,000 sq ft", price: "$150" },
      { label: "Up to 4,000 sq ft", price: "$200" },
      { label: "5,000+ sq ft", price: "$250" },
    ],
  },
  {
    name: "Floor Plan",
    description: "Floor plan diagram added to any shoot.",
    tiers: [
      { label: "Under 2,500 sq ft", price: "$50" },
      { label: "2,500+ sq ft", price: "$75" },
    ],
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

      {/* Standalone Services */}
      <section className="px-6 pb-20 max-w-5xl mx-auto w-full">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-2 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          Services
        </p>
        <p className="text-xs text-[#444] mb-8">Standalone shoot pricing</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border border-white/10">
          {STANDALONE.map((s) => (
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

      {/* Add-Ons */}
      <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-2 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          Add-Ons
        </p>
        <p className="text-xs text-[#444] mb-8">Bolt these onto any existing shoot</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border border-white/10">
          {ADDONS.map((a) => (
            <div key={a.name} className="bg-[#0c0c0c] p-8">
              <h3 className="text-sm font-semibold tracking-[2px] uppercase mb-1">{a.name}</h3>
              <p className="text-xs text-[#555] mb-5">{a.description}</p>
              <div className="flex flex-col gap-2">
                {a.tiers.map((t) => (
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
      <section className="px-6 pb-32 text-center">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-6">Not sure what you need?</p>
        <h2 className="text-[clamp(28px,4vw,52px)] font-black tracking-tight uppercase mb-4">Get a Quote</h2>
        <p className="text-[#666] text-sm mb-10 max-w-sm mx-auto leading-relaxed">
          Tell us about your listing and we&apos;ll put together the perfect package.
        </p>
        <Link
          href="/quote"
          className="text-xs tracking-[3px] uppercase bg-white text-black px-10 py-4 hover:bg-white/90 transition-all inline-block"
        >
          Quote Now
        </Link>
      </section>

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a
          href="mailto:ryan@luckimages.com"
          className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors"
        >
          ryan@luckimages.com
        </a>
      </footer>
    </main>
  );
}
