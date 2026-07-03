"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

type Contact = { id: string; name: string; email: string | null; type: string; created_at: string; stage?: string };

type QuoteRecord = {
  id: string;
  contact_id: string | null;
  address: string | null;
  sqft: string | null;
  primary_service: string;
  primary_price: number;
  addons: { name: string; price: number }[];
  total: number;
  sent: boolean;
  sent_at: string | null;
  created_at: string;
  contacts: { name: string; email: string | null } | null;
};

const QB_PRIMARY = [
  { id: "listing_photos",      name: "Listing Photos",            tiers: [{ max: 1500, price: 200 }, { max: 2000, price: 250 }, { max: 2500, price: 300 }, { max: 3000, price: 350 }, { price: 400 }] },
  { id: "drone_photos",        name: "Drone Photos (Standalone)", tiers: [{ price: 200 }] },
  { id: "video_bronze",        name: "Video — Bronze",            tiers: [{ price: 200 }] },
  { id: "video_silver",        name: "Video — Silver (w/ Drone)", tiers: [{ price: 300 }] },
  { id: "matterport",          name: "Matterport 3D Tour",        tiers: [{ max: 2000, price: 200 }, { max: 3000, price: 300 }, { max: 4000, price: 400 }, { price: 500 }] },
  { id: "twilight_standalone", name: "Twilight (Standalone)",     tiers: [{ price: 400 }] },
  { id: "virtual_staging",     name: "Virtual Staging",           tiers: [{ price: 25 }] },
  { id: "floor_plan",          name: "Floor Plan",                tiers: [{ max: 2499, price: 50 }, { price: 75 }] },
  { id: "headshots_solo",      name: "Headshots — Solo",          tiers: [{ price: 200 }] },
];

const QB_ADDONS = [
  { id: "drone_5",          name: "Drone Photos (5)",            tiers: [{ price: 100 }],                                                                                   listingOnly: false },
  { id: "drone_10",         name: "Drone Photos (10)",           tiers: [{ price: 150 }],                                                                                   listingOnly: false },
  { id: "twilight_addon",   name: "Twilight Add-On (2 photos)",  tiers: [{ price: 150 }],                                                                                   listingOnly: true  },
  { id: "twilight_2nd",     name: "Twilight — 2nd Trip",         tiers: [{ price: 200 }],                                                                                   listingOnly: true  },
  { id: "matterport_addon", name: "Matterport (Add-On)",         tiers: [{ max: 2000, price: 100 }, { max: 3000, price: 150 }, { max: 4000, price: 200 }, { price: 250 }], listingOnly: false },
  { id: "floor_plan_addon", name: "Floor Plan",                  tiers: [{ max: 2499, price: 50 }, { price: 75 }],                                                         listingOnly: true  },
  { id: "virtual_staging",  name: "Virtual Staging (per photo)", tiers: [{ price: 25 }],                                                                                    listingOnly: true  },
];

function getPrice(tiers: { max?: number; price: number }[], sqft: number) {
  for (const t of tiers) { if (!t.max || sqft <= t.max) return t.price; }
  return tiers[tiers.length - 1].price;
}

