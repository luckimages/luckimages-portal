"use client";

import { useState } from "react";
import Link from "next/link";
import HomeNav from "@/components/HomeNav";

type Tier = { maxSqft?: number; price: number };

const PRIMARY_SERVICES: {
  id: string;
  name: string;
  unit: "sqft" | "acreage" | "flat";
  tiers: Tier[];
}[] = [
  {
    id: "listing_photos",
    name: "Listing Photos",
    unit: "sqft",
    tiers: [
      { maxSqft: 1500, price: 200 },
      { maxSqft: 2000, price: 250 },
      { maxSqft: 2500, price: 300 },
      { maxSqft: 3000, price: 350 },
      { price: 400 },
    ],
  },
  {
    id: "drone_photos",
    name: "Drone Photos (Standalone)",
    unit: "flat",
    tiers: [{ price: 200 }],
  },
  {
    id: "video_bronze",
    name: "Video — Bronze",
    unit: "flat",
    tiers: [{ price: 200 }],
  },
  {
    id: "video_silver",
    name: "Video — Silver (w/ Drone)",
    unit: "flat",
    tiers: [{ price: 300 }],
  },
  {
    id: "matterport",
    name: "Matterport 3D Tour",
    unit: "sqft",
    tiers: [
      { maxSqft: 2000, price: 200 },
      { maxSqft: 3000, price: 300 },
      { maxSqft: 4000, price: 400 },
      { price: 500 },
    ],
  },
  {
    id: "twilight_standalone",
    name: "Twilight (Standalone)",
    unit: "flat",
    tiers: [{ price: 400 }],
  },
  {
    id: "virtual_staging",
    name: "Virtual Staging (per photo)",
    unit: "flat",
    tiers: [{ price: 25 }],
  },
  {
    id: "floor_plan",
    name: "Floor Plan",
    unit: "sqft",
    tiers: [
      { maxSqft: 2499, price: 50 },
      { price: 75 },
    ],
  },
  {
    id: "headshots_solo",
    name: "Headshots — Solo",
    unit: "flat",
    tiers: [{ price: 200 }],
  },
];

const ADDON_SERVICES: {
  id: string;
  name: string;
  unit: "sqft" | "flat";
  tiers: Tier[];
  note?: string;
  listingOnly?: boolean;
}[] = [
  {
    id: "drone_5",
    name: "Drone Photos (5)",
    unit: "flat",
    tiers: [{ price: 100 }],
  },
  {
    id: "drone_10",
    name: "Drone Photos (10)",
    unit: "flat",
    tiers: [{ price: 150 }],
  },
  {
    id: "twilight_addon",
    name: "Twilight Add-On (2 photos)",
    unit: "flat",
    tiers: [{ price: 150 }],
    listingOnly: true,
  },
  {
    id: "twilight_2nd",
    name: "Twilight — 2nd Trip",
    unit: "flat",
    tiers: [{ price: 200 }],
    listingOnly: true,
  },
  {
    id: "matterport_addon",
    name: "Matterport (Add-On)",
    unit: "sqft",
    tiers: [
      { maxSqft: 2000, price: 100 },
      { maxSqft: 3000, price: 150 },
      { maxSqft: 4000, price: 200 },
      { price: 250 },
    ],
  },
  {
    id: "floor_plan_addon",
    name: "Floor Plan",
    unit: "sqft",
    tiers: [
      { maxSqft: 2499, price: 50 },
      { price: 75 },
    ],
    listingOnly: true,
  },
  {
    id: "virtual_staging",
    name: "Virtual Staging (per photo)",
    unit: "flat",
    tiers: [{ price: 25 }],
    listingOnly: true,
  },
];

function getPrice(tiers: Tier[], sqft: number): number | null {
  for (const tier of tiers) {
    if (!tier.maxSqft || sqft <= tier.maxSqft) {
      return tier.price === 0 ? null : tier.price; // null = custom
    }
  }
  return tiers[tiers.length - 1].price;
}

