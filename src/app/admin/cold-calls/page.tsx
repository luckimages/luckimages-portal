"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { normalizePhone } from "@/lib/format";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  stage: string;
};

type CallLog = {
  id: string;
  contact_id: string;
  called_at: string;
  outcome: string;
  notes: string | null;
  listing_address: string | null;
  called_by: string;
};

type LogTab = "all" | "interested" | "call_again" | "dead";

function buildPitchHtml(firstName: string): string {
  const BASE = "https://luckimages.com";
  const HERO_IMG = "https://images.squarespace-cdn.com/content/v1/61213811ee51ff1fda7a3bc4/97b5ff64-2aa4-43d2-a8a1-18af3072bbee/banner-1.jpg";

  const serviceRow = (label: string, price: string, href: string) =>
    `<tr>
      <td style="padding:11px 0;font-size:13px;border-bottom:1px solid #1e1e1e;">
        <a href="${href}" style="color:#ccc;text-decoration:none;">${label} <span style="font-size:10px;color:#444;">↗</span></a>
      </td>
      <td style="padding:11px 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;border-bottom:1px solid #1e1e1e;">${price}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <tr><td style="padding:0;">
    <div style="background-image:url(${HERO_IMG});background-size:cover;background-position:center;padding:64px 32px 56px;text-align:center;position:relative;">
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);"></div>
      <div style="position:relative;z-index:1;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.5);">Real Estate Media · Austin, TX</p>
        <h1 style="margin:0 0 20px;font-size:44px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;color:#fff;line-height:1;">LUCK IMAGES</h1>
        <p style="margin:0 auto 32px;font-size:14px;line-height:1.8;color:rgba(255,255,255,0.75);max-width:400px;">Hey ${firstName}, thanks for taking the time to chat. Here's everything we offer — reach out whenever a listing comes up and we'll get you taken care of.</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="padding-right:10px;">
              <a href="${BASE}/pricing" style="display:inline-block;background:#fff;color:#000;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 24px;text-decoration:none;">View Pricing →</a>
            </td>
            <td>
              <a href="${BASE}" style="display:inline-block;border:1px solid rgba(255,255,255,0.4);color:#fff;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:13px 24px;text-decoration:none;">Our Work →</a>
            </td>
          </tr>
        </table>
      </div>
    </div>
  </td></tr>

  <tr><td style="padding:32px;">
    <div style="background:rgba(0,0,0,0.75);border:1px solid #222;padding:28px;">
      <p style="margin:0 0 20px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#555;">Services &amp; Starting Prices</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${serviceRow("Listing Photos", "from $150", `${BASE}/photo`)}
        ${serviceRow("Aerial Photography", "$100 add-on · $200 solo", `${BASE}/drone`)}
        ${serviceRow("Matterport 3D Tour", "$150", `${BASE}/360`)}
        ${serviceRow("Twilight Photography", "$100 add-on · $200 solo", `${BASE}/twilight`)}
        ${serviceRow("Virtual Staging", "$30 / image", `${BASE}/virtual-staging`)}
        ${serviceRow("Walk-Through Video", "contact for pricing", `${BASE}/reels`)}
        <tr>
          <td style="padding:11px 0 0;font-size:13px;color:#ccc;">Floor Plan</td>
          <td style="padding:11px 0 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;">$50</td>
        </tr>
      </table>
      <p style="margin:18px 0 0;font-size:11px;color:#444;">Photos scale with sq ft. Next-day delivery. Same-day rush available.</p>
    </div>
  </td></tr>

  <tr><td style="border-top:1px solid #1a1a1a;padding:24px 32px 40px;">
    <p style="margin:0;font-size:13px;color:#888;line-height:1.7;">Ready to book or have questions? Just reply — I can usually get out within 24–48 hours.</p>
    <p style="margin:16px 0 0;font-size:13px;color:#fff;font-weight:700;">Ryan Luck</p>
    <p style="margin:2px 0 0;font-size:11px;color:#444;">Luck Images · ryan@luckimages.com · luckimages.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export default function ColdCallsPageWrapper() {
  return <Suspense><ColdCallsPage /></Suspense>;
}

function ColdCallsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);

  const [weekCalls, setWeekCalls] = useState(0);
  const [weekLeads, setWeekLeads] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const DAILY_GOAL = 20;

  const [zillow, setZillow] = useState("");
  const [zillowLoading, setZillowLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [addressFromZillow, setAddressFromZillow] = useState(false);

  const [contact, setContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "", brokerage: "" });
  const [contactMode, setContactMode] = useState<"none" | "new" | "search">("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [contactInput, setContactInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);

  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const [showPitch, setShowPitch] = useState(false);
  const [pitchSubject, setPitchSubject] = useState("Real Estate Photography — Luck Images");
  const [sendingPitch, setSendingPitch] = useState(false);
  const [pitchSent, setPitchSent] = useState(false);
  const [pitchContact, setPitchContact] = useState<Contact | null>(null);

  const [logTab, setLogTab] = useState<LogTab>("all");
  const [callerName, setCallerName] = useState("ryan");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: cs }, { data: logs }] = await Promise.all([
      supabase.from("contacts").select("id,name,email,phone,brokerage,stage").order("name"),
      supabase.from("cold_calls").select("*").order("called_at", { ascending: false }),
    ]);
    setContacts(cs || []);
    setCallLogs(logs || []);

    const today = new Date().toISOString().split("T")[0];
    setTodayCount((logs || []).filter((l: CallLog) => l.called_at.startsWith(today)).length);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const wl = (logs || []).filter((l: CallLog) => new Date(l.called_at) >= weekStart);
    setWeekCalls(wl.length);
    setWeekLeads(wl.filter((l: CallLog) => l.outcome === "interested").length);

    const pid = searchParams.get("contact");
    if (pid && cs) {
      const found = (cs as Contact[]).find(c => c.id === pid);
      if (found) setContact(found);
    }
  }, [searchParams]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
      else setCallerName(data.user.email?.split("@")[0] || "ryan");
    });
    loadData();
  }, [router, loadData]);

  async function importZillow() {
    if (!zillow.trim()) return;
    setZillowLoading(true);
    try {
      const res = await fetch("/api/admin/zillow-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: zillow }),
      });
      const data = await res.json();
      if (data.address) { setAddress(data.address); setAddressFromZillow(true); }
      if (data.agentName && !contact) {
        setContactForm({
          name: data.agentName,
          phone: data.agentPhone || "",
          email: "",
          brokerage: data.brokerage || "",
        });
        setContactMode("new");
      }
    } catch { /* ignore */ }
    setZillow("");
    setZillowLoading(false);
  }

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactForm.name.trim()) return;
    const supabase = createClient();
    const { data } = await supabase.from("contacts").insert({
      name: contactForm.name,
      phone: normalizePhone(contactForm.phone),
      email: contactForm.email || null,
      brokerage: contactForm.brokerage || null,
      stage: "lead",
      type: "lead",
    }).select().single();
    if (data) setContact(data as Contact);
    setContactMode("none");
    await loadData();
  }

  async function logCall(outcome: "call_again" | "interested" | "dead") {
    if (!contact) return;
    setLogging(true);
    const supabase = createClient();
    await supabase.from("cold_calls").insert({
      contact_id: contact.id,
      outcome,
      notes: notes || null,
      listing_address: address || null,
      called_by: callerName,
    });
    const stageMap: Record<string, string> = {
      interested: "interested",
      dead: "dead",
      call_again: "follow-up",
    };
    await supabase.from("contacts").update({ stage: stageMap[outcome] }).eq("id", contact.id);
    setLogging(false);

    showFlash(
      outcome === "interested" ? "Logged as interested 🔥" :
      outcome === "call_again" ? "Logged — will call again" : "Marked dead"
    );

    setNotes("");
    setAddress("");
    setAddressFromZillow(false);
    setContact(null);
    setContactMode("none");
    setContactForm({ name: "", phone: "", email: "", brokerage: "" });
    await loadData();
  }

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  async function sendPitch() {
    const target = pitchContact;
    if (!target?.email) return;
    setSendingPitch(true);
    const firstName = target.name.split(" ")[0];
    await fetch("/api/admin/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: target.id,
        to: target.email,
        subject: pitchSubject,
        html: buildPitchHtml(firstName),
        body: `Hi ${firstName},\n\nThanks for the call. Sending our full pricing + portfolio at luckimages.com.\n\nRyan Luck\nLuck Images`,
      }),
    });
    setSendingPitch(false);
    setPitchSent(true);
    showFlash("Pitch email sent ✓");
  }

  // ── Derived ────────────────────────────────────────────────────
  const callAgainCounts: Record<string, number> = {};
  callLogs.forEach(l => {
    if (l.outcome === "call_again") callAgainCounts[l.contact_id] = (callAgainCounts[l.contact_id] || 0) + 1;
  });

  type EnrichedLog = CallLog & { contact: Contact | undefined; attempts: number };
  const enrichedLogs: EnrichedLog[] = callLogs.map(l => ({
    ...l,
    contact: contacts.find(c => c.id === l.contact_id),
    attempts: callAgainCounts[l.contact_id] || 0,
  }));

  // Latest call per contact for bucketed tabs
  const latestByContact: Record<string, EnrichedLog> = {};
  enrichedLogs.forEach(l => {
    if (!latestByContact[l.contact_id]) latestByContact[l.contact_id] = l;
  });
  const latestLogs = Object.values(latestByContact);

  const tabLogs: Record<LogTab, EnrichedLog[]> = {
    all: enrichedLogs.slice(0, 50),
    interested: latestLogs.filter(l => l.outcome === "interested"),
    call_again: latestLogs.filter(l => l.outcome === "call_again").sort((a, b) => b.attempts - a.attempts),
    dead: latestLogs.filter(l => l.outcome === "dead"),
  };

  const TAB_LABELS: Record<LogTab, string> = {
    all: "All",
    interested: `Interested (${tabLogs.interested.length})`,
    call_again: `Call Again (${tabLogs.call_again.length})`,
    dead: `Dead (${tabLogs.dead.length})`,
  };

  const filteredContacts = contacts.filter(c =>
    searchQuery &&
    (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (c.brokerage || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
     (c.phone || "").includes(searchQuery))
  );

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">

      {/* Header */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-[#555] text-sm hover:text-white transition-colors">
            ← Back
          </button>
          <h1 className="text-sm font-bold tracking-[3px] uppercase">Cold Calls</h1>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[#222] overflow-hidden">
              <div className="h-full bg-[#4ade80] transition-all" style={{ width: `${Math.min((todayCount / DAILY_GOAL) * 100, 100)}%` }} />
            </div>
            <span className="text-xs font-bold text-[#4ade80] tabular-nums">{todayCount}/{DAILY_GOAL} today</span>
          </div>
          <select value={callerName} onChange={e => setCallerName(e.target.value)}
            className="bg-[#181818] border border-white/10 px-2 py-1 text-xs text-white focus:outline-none">
            <option value="ryan">Ryan</option>
            <option value="leif">Leif</option>
          </select>
        </div>
      </div>

      {/* Week stats */}
      <div className="border-b border-white/10 bg-[#0e0e0e] px-4 md:px-8 py-3 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums">{weekCalls}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">calls this week</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#4ade80]">{weekLeads}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">interested</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#fbbf24]">
            {weekCalls > 0 ? Math.round((weekLeads / weekCalls) * 100) : 0}%
          </span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">conversion</span>
        </div>
      </div>

      {/* Flash */}
      {flash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#4ade80] text-black text-xs font-bold tracking-[2px] uppercase px-6 py-3 shadow-xl pointer-events-none">
          {flash}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* ═══ LEFT: Dialer ═══ */}
        <div className="space-y-4">
          <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            New Call
          </p>

          {/* Zillow import */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-3">
            <p className="text-xs tracking-[2px] uppercase text-[#555]">Zillow Listing URL</p>
            <div className="flex gap-2">
              <input
                value={zillow}
                onChange={e => setZillow(e.target.value)}
                onKeyDown={e => e.key === "Enter" && importZillow()}
                placeholder="https://zillow.com/homedetails/..."
                className="flex-1 bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
              />
              <button
                onClick={importZillow}
                disabled={zillowLoading || !zillow.trim()}
                className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all disabled:opacity-40 shrink-0"
              >
                {zillowLoading ? "..." : "Import"}
              </button>
            </div>
            {addressFromZillow && address ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[#4ade80]">📍 {address}</p>
                <button onClick={() => { setAddress(""); setAddressFromZillow(false); }} className="text-[#444] hover:text-white text-xs">✕</button>
              </div>
            ) : (
              <input
                value={address}
                onChange={e => { setAddress(e.target.value); setAddressFromZillow(false); }}
                placeholder="Or type address manually..."
                className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
              />
            )}
          </div>

          {/* Contact */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-3">
            <p className="text-xs tracking-[2px] uppercase text-[#555]">Agent / Contact</p>

            {contact ? (
              <div className="bg-[#181818] border border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{contact.name}</p>
                    {contact.brokerage && <p className="text-xs text-[#555] mt-0.5">{contact.brokerage}</p>}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="text-sm text-[#4ade80] mt-1.5 block font-mono tracking-wide">
                        {contact.phone}
                      </a>
                    )}
                    {contact.email && <p className="text-xs text-[#444] mt-0.5">{contact.email}</p>}
                    {callAgainCounts[contact.id] > 0 && (
                      <p className="text-xs text-[#fbbf24] mt-1.5">
                        📞 {callAgainCounts[contact.id]} previous attempt{callAgainCounts[contact.id] !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setContact(null); setContactForm({ name: "", phone: "", email: "", brokerage: "" }); setContactMode("none"); }}
                    className="text-[#444] hover:text-white text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Unified search + create input */}
                <div className="relative">
                  <input
                    autoFocus
                    value={contactInput}
                    onChange={e => {
                      setContactInput(e.target.value);
                      setShowDropdown(true);
                      setCreatingNew(false);
                      setContactForm(f => ({ ...f, name: e.target.value }));
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    placeholder="Type agent name, brokerage, or phone..."
                    className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
                  />
                  {showDropdown && contactInput.trim().length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 bg-[#181818] border border-white/10 border-t-0 max-h-52 overflow-y-auto divide-y divide-white/5">
                      {contacts.filter(c =>
                        c.name.toLowerCase().includes(contactInput.toLowerCase()) ||
                        (c.brokerage || "").toLowerCase().includes(contactInput.toLowerCase()) ||
                        (c.phone || "").includes(contactInput)
                      ).slice(0, 8).map(c => (
                        <button
                          key={c.id}
                          onMouseDown={() => {
                            setContact(c);
                            setContactInput("");
                            setShowDropdown(false);
                            setCreatingNew(false);
                          }}
                          className="w-full text-left px-3 py-2.5 text-xs hover:bg-white/5 transition-colors"
                        >
                          <span className="font-medium text-white">{c.name}</span>
                          {c.brokerage && <span className="text-[#555] ml-2">{c.brokerage}</span>}
                          {c.phone && <span className="text-[#333] ml-2">{c.phone}</span>}
                          {callAgainCounts[c.id] > 0 && (
                            <span className="text-[#fbbf24] ml-2">({callAgainCounts[c.id]}x called)</span>
                          )}
                        </button>
                      ))}
                      {/* Create new option always at bottom */}
                      <button
                        onMouseDown={() => {
                          setCreatingNew(true);
                          setShowDropdown(false);
                          setContactForm(f => ({ ...f, name: contactInput }));
                        }}
                        className="w-full text-left px-3 py-2.5 text-xs text-[#4ade80] hover:bg-white/5 transition-colors"
                      >
                        + Create &quot;{contactInput}&quot; as new contact
                      </button>
                    </div>
                  )}
                </div>

                {/* New contact extra fields — shown inline after picking "Create new" */}
                {creatingNew && (
                  <form onSubmit={async e => {
                    e.preventDefault();
                    await createContact(e);
                    setCreatingNew(false);
                    setContactInput("");
                  }} className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                      <input value={contactForm.brokerage} onChange={e => setContactForm(f => ({ ...f, brokerage: e.target.value }))}
                        placeholder="Brokerage"
                        className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    </div>
                    <input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="Email (optional)"
                      className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => { setCreatingNew(false); setContactInput(""); setContactForm({ name: "", phone: "", email: "", brokerage: "" }); }}
                        className="text-xs px-3 py-2 border border-white/10 text-[#555] hover:text-white transition-colors">
                        Cancel
                      </button>
                      <button type="submit"
                        className="flex-1 text-xs tracking-[1px] uppercase bg-white text-black py-2 hover:bg-[#ddd] transition-colors font-bold">
                        Save &amp; Select
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-[#111] border border-white/10 p-5">
            <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">
              Notes <span className="normal-case tracking-normal text-[#333]">(optional)</span>
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="What happened on the call..."
              className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 resize-none placeholder:text-[#333]"
            />
          </div>

          {/* Outcome buttons */}
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-3">Log Outcome</p>
            <div className="grid grid-cols-3 gap-2">

              <button
                onClick={() => logCall("call_again")}
                disabled={!contact || logging}
                className="py-5 border border-white/10 text-xs font-bold tracking-[1px] uppercase text-[#fbbf24] hover:bg-[#fbbf24]/10 hover:border-[#fbbf24]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center gap-2"
              >
                <span className="text-2xl">📞</span>
                <span>Call Again</span>
                {contact && callAgainCounts[contact.id] > 0 && (
                  <span className="text-[10px] text-[#fbbf24]/50 font-normal tracking-normal normal-case">
                    attempt #{callAgainCounts[contact.id] + 1}
                  </span>
                )}
              </button>

              <button
                onClick={() => logCall("interested")}
                disabled={!contact || logging}
                className="py-5 border border-white/10 text-xs font-bold tracking-[1px] uppercase text-[#4ade80] hover:bg-[#4ade80]/10 hover:border-[#4ade80]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center gap-2"
              >
                <span className="text-2xl">🔥</span>
                <span>Interested</span>
                <span className="text-[10px] text-[#4ade80]/50 font-normal tracking-normal normal-case">log &amp; follow up later</span>
              </button>

              <button
                onClick={() => logCall("dead")}
                disabled={!contact || logging}
                className="py-5 border border-white/10 text-xs font-bold tracking-[1px] uppercase text-[#555] hover:bg-red-900/20 hover:border-red-800/30 hover:text-red-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center gap-2"
              >
                <span className="text-2xl">💀</span>
                <span>Dead</span>
                <span className="text-[10px] font-normal tracking-normal normal-case">not interested</span>
              </button>

            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Log ═══ */}
        <div className="space-y-4">
          <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Call Log
          </p>

          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-white/10">
            {(["all", "interested", "call_again", "dead"] as LogTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setLogTab(tab)}
                className={`px-4 py-2.5 text-xs tracking-[1px] uppercase whitespace-nowrap transition-colors border-b-2 ${
                  logTab === tab ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          <div className="bg-[#111] border border-white/10 divide-y divide-white/5 max-h-[580px] overflow-y-auto">
            {tabLogs[logTab].length === 0 ? (
              <p className="px-5 py-10 text-xs text-[#333] italic text-center">Nothing here yet.</p>
            ) : tabLogs[logTab].map((log: EnrichedLog) => {
              const colors: Record<string, string> = {
                interested: "text-[#4ade80] bg-[#4ade80]/10",
                call_again: "text-[#fbbf24] bg-[#fbbf24]/10",
                dead: "text-[#444] bg-white/5",
              };
              const labels: Record<string, string> = {
                interested: "Interested",
                call_again: log.attempts > 1 ? `Call Again ×${log.attempts}` : "Call Again",
                dead: "Dead",
              };
              return (
                <div key={log.id} className="px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => log.contact && setContact(log.contact)}
                        className="text-sm font-medium truncate hover:underline text-left"
                      >
                        {log.contact?.name || "Unknown"}
                      </button>
                      {log.contact && (
                        <a
                          href={`/admin/contacts/${log.contact.id}`}
                          className="text-[10px] text-[#444] hover:text-white transition-colors shrink-0"
                          title="View profile"
                        >
                          ↗
                        </a>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-semibold tracking-wide uppercase ${colors[log.outcome] || "text-[#444] bg-white/5"}`}>
                      {labels[log.outcome] || log.outcome}
                    </span>
                  </div>
                  {log.contact?.brokerage && <p className="text-xs text-[#444]">{log.contact.brokerage}</p>}
                  {log.listing_address && <p className="text-xs text-[#444]">📍 {log.listing_address}</p>}
                  {log.notes && <p className="text-xs text-[#444] italic mt-0.5">"{log.notes}"</p>}
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[10px] text-[#333]">
                      {new Date(log.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {log.called_by}
                    </p>
                    <div className="flex items-center gap-3">
                      {log.contact && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setPitchContact(log.contact!);
                            setPitchSent(false);
                            setPitchSubject("Real Estate Photography — Luck Images");
                            setShowPitch(true);
                          }}
                          className="text-[10px] tracking-[1px] uppercase font-semibold px-2.5 py-1 border border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/10 transition-colors"
                        >
                          ✉ Email Follow-up
                        </button>
                      )}
                      {log.outcome === "call_again" && log.contact?.phone && (
                        <a href={`tel:${log.contact.phone}`} onClick={e => e.stopPropagation()}
                          className="text-[10px] text-[#fbbf24] hover:underline">
                          📞 call
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pitch email modal */}
      {showPitch && pitchContact && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
          onClick={() => !sendingPitch && setShowPitch(false)}>
          <div className="bg-[#111] border border-white/15 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-xs font-bold tracking-[3px] uppercase">Send Pitch Email</p>
                <p className="text-xs text-[#555] mt-0.5">Pricing · portfolio · portal</p>
              </div>
              <button onClick={() => setShowPitch(false)} className="text-[#555] hover:text-white text-lg leading-none">✕</button>
            </div>

            {pitchSent ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-4xl">✓</p>
                <p className="text-sm font-semibold text-[#4ade80]">Sent to {pitchContact.email}</p>
                <button onClick={() => setShowPitch(false)}
                  className="mt-2 text-xs tracking-[2px] uppercase border border-white/10 px-6 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all">
                  Close
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="bg-[#181818] border border-white/10 px-4 py-3">
                  <p className="text-xs text-[#555] mb-0.5">To</p>
                  <p className="text-sm font-semibold">{pitchContact.name}</p>
                  {pitchContact.email
                    ? <p className="text-xs text-[#4ade80] mt-0.5">{pitchContact.email}</p>
                    : <p className="text-xs text-[#fbbf24] mt-0.5">⚠ No email — add one to the contact first</p>
                  }
                </div>
                <div>
                  <p className="text-xs text-[#555] mb-1.5 tracking-[1px] uppercase">Subject</p>
                  <input value={pitchSubject} onChange={e => setPitchSubject(e.target.value)}
                    className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
                </div>
                <div className="bg-[#0d0d0d] border border-white/5 p-4 space-y-1.5">
                  {[
                    "Full pricing table (all services)",
                    "Portfolio link — luckimages.com",
                    "Client portal overview + link",
                    "Personal sign-off from Ryan",
                  ].map(item => (
                    <p key={item} className="text-xs text-[#777] flex items-center gap-2">
                      <span className="text-[#4ade80]">✓</span>{item}
                    </p>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowPitch(false)}
                    className="flex-1 py-3 text-xs tracking-[1px] uppercase border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-all">
                    Skip
                  </button>
                  <button onClick={sendPitch} disabled={sendingPitch || !pitchContact.email}
                    className="flex-1 py-3 text-xs tracking-[2px] uppercase font-bold bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-40">
                    {sendingPitch ? "Sending..." : "Send →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
