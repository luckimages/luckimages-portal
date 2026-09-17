"use client";

import { useState } from "react";
import {
  PRIMARY_SERVICES as PRICING_PRIMARY,
  ADDONS as PRICING_ADDONS,
  addonsFor,
  resolvePrice,
  getSqftTierMedia,
} from "@/lib/pricing";

// Mirrors the client portal's "Book a Shoot" tab: a flat checkbox model with
// no variant/quantity pickers, so every service shows its base/default price
// and every tile is the same size. Keep these two surfaces in sync.
const PRIMARY_SERVICES = PRICING_PRIMARY.map((s) => ({ key: s.name, label: s.name, id: s.id }));

// These three add-ons offer a Small/Large quantity instead of a flat
// on/off toggle — their pricing.options carry "5"/"10" keys for that.
const VARIANT_ADDON_IDS = new Set(["aerial_addon", "ground_photos_addon", "virtual_staging_addon"]);

function selectedPrimaryName(selectedNames: string[]): string | null {
  return PRICING_PRIMARY.find((p) => selectedNames.includes(p.name))?.name ?? null;
}

function sortedAddonsFor(selectedNames: string[]) {
  const primaryName = selectedPrimaryName(selectedNames);
  const primary = PRICING_PRIMARY.find((p) => p.name === primaryName);
  const compatibleIds = new Set(primary ? addonsFor(primary.id).map((a) => a.id) : []);
  return [...PRICING_ADDONS]
    .map((a) => ({ key: a.name, label: `+ ${a.name}`, id: a.id, active: compatibleIds.has(a.id) }))
    .sort((a, b) => (a.active ? 0 : 1) - (b.active ? 0 : 1));
}

function servicePrice(key: string, sqft: number, optionKey?: string): number | null {
  const primary = PRICING_PRIMARY.find((p) => p.name === key);
  const addon = PRICING_ADDONS.find((a) => a.name === key);
  const shape = primary?.pricing ?? addon?.pricing;
  if (!shape) return null;
  const price = resolvePrice(shape, { sqft, optionKey });
  return typeof price === "number" ? price : null;
}

// "What you get" line under each tile — a sq ft tier's `media` (e.g. "25+
// photos") when one matches, otherwise the service's flat `quoteNote`.
function serviceDescription(key: string, sqft: number): string | null {
  const primary = PRICING_PRIMARY.find((p) => p.name === key);
  const addon = PRICING_ADDONS.find((a) => a.name === key);
  const entry = primary ?? addon;
  if (!entry) return null;
  if (entry.pricing.kind === "sqft") {
    const media = getSqftTierMedia(entry.pricing.tiers, sqft);
    if (media) return media;
  }
  return entry.quoteNote;
}

function calcQuote(services: string[], sqft: number, addonOptionKey: Record<string, string>): { low: number; exact: boolean } {
  let total = 0;
  let allExact = true;
  for (const s of services) {
    const primary = PRICING_PRIMARY.find((p) => p.name === s);
    const addon = PRICING_ADDONS.find((a) => a.name === s);
    const shape = primary?.pricing ?? addon?.pricing;
    if (!shape) continue;
    const price = resolvePrice(shape, { sqft, optionKey: addonOptionKey[s] });
    if (typeof price === "number") total += price;
    else allExact = false;
    if (shape.kind === "sqft" && !sqft) allExact = false;
  }
  return { low: total, exact: allExact && !!services.length };
}

