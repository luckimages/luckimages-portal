"use client";

import { useState } from "react";
import {
  PRIMARY_SERVICES,
  ADDONS,
  addonsFor,
  resolvePrice,
  type Addon,
  type PricingShape,
} from "@/lib/pricing";

function needsSqft(pricing: PricingShape) {
  return pricing.kind === "sqft";
}

function displayPrice(pricing: PricingShape, sel: { sqft?: number; optionKey?: string; count?: number }): string {
  if (needsSqft(pricing) && !sel.sqft) return "enter sq ft";
  const price = resolvePrice(pricing, sel);
  if (price === undefined) return "enter sq ft";
  if (price === "custom") return "Custom";
  return `$${price}`;
}

export default function QuoteGenerator() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sqft, setSqft] = useState("");
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [primaryOptionKey, setPrimaryOptionKey] = useState<string | null>(null);
  const [aerialCount, setAerialCount] = useState(10);
  const [addonOptionKeys, setAddonOptionKeys] = useState<Record<string, string>>({});
  const [addonCounts, setAddonCounts] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sqftNum = parseFloat(sqft) || 0;
  const primaryService = PRIMARY_SERVICES.find((s) => s.id === primaryId);
  const primaryPrice = primaryService
    ? resolvePrice(primaryService.pricing, { sqft: sqftNum, optionKey: primaryOptionKey ?? undefined, count: aerialCount })
    : null;
  const isCustom = primaryPrice === "custom";

  const compatibleAddons = primaryService ? addonsFor(primaryService.id) : [];
  const compatibleIds = new Set(compatibleAddons.map((a) => a.id));
  const sortedAddons = [...ADDONS].sort((a, b) => {
    const aOk = compatibleIds.has(a.id) ? 0 : 1;
    const bOk = compatibleIds.has(b.id) ? 0 : 1;
    return aOk - bOk;
  });

  const selectedAddons = compatibleAddons
    .filter((a) => a.id in addonOptionKeys || a.id in addonCounts)
    .map((a) => {
      const price = resolvePrice(a.pricing, {
        sqft: sqftNum,
        optionKey: addonOptionKeys[a.id],
        count: addonCounts[a.id],
      });
      return { name: a.name, price: typeof price === "number" ? price : 0 };
    });

  const total = (typeof primaryPrice === "number" ? primaryPrice : 0) + selectedAddons.reduce((sum, a) => sum + a.price, 0);

  function selectPrimary(id: string) {
    setPrimaryId((prev) => (prev === id ? null : id));
    setPrimaryOptionKey(null);
    setAerialCount(10);
    setAddonOptionKeys({});
    setAddonCounts({});
  }

  function toggleAddonOption(addon: Addon, optionKey: string) {
    setAddonOptionKeys((prev) => {
      const next = { ...prev };
      if (next[addon.id] === optionKey) delete next[addon.id];
      else next[addon.id] = optionKey;
      return next;
    });
  }

  function toggleSqftAddon(addon: Addon) {
    setAddonCounts((prev) => {
      const next = { ...prev };
      if (addon.id in next) delete next[addon.id];
      else next[addon.id] = sqftNum;
      return next;
    });
  }

  function toggleIncrementAddon(addon: Addon, baseCount: number) {
    setAddonCounts((prev) => {
      const next = { ...prev };
      if (addon.id in next) delete next[addon.id];
      else next[addon.id] = baseCount;
      return next;
    });
  }

  function bumpIncrementAddon(addon: Addon, delta: number, baseCount: number) {
    setAddonCounts((prev) => ({ ...prev, [addon.id]: Math.max(baseCount, (prev[addon.id] ?? baseCount) + delta) }));
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
          service: { name: primaryService.name, price: isCustom ? "Custom" : primaryPrice },
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

      {/* Primary Service — single-select */}
      <div className="flex flex-col gap-4">
        <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Primary Service <span className="normal-case text-[#444] tracking-normal">(choose one)</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRIMARY_SERVICES.map((s) => {
            const price = displayPrice(s.pricing, { sqft: sqftNum });
            const selected = primaryId === s.id;
            return (
              <button key={s.id} type="button" onClick={() => selectPrimary(s.id)}
                className={`flex items-center justify-between px-5 py-4 border text-left transition-all ${selected ? "border-white bg-white/5" : "border-white/15 hover:border-white/35"}`}>
                <span className="text-sm">{s.name}</span>
                <span className={`text-sm font-bold ml-4 shrink-0 ${selected ? "text-white" : "text-[#666]"}`}>
                  {price === "enter sq ft" ? <span className="text-[#444] font-normal text-xs">enter sq ft</span> : price}
                </span>
              </button>
            );
          })}
        </div>

        {/* Variant picker — only for primaries with more than one option */}
        {primaryService?.pricing.kind === "options" && primaryService.pricing.options.length > 1 && (
          <div className="flex flex-wrap gap-2 pl-1">
            {primaryService.pricing.options.map((opt) => (
              <button key={opt.key} type="button" onClick={() => setPrimaryOptionKey(opt.key)}
                className={`px-4 py-2 text-xs border transition-all ${primaryOptionKey === opt.key ? "border-white bg-white/10" : "border-white/15 hover:border-white/35"}`}>
                {opt.label} — {opt.price === "custom" ? "Custom" : `$${opt.price}`}
              </button>
            ))}
          </div>
        )}

        {/* Aerial Photos quantity stepper */}
        {primaryService?.pricing.kind === "base_increment" && (
          <div className="flex items-center gap-3 pl-1">
            <button type="button" onClick={() => setAerialCount((c) => Math.max(10, c - 5))}
              className="w-8 h-8 border border-white/15 hover:border-white/35 text-sm">−</button>
            <span className="text-xs text-[#888] w-24 text-center">{aerialCount} photos</span>
            <button type="button" onClick={() => setAerialCount((c) => c + 5)}
              className="w-8 h-8 border border-white/15 hover:border-white/35 text-sm">+</button>
          </div>
        )}
      </div>

      {/* Add-Ons — always shown; only the ones compatible with the selected
          primary rise to the top and light up. */}
      <div className="flex flex-col gap-4">
        <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Add-Ons</p>
        <div className="flex flex-col gap-3">
          {sortedAddons.map((a) => {
            const active = compatibleIds.has(a.id);
            return (
              <div key={a.id} className={`flex flex-col gap-2 transition-opacity ${active ? "" : "opacity-30 pointer-events-none"}`}>
                <span className="text-sm text-[#aaa]">{a.name}</span>
                {a.pricing.kind === "options" ? (
                  <div className="flex flex-wrap gap-2">
                    {a.pricing.options.map((opt) => {
                      const selected = addonOptionKeys[a.id] === opt.key;
                      return (
                        <button key={opt.key} type="button" disabled={!active} onClick={() => toggleAddonOption(a, opt.key)}
                          className={`px-4 py-2 text-xs border transition-all ${selected ? "border-white bg-white/10" : "border-white/15 hover:border-white/35"}`}>
                          {opt.label} — ${opt.price}
                        </button>
                      );
                    })}
                  </div>
                ) : a.pricing.kind === "base_increment" ? (
                  (() => {
                    const inc = a.pricing.increment;
                    const on = a.id in addonCounts;
                    return (
                      <div className="flex items-center gap-3">
                        <button type="button" disabled={!active} onClick={() => toggleIncrementAddon(a, inc.baseCount)}
                          className={`px-4 py-2 text-xs border transition-all ${on ? "border-white bg-white/10" : "border-white/15 hover:border-white/35"}`}>
                          {inc.baseLabel} — ${inc.basePrice}
                        </button>
                        {on && (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => bumpIncrementAddon(a, -inc.incrementCount, inc.baseCount)}
                              className="w-7 h-7 border border-white/15 hover:border-white/35 text-sm">−</button>
                            <span className="text-xs text-[#888] w-12 text-center">{addonCounts[a.id]}</span>
                            <button type="button" onClick={() => bumpIncrementAddon(a, inc.incrementCount, inc.baseCount)}
                              className="w-7 h-7 border border-white/15 hover:border-white/35 text-sm">+</button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <button type="button" disabled={!active || (needsSqft(a.pricing) && !sqftNum)} onClick={() => toggleSqftAddon(a)}
                    className={`flex items-center justify-between px-5 py-3 border text-left transition-all disabled:opacity-40 ${addonCounts[a.id] !== undefined ? "border-white bg-white/5" : "border-white/15 hover:border-white/35"}`}>
                    <span className="text-sm">Add</span>
                    <span className="text-sm font-bold">{displayPrice(a.pricing, { sqft: sqftNum })}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Total + Submit */}
      {primaryService && (
        <div className="border-t border-white/10 pt-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <span className="text-xs tracking-[3px] uppercase text-[#555]">Estimated Total</span>
            <span className="text-3xl font-black">{isCustom ? "Custom Quote" : `$${total}`}</span>
          </div>
          {selectedAddons.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-[#555]">
                <span>{primaryService.name}</span>
                <span>{isCustom ? "Custom" : `$${primaryPrice}`}</span>
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
          <button type="submit" disabled={loading || !name || !email}
            className="bg-white text-black text-xs tracking-[3px] uppercase px-8 py-4 hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? "Sending..." : "Submit Quote"}
          </button>
        </div>
      )}
    </form>
  );
}
