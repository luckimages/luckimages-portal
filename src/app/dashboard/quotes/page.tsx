"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

type Contact = { id: string; name: string; email: string | null; type: string; created_at: string; stage?: string };

type QuoteRecord = {
  id: string;
  contact_id: string;
  address: string | null;
  sqft: string | null;
  primary_service: string;
  primary_price: number;
  addons: { name: string; price: number }[];
  total: number;
  created_at: string;
  contacts: { name: string; email: string | null } | null;
};

const QB_PRIMARY = [
  { id: "listing_photos", name: "Listing Photos", tiers: [{ max: 2000, price: 225 }, { max: 3000, price: 275 }, { max: 4000, price: 325 }, { max: 5000, price: 375 }] },
  { id: "drone_photos", name: "Drone Photos", tiers: [{ price: 200 }] },
  { id: "video", name: "Video Walkthrough", tiers: [{ price: 399 }] },
  { id: "matterport", name: "Matterport 3D Tour", tiers: [{ max: 2000, price: 249 }, { max: 4000, price: 319 }, { price: 399 }] },
  { id: "twilight", name: "Twilight (Standalone)", tiers: [{ price: 299 }] },
  { id: "virtual_staging", name: "Virtual Staging", tiers: [{ price: 65 }] },
  { id: "floor_plan", name: "Floor Plan", tiers: [{ max: 3000, price: 149 }, { price: 199 }] },
  { id: "headshots", name: "Headshots", tiers: [{ price: 150 }] },
];

const QB_ADDONS = [
  { id: "drone_5", name: "Drone Photos (5)", tiers: [{ price: 100 }] },
  { id: "drone_10", name: "Drone Photos (10)", tiers: [{ price: 150 }] },
  { id: "drone_video", name: "Drone Video", tiers: [{ price: 150 }] },
  { id: "twilight_addon", name: "Twilight Add-On", tiers: [{ price: 150 }] },
  { id: "matterport_addon", name: "Matterport 3D Tour", tiers: [{ max: 2000, price: 249 }, { max: 4000, price: 319 }, { price: 399 }] },
  { id: "floor_plan_addon", name: "Floor Plan", tiers: [{ max: 3000, price: 149 }, { price: 199 }] },
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
  const [qbSaving, setQbSaving] = useState(false);
  const [qbSaved, setQbSaved] = useState(false);
  const [qbCopied, setQbCopied] = useState(false);

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

  async function saveQuote() {
    if (!qbContact || !primarySvc) return;
    setQbSaving(true);
    await fetch("/api/admin/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: qbContact.id, address: qbAddress || null, sqft: qbSqft || null, primary_service: primarySvc.name, primary_price: primaryPrice, addons: addonItems, total }),
    });
    setQbSaving(false);
    setQbSaved(true);
    setTimeout(() => setQbSaved(false), 3000);
    loadQuotes();
  }

  function copyQuote() {
    const lines = [
      qbContact ? `Client: ${qbContact.name}` : null,
      qbAddress ? `Address: ${qbAddress}` : null,
      qbSqft ? `Sq Ft: ${qbSqft}` : null,
      primarySvc ? `${primarySvc.name}: $${primaryPrice}` : null,
      ...addonItems.map(a => `${a.name} (add-on): $${a.price}`),
      `\nTotal: $${total.toLocaleString()}`,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines);
    setQbCopied(true);
    setTimeout(() => setQbCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10 gap-4">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <a href="/choose-portal" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Portals</a>
          <a href="/dashboard/beta" className="text-xs tracking-[2px] uppercase text-[#a78bfa] hover:text-white transition-colors">Beta</a>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Dashboard</a>
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
              {QB_ADDONS.map(addon => {
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
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold">${total.toLocaleString()}</p>
                <div className="flex gap-2">
                  <button onClick={copyQuote} className="text-xs tracking-[1px] uppercase px-4 py-2 border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-all">
                    {qbCopied ? "Copied ✓" : "Copy"}
                  </button>
                  {qbContact && (
                    <button onClick={saveQuote} disabled={qbSaving} className="text-xs tracking-[1px] uppercase px-4 py-2 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40">
                      {qbSaved ? "Saved ✓" : qbSaving ? "Saving..." : "Save"}
                    </button>
                  )}
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
              {quotes.map(q => (
                <div key={q.id} className="px-6 md:px-8 py-5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      {q.contacts?.name && (
                        <span className="text-sm font-semibold text-white">{q.contacts.name}</span>
                      )}
                      {q.address && (
                        <span className="text-xs text-[#555]">{q.address}</span>
                      )}
                    </div>
                    <span className="text-lg font-bold text-[#4ade80] shrink-0">${q.total?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xs text-[#666]">{q.primary_service} — ${q.primary_price}</span>
                    {q.sqft && <span className="text-xs text-[#444]">{q.sqft} sq ft</span>}
                    {q.addons?.length > 0 && (
                      <span className="text-xs text-[#444]">+ {q.addons.map(a => a.name).join(", ")}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#333] mt-2">
                    {new Date(q.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    {" · "}
                    {new Date(q.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