export default function QuoteGenerator() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sqft, setSqft] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [addonOptionKey, setAddonOptionKey] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sqftNum = parseInt(sqft) || 0;

  function toggleService(s: string) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  // Small/Large add-ons: clicking the already-selected size removes the
  // add-on entirely; clicking the other size just swaps the price tier.
  function selectAddonVariant(name: string, optionKey: string) {
    if (addonOptionKey[name] === optionKey) {
      setServices((prev) => prev.filter((s) => s !== name));
      setAddonOptionKey((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    } else {
      if (!services.includes(name)) setServices((prev) => [...prev, name]);
      setAddonOptionKey((prev) => ({ ...prev, [name]: optionKey }));
    }
  }

  // Only one primary at a time — selecting a new one replaces the old, and
  // drops any add-ons that are no longer compatible with the new primary.
  function selectPrimaryService(name: string) {
    setServices((prev) => {
      const wasSelected = prev.includes(name);
      const primaryNames = new Set(PRICING_PRIMARY.map((p) => p.name));
      const nonPrimary = prev.filter((s) => !primaryNames.has(s));
      if (wasSelected) return nonPrimary;
      const compatibleIds = new Set(addonsFor(PRICING_PRIMARY.find((p) => p.name === name)!.id).map((a) => a.id));
      const compatibleNames = new Set(PRICING_ADDONS.filter((a) => compatibleIds.has(a.id)).map((a) => a.name));
      const keptAddons = nonPrimary.filter((s) => compatibleNames.has(s));
      return [name, ...keptAddons];
    });
  }

  const { low: total, exact } = calcQuote(services, sqftNum, addonOptionKey);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (services.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const primaryName = selectedPrimaryName(services);
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          sqft: sqft || null,
          service: primaryName ? { name: primaryName, price: servicePrice(primaryName, sqftNum) } : null,
          addons: services
            .filter((s) => s !== primaryName)
            .map((s) => ({ name: s, price: servicePrice(s, sqftNum, addonOptionKey[s]) ?? 0 })),
          total: exact ? total : `From $${total}`,
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
      <div className="text-center py-16">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4">Quote Received</p>
        <h2 className="text-[clamp(28px,4vw,52px)] font-black tracking-tight uppercase mb-4">We&apos;ll Be in Touch</h2>
        <p className="text-[#666] text-sm max-w-sm mx-auto leading-relaxed">
          Your quote has been sent to our team. Expect a response within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      {/* Contact Info */}
      <div className="flex flex-col gap-4">
        <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Your Info</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] tracking-[2px] uppercase text-[#555]">Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith"
              className="bg-transparent border border-white/15 px-4 py-3 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-white/40 transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] tracking-[2px] uppercase text-[#555]">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@brokerage.com"
              className="bg-transparent border border-white/15 px-4 py-3 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-white/40 transition-colors" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] tracking-[2px] uppercase text-[#555]">Square Footage</label>
          <input value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="e.g. 2400"
            className="bg-transparent border border-white/15 px-4 py-3 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-white/40 transition-colors" />
        </div>
      </div>

      {/* Service — single-select, same tile format/size as the portal's Book a Shoot tab */}
      <div className="flex flex-col gap-3">
        <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Service <span className="normal-case text-[#444] tracking-normal">(choose one)</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRIMARY_SERVICES.map((s) => {
            const checked = services.includes(s.key);
            const price = servicePrice(s.key, sqftNum);
            const desc = serviceDescription(s.key, sqftNum);
            return (
              <label key={s.key} className={`flex flex-col gap-1.5 px-3 py-2.5 cursor-pointer border transition-colors ${checked ? "border-white/40 bg-white/5" : "border-white/10 bg-[#181818] hover:bg-white/[0.03]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={checked} onChange={() => selectPrimaryService(s.key)} className="accent-white w-3 h-3 shrink-0" />
                    <span className="text-xs text-white">{s.label}</span>
                  </div>
                  {price !== null && <span className="text-[10px] text-[#555] shrink-0">${price}</span>}
                </div>
                {desc && <span className="text-[10px] text-[#555] ml-5">{desc}</span>}
              </label>
            );
          })}
        </div>
      </div>

      {/* Add-Ons — always shown; compatible ones rise to the top and light up */}
      <div className="flex flex-col gap-3">
        <p className="text-xs tracking-[4px] uppercase text-[#444] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Add-Ons</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sortedAddonsFor(services).map((s) => {
            const checked = services.includes(s.key);
            const desc = serviceDescription(s.key, sqftNum);
            const tileCls = `flex flex-col gap-1.5 px-3 py-2.5 border transition-colors ${s.active ? "" : "opacity-30 pointer-events-none"} ${checked ? "border-white/30 bg-white/5" : "border-white/5 bg-[#141414]"}`;

            if (VARIANT_ADDON_IDS.has(s.id)) {
              const addonEntry = PRICING_ADDONS.find((a) => a.id === s.id)!;
              const opts = addonEntry.pricing.kind === "options" ? addonEntry.pricing.options : [];
              const smallOpt = opts.find((o) => o.key === "5");
              const largeOpt = opts.find((o) => o.key === "10");
              const selectedKey = addonOptionKey[s.key];
              const price = servicePrice(s.key, sqftNum, selectedKey);
              return (
                <div key={s.key} className={tileCls}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#aaa]">{s.label}</span>
                    {checked && price !== null && <span className="text-[10px] text-[#444] shrink-0">${price}</span>}
                  </div>
                  {desc && <span className="text-[10px] text-[#444]">{desc}</span>}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {smallOpt && (
                      <button type="button" disabled={!s.active} onClick={() => selectAddonVariant(s.key, smallOpt.key)}
                        className={`px-2 py-1 text-[10px] border transition-colors ${selectedKey === smallOpt.key ? "border-white bg-white/10 text-white" : "border-white/15 text-[#888] hover:border-white/35"}`}>
                        Small — ${smallOpt.price}
                      </button>
                    )}
                    {largeOpt && (
                      <button type="button" disabled={!s.active} onClick={() => selectAddonVariant(s.key, largeOpt.key)}
                        className={`px-2 py-1 text-[10px] border transition-colors ${selectedKey === largeOpt.key ? "border-white bg-white/10 text-white" : "border-white/15 text-[#888] hover:border-white/35"}`}>
                        Large — ${largeOpt.price}
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            const price = servicePrice(s.key, sqftNum);
            return (
              <label key={s.key} className={`${tileCls} ${s.active ? "cursor-pointer" : ""} ${!checked && s.active ? "hover:bg-white/[0.02]" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" disabled={!s.active} checked={checked} onChange={() => toggleService(s.key)} className="accent-white w-3 h-3 shrink-0" />
                    <span className="text-xs text-[#aaa]">{s.label}</span>
                  </div>
                  {price !== null && <span className="text-[10px] text-[#444] shrink-0">${price}</span>}
                </div>
                {desc && <span className="text-[10px] text-[#444] ml-5">{desc}</span>}
              </label>
            );
          })}
        </div>
      </div>

      {/* Total + Submit */}
      {services.length > 0 && (
        <div className="border-t border-white/10 pt-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <span className="text-xs tracking-[3px] uppercase text-[#555]">Estimated Total</span>
            <span className="text-3xl font-black">{exact ? `$${total}` : `From $${total}`}</span>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading || !name || !email}
            className="bg-white text-black text-xs tracking-[3px] uppercase px-8 py-4 hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? "Sending..." : "Submit Quote"}
          </button>
        </div>
      )}
    </form>
  );
}