export default function QuotesPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  // QB state
  const [qbAddress, setQbAddress] = useState("");
  const [qbSqft, setQbSqft] = useState("");
  const [qbPrimary, setQbPrimary] = useState<string | null>(null);
  const [qbAddons, setQbAddons] = useState<Set<string>>(new Set());
  const [qbContact, setQbContact] = useState<Contact | null>(null);
  const [qbContactSearch, setQbContactSearch] = useState("");
  const [qbShowDropdown, setQbShowDropdown] = useState(false);
  const [qbShowNewForm, setQbShowNewForm] = useState(false);
  const [qbNewName, setQbNewName] = useState("");
  const [qbNewEmail, setQbNewEmail] = useState("");
  const [qbCreating, setQbCreating] = useState(false);
  const [qbSaving, setQbSaving] = useState<"save" | "send" | null>(null);
  const [qbSaved, setQbSaved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setLoadingQuotes(true);
    const res = await fetch("/api/admin/quotes?all=1");
    if (res.ok) setQuotes(await res.json());
    setLoadingQuotes(false);
  }, []);

  useEffect(() => {
    async function load() {
      const { data: cs } = await supabase.from("contacts").select("id, name, email, type, created_at, stage").neq("stage", "deleted").order("name");
      setContacts(cs ?? []);
    }
    load();
    loadQuotes();
  }, [loadQuotes]);

  const sqftNum = parseFloat(qbSqft) || 0;
  const primarySvc = QB_PRIMARY.find(p => p.id === qbPrimary);
  const primaryPrice = primarySvc ? getPrice(primarySvc.tiers, sqftNum) : 0;
  const isListingPhotos = qbPrimary === "listing_photos";
  const visibleAddons = QB_ADDONS.filter(a => !a.listingOnly || isListingPhotos);
  const addonItems = QB_ADDONS.filter(a => qbAddons.has(a.id)).map(a => ({ name: a.name, price: getPrice(a.tiers, sqftNum) }));
  const total = primaryPrice + addonItems.reduce((s, a) => s + a.price, 0);

  const filteredContacts = contacts.filter(c =>
    qbContactSearch.length > 0 && c.name.toLowerCase().includes(qbContactSearch.toLowerCase())
  ).slice(0, 6);

  async function createAndTag() {
    if (!qbNewName.trim()) return;
    setQbCreating(true);
    const { data } = await supabase.from("contacts").insert({ name: qbNewName.trim(), email: qbNewEmail.trim() || null, type: "lead", stage: "new" }).select().single();
    if (data) { setContacts(cs => [data, ...cs]); setQbContact(data); setQbContactSearch(data.name); setQbShowNewForm(false); setQbNewName(""); setQbNewEmail(""); }
    setQbCreating(false);
  }

  async function submitQuote(asSent: boolean) {
    if (!primarySvc) return;
    setQbSaving(asSent ? "send" : "save");
    const res = await fetch("/api/admin/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: qbContact?.id ?? null, address: qbAddress || null, sqft: qbSqft || null, primary_service: primarySvc.name, primary_price: primaryPrice, addons: addonItems, total, sent: asSent }),
    });
    setQbSaving(null);
    if (res.ok) {
      setQbSaved(true);
      setTimeout(() => setQbSaved(false), 3000);
      loadQuotes();
    }
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10 gap-4">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <a href="/choose-portal" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Portals</a>
          <a href="/dashboard?page=apps" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Dashboard</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* LEFT — Quote Builder */}
        <div className="w-full md:w-[480px] shrink-0 border-r border-white/10 p-6 md:p-8 overflow-y-auto space-y-8">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-1">Quote Builder</p>
            <h1 className="text-2xl font-black tracking-tight uppercase">New Quote</h1>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Customer</p>
            {qbContact ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/5 border border-white/15 px-3 py-2 flex-1">
                  <span className="text-sm">{qbContact.name}</span>
                  {qbContact.email && <span className="text-xs text-[#555]">{qbContact.email}</span>}
                </div>
                <button onClick={() => { setQbContact(null); setQbContactSearch(""); }} className="text-xs text-[#555] hover:text-white transition-colors">✕</button>
              </div>
            ) : (
              <div className="relative">
                <input value={qbContactSearch} onChange={e => { setQbContactSearch(e.target.value); setQbShowDropdown(true); }} onFocus={() => setQbShowDropdown(true)}
                  placeholder="Search contact..." className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 w-full transition-colors" />
                {qbShowDropdown && filteredContacts.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-[#1a1a1a] border border-white/15 divide-y divide-white/5 shadow-xl">
                    {filteredContacts.map(c => (
                      <button key={c.id} onClick={() => { setQbContact(c); setQbContactSearch(c.name); setQbShowDropdown(false); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors">
                        <span className="text-sm">{c.name}</span>
                        <span className="text-xs text-[#555]">{c.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  {!qbShowNewForm ? (
                    <button onClick={() => setQbShowNewForm(true)} className="text-xs text-[#555] hover:text-white transition-colors">+ New contact</button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input value={qbNewName} onChange={e => setQbNewName(e.target.value)} placeholder="Name" className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2 outline-none focus:border-white/30 w-full transition-colors" />
                      <input value={qbNewEmail} onChange={e => setQbNewEmail(e.target.value)} placeholder="Email (optional)" className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2 outline-none focus:border-white/30 w-full transition-colors" />
                      <div className="flex gap-2">
                        <button onClick={createAndTag} disabled={qbCreating || !qbNewName.trim()} className="text-xs px-4 py-2 bg-white text-black disabled:opacity-40">{qbCreating ? "Creating..." : "Create"}</button>
                        <button onClick={() => setQbShowNewForm(false)} className="text-xs text-[#555] hover:text-white transition-colors">cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Address + Sqft */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Property Address</p>
              <input value={qbAddress} onChange={e => setQbAddress(e.target.value)} placeholder="123 Main St, City, TX"
                className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 w-full transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Square Footage / Acreage</p>
              <input value={qbSqft} onChange={e => setQbSqft(e.target.value)} placeholder="e.g. 2400"
                className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 w-full transition-colors" />
            </div>
          </div>

          {/* Primary Service */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Primary Service</p>
            <div className="flex flex-col gap-2">
              {QB_PRIMARY.map(svc => {
                const price = getPrice(svc.tiers, sqftNum);
                const sel = qbPrimary === svc.id;
                return (
                  <button key={svc.id} onClick={() => setQbPrimary(sel ? null : svc.id)}
                    className={`flex items-center justify-between px-4 py-3 border text-left transition-all ${sel ? "border-white bg-white/5" : "border-white/10 hover:border-white/30"}`}>
                    <span className="text-sm">{svc.name}</span>
                    <span className={`text-sm font-bold ${sel ? "text-white" : "text-[#555]"}`}>${price}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add-ons */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Add-Ons</p>
            <div className="flex flex-col gap-2">
              {visibleAddons.map(addon => {
                const price = getPrice(addon.tiers, sqftNum);
                const sel = qbAddons.has(addon.id);
                return (
                  <button key={addon.id} onClick={() => setQbAddons(prev => { const n = new Set(prev); sel ? n.delete(addon.id) : n.add(addon.id); return n; })}
                    className={`flex items-center justify-between px-4 py-3 border text-left transition-all ${sel ? "border-white bg-white/5" : "border-white/10 hover:border-white/30"}`}>
                    <span className="text-sm">{addon.name}</span>
                    <span className={`text-sm font-bold ${sel ? "text-white" : "text-[#555]"}`}>${price}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Total + actions */}
          {primarySvc && (
            <div className="border-t border-white/10 pt-6 space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-[#555]">
                  <span>{primarySvc.name}</span><span>${primaryPrice}</span>
                </div>
                {addonItems.map(a => (
                  <div key={a.name} className="flex justify-between text-xs text-[#555]">
                    <span>{a.name}</span><span>${a.price}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-3xl font-bold">${total.toLocaleString()}</p>
                <div className="flex gap-2">
                  <button onClick={() => submitQuote(false)} disabled={!!qbSaving}
                    className="text-xs tracking-[1px] uppercase px-4 py-2 border border-white/20 text-white hover:bg-white/5 transition-all disabled:opacity-40">
                    {qbSaving === "save" ? "Saving..." : qbSaved ? "Saved ✓" : "Save"}
                  </button>
                  <button onClick={() => submitQuote(true)} disabled={!!qbSaving || !qbContact}
                    title={!qbContact ? "Tag a client to send" : "Send HTML quote email (coming soon)"}
                    className="text-xs tracking-[1px] uppercase px-4 py-2 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {qbSaving === "send" ? "Sending..." : "Send Quote"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Quote History */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 md:px-8 py-6 border-b border-white/10 flex items-center justify-between">
            <p className="text-xs tracking-[4px] uppercase text-[#555]">Quote History</p>
            <span className="text-xs text-[#444]">{quotes.length} quote{quotes.length !== 1 ? "s" : ""}</span>
          </div>

          {loadingQuotes ? (
            <div className="flex items-center justify-center py-32">
              <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex items-center justify-center py-32">
              <p className="text-xs text-[#333]">No quotes saved yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {quotes.map(q => {
                const expanded = expandedId === q.id;
                const dt = new Date(q.created_at);
                return (
                  <div key={q.id} className="border-b border-white/5 last:border-0">
                    {/* Row header — always visible */}
                    <button
                      onClick={() => setExpandedId(expanded ? null : q.id)}
                      className="w-full px-6 md:px-8 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
                    >
                      {/* Expand chevron */}
                      <span className="text-[#444] text-xs shrink-0">{expanded ? "▾" : "▸"}</span>

                      {/* Client + address */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">
                            {q.contacts?.name ?? <span className="text-[#444] font-normal">No client</span>}
                          </span>
                          {q.address && <span className="text-xs text-[#555] truncate">{q.address}</span>}
                        </div>
                        <p className="text-[10px] text-[#444] mt-0.5">
                          {dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          {" · "}
                          {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>

                      {/* Sent status */}
                      <span className={`text-[10px] tracking-[1.5px] uppercase px-2 py-1 shrink-0 ${q.sent ? "bg-[#4ade80]/10 text-[#4ade80]" : "bg-white/5 text-[#555]"}`}>
                        {q.sent ? "Sent" : "Not Sent"}
                      </span>

                      {/* Total */}
                      <span className="text-base font-bold text-white shrink-0">${q.total?.toLocaleString()}</span>
                    </button>

                    {/* Expanded detail */}
                    {expanded && (
                      <div className="px-8 md:px-12 pb-6 pt-1 flex flex-col gap-3 bg-white/[0.015]">
                        {/* Line items */}
                        <div className="flex flex-col gap-1.5 border-l-2 border-white/10 pl-4">
                          <div className="flex justify-between text-xs">
                            <span className="text-white">{q.primary_service}</span>
                            <span className="text-[#888]">${q.primary_price}</span>
                          </div>
                          {(q.addons ?? []).map((a, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-[#666]">{a.name}</span>
                              <span className="text-[#666]">${a.price}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs border-t border-white/10 pt-1.5 mt-0.5">
                            <span className="text-white font-semibold">Total</span>
                            <span className="text-white font-semibold">${q.total?.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-col gap-1 text-[10px] text-[#444]">
                          {q.sqft && <span>Square footage: {q.sqft} sq ft</span>}
                          {q.contacts?.email && <span>Client email: {q.contacts.email}</span>}
                          <span>Created: {dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                          {q.sent && q.sent_at && (
                            <span>Sent: {new Date(q.sent_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at {new Date(q.sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                          )}
                          {!q.sent && <span className="text-[#555]">Not yet sent to client</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
