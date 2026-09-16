import Link from "next/link";
import type { Metadata } from "next";
import HomeNav from "@/components/HomeNav";
import FadeUp from "@/components/FadeUp";
import QuoteGenerator from "@/components/QuoteGenerator";
import { PRIMARY_SERVICES, ADDONS, displayTiers } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing — Luck Images | Austin Real Estate Photography",
  description: "Transparent, upfront pricing for real estate photography, drone, Matterport 3D tours, and more. No hidden fees — get an instant quote.",
  openGraph: {
    title: "Pricing — Luck Images | Austin Real Estate Photography",
    description: "Transparent, upfront pricing for real estate photography, drone, Matterport 3D tours, and more. No hidden fees — get an instant quote.",
    url: "https://www.luckimages.com/pricing",
  },
  twitter: {
    card: "summary",
    title: "Pricing — Luck Images | Austin Real Estate Photography",
    description: "Transparent, upfront pricing for real estate photography, drone, Matterport 3D tours, and more.",
  },
};

const STANDALONE = PRIMARY_SERVICES.map((s) => ({
  name: s.name,
  description: s.description,
  tiers: displayTiers(s.pricing),
}));

const ADDON_ROWS = ADDONS.map((a) => ({
  name: a.name,
  description: a.description,
  tiers: displayTiers(a.pricing),
}));

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />

      {/* Header */}
      <FadeUp className="pt-32 pb-16 text-center px-6">
        <p className="text-xs tracking-[4px] uppercase text-[#666] mb-4">Transparent Pricing</p>
        <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-6">Pricing</h1>
        <p className="text-[#666] text-lg max-w-lg mx-auto leading-relaxed">
          No hidden fees. No surprises. Just great media delivered fast.
        </p>
      </FadeUp>

      {/* Quote Generator */}
      <FadeUp>
        <section className="px-6 pb-20 max-w-2xl mx-auto w-full">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-8 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Get a Quote
          </p>
          <QuoteGenerator />
        </section>
      </FadeUp>

      {/* Standalone Services */}
      <FadeUp>
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
      </FadeUp>

      {/* Add-Ons */}
      <FadeUp>
        <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-2 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Add-Ons
          </p>
          <p className="text-xs text-[#444] mb-8">Bolt these onto any existing shoot</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border border-white/10">
            {ADDON_ROWS.map((a) => (
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
      </FadeUp>

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <div className="flex items-center gap-4">
          <a href="/contact" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">
            ryan@luckimages.com
          </a>
          <a href="/contact" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">
            leif@luckimages.com
          </a>
        </div>
      </footer>
    </main>
  );
}