export default function QuotePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sqft, setSqft] = useState("");
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sqftNum = parseFloat(sqft) || 0;

  const primaryService = PRIMARY_SERVICES.find((s) => s.id === primaryId);
  const primaryPrice = primaryService
    ? primaryService.unit === "flat" || !sqftNum
      ? primaryService.tiers[0].price
      : getPrice(primaryService.tiers, sqftNum)
    : null;

  const selectedAddons = ADDON_SERVICES.filter((a) => addonIds.has(a.id)).map((a) => {
    const price =
      a.unit === "flat" || !sqftNum ? a.tiers[0].price : getPrice(a.tiers, sqftNum) ?? a.tiers[a.tiers.length - 1].price;
    return { name: a.name, price: price ?? 0 };
  });

  const total =
    (primaryPrice ?? 0) + selectedAddons.reduce((sum, a) => sum + a.price, 0);

  const isCustom = primaryService && primaryPrice === null;

  function toggleAddon(id: string) {
    setAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!primaryService) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          sqft: sqft || null,
          service: { name: primaryService.name, price: primaryPrice ?? "Custom" },
          addons: selectedAddons,
          total: isCustom ? "Custom" : total,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Email us at ryan@luckimages.com.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
        <HomeNav />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4">Quote Received</p>
          <h1 className="text-[clamp(32px,5vw,64px)] font-black tracking-tight uppercase mb-6">We&apos;ll Be in Touch</h1>
          <p className="text-[#666] text-sm max-w-sm leading-relaxed mb-10">
            Your quote has been sent to our team. Expect a response within 24 hours.
          </p>
          <Link href="/pricing" className="text-xs tracking-[3px] uppercase border border-white/25 px-8 py-3 hover:border-white hover:bg-white/5 transition-all">
            Back to Pricing
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />

      <div className="pt-32 pb-16 text-center px-6">
        <p className="text-xs tracking-[4px] uppercase text-[#666] mb-4">Build Your Shoot</p>
        <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-6">Get a Quote</h1>
        <p className="text-[#666] text-lg max-w-md mx-auto leading-relaxed">
          Choose your services and we&apos;ll reach out with a confirmed quote.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 pb-32 max-w-2xl mx-auto w-full flex flex-col gap-12">

        {/* Contact Info */}
        <div className="flex flex-col gap-4">
          <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Your Info
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] tracking-[2px] uppercase text-[#555]">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="bg-transparent border border-white/15 px-4 py-3 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-white/40 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] tracking-[2px] uppercase text-[#555]">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@brokerage.com"
                className="bg-transparent border border-white/15 px-4 py-3 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-white/40 transition-colors"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] tracking-[2px] uppercase text-[#555]">Square Footage / Acreage</label>
            <input
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              placeholder="e.g. 2400 or 1.5 acres"
              className="bg-transparent border border-white/15 px-4 py-3 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>
        </div>

        {/* Primary Service */}
        <div className="flex flex-col gap-4">
          <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Primary Service
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRIMARY_SERVICES.map((s) => {
              const needsSqft = s.unit === "sqft";
              const price = needsSqft && !sqftNum ? undefined : (s.unit === "flat" ? s.tiers[0].price : getPrice(s.tiers, sqftNum));
              const isCustomPrice = price === null;
              const selected = primaryId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setPrimaryId(selected ? null : s.id)}
                  className={`flex items-center justify-between px-5 py-4 border text-left transition-all ${
                    selected
                      ? "border-white bg-white/5"
                      : "border-white/15 hover:border-white/35"
                  }`}
                >
                  <span className="text-sm">{s.name}</span>
                  <span className={`text-sm font-bold ml-4 shrink-0 ${selected ? "text-white" : "text-[#666]"}`}>
                    {price === undefined ? <span className="text-[#444] font-normal text-xs">enter sq ft</span> : isCustomPrice ? "Custom" : `$${price}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Add-Ons */}
        <div className="flex flex-col gap-4">
          <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Add-Ons
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ADDON_SERVICES.filter(a => !a.listingOnly || primaryId === "listing_photos").map((a) => {
              const needsSqft = a.unit === "sqft";
              const price = needsSqft && !sqftNum ? undefined : (a.unit === "flat" ? a.tiers[0].price : getPrice(a.tiers, sqftNum) ?? a.tiers[a.tiers.length - 1].price);
              const selected = addonIds.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAddon(a.id)}
                  className={`flex items-center justify-between px-5 py-4 border text-left transition-all ${
                    selected
                      ? "border-white bg-white/5"
                      : "border-white/15 hover:border-white/35"
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">{a.name}</span>
                    {a.note && <span className="text-[10px] text-[#555]">{a.note}</span>}
                  </div>
                  <span className={`text-sm font-bold ml-4 shrink-0 ${selected ? "text-white" : "text-[#666]"}`}>
                    {price === undefined ? <span className="text-[#444] font-normal text-xs">enter sq ft</span> : `$${price}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Total + Submit */}
        {primaryService && (
          <div className="border-t border-white/10 pt-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="text-xs tracking-[3px] uppercase text-[#555]">Estimated Total</span>
              <span className="text-3xl font-black">
                {isCustom ? "Custom Quote" : `$${total}`}
              </span>
            </div>
            {selectedAddons.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-[#555]">
                  <span>{primaryService.name}</span>
                  <span>${primaryPrice}</span>
                </div>
                {selectedAddons.map((a) => (
                  <div key={a.name} className="flex justify-between text-xs text-[#555]">
                    <span>{a.name}</span>
                    <span>${a.price}</span>
                  </div>
                ))}
              </div>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !name || !email}
              className="bg-white text-black text-xs tracking-[3px] uppercase px-8 py-4 hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Submit Quote"}
            </button>
          </div>
        )}
      </form>
    </main>
  );
}
