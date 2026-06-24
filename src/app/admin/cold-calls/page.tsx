"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

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
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Luck Images — Real Estate Media</title>
</head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr><td style="padding-bottom:32px;border-bottom:1px solid #222;">
          <p style="margin:0;font-size:22px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#fff;">LUCK IMAGES</p>
          <p style="margin:4px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#555;">Real Estate Media · Austin, TX</p>
        </td></tr>

        <tr><td style="padding:32px 0 24px;">
          <p style="margin:0 0 16px;font-size:15px;color:#aaa;">Hi ${firstName},</p>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#ccc;">
            Thanks for taking my call. Here's our full service menu and pricing — plus a look at how the client portal works for media delivery.
          </p>
        </td></tr>

        <tr><td style="padding-bottom:32px;">
          <p style="margin:0 0 16px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;border-bottom:1px solid #222;padding-bottom:10px;">Services &amp; Pricing</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr style="border-bottom:1px solid #1a1a1a;">
              <td style="padding:12px 0;font-size:13px;color:#fff;">Interior / Exterior Photos</td>
              <td style="padding:12px 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;">$175</td>
            </tr>
            <tr style="border-bottom:1px solid #1a1a1a;">
              <td style="padding:12px 0;font-size:13px;color:#fff;">Drone Photos + Lot Lines</td>
              <td style="padding:12px 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;">$200</td>
            </tr>
            <tr style="border-bottom:1px solid #1a1a1a;">
              <td style="padding:12px 0;font-size:13px;color:#fff;">Photo + Drone Package</td>
              <td style="padding:12px 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;">$325</td>
            </tr>
            <tr style="border-bottom:1px solid #1a1a1a;">
              <td style="padding:12px 0;font-size:13px;color:#fff;">Video Walkthrough</td>
              <td style="padding:12px 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;">$250</td>
            </tr>
            <tr style="border-bottom:1px solid #1a1a1a;">
              <td style="padding:12px 0;font-size:13px;color:#fff;">Matterport 3D Tour</td>
              <td style="padding:12px 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;">$225</td>
            </tr>
            <tr style="border-bottom:1px solid #1a1a1a;">
              <td style="padding:12px 0;font-size:13px;color:#fff;">Twilight Shoot</td>
              <td style="padding:12px 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;">$250</td>
            </tr>
            <tr>
              <td style="padding:12px 0;font-size:13px;color:#fff;font-weight:700;">Full Package <span style="font-weight:400;color:#666;font-size:11px;">(Photos + Drone + Video + 3D)</span></td>
              <td style="padding:12px 0;font-size:15px;color:#4ade80;text-align:right;font-weight:900;">$750</td>
            </tr>
          </table>
          <p style="margin:12px 0 0;font-size:11px;color:#444;">All shoots include next-day delivery. Rush same-day available.</p>
        </td></tr>

        <tr><td style="padding-bottom:32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;">
            <tr><td style="padding:24px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;">Client Portal</p>
              <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#fff;">Your media, delivered instantly</p>
              <p style="margin:0 0 16px;font-size:13px;color:#888;line-height:1.6;">Every client gets a private portal to download full-res photos, drone footage, and walkthroughs the moment they're ready.</p>
              <a href="https://luckimages-portal.vercel.app" style="display:inline-block;background:#fff;color:#000;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:12px 24px;text-decoration:none;">View Portal →</a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding-bottom:40px;">
          <p style="margin:0 0 16px;font-size:13px;color:#888;line-height:1.6;">See the work first at <a href="https://luckimages.com" style="color:#4ade80;text-decoration:none;">luckimages.com</a> — aerial lot shots, twilight packages, full walkthroughs.</p>
          <a href="https://luckimages.com" style="display:inline-block;border:1px solid #333;color:#fff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:12px 24px;text-decoration:none;">View Portfolio →</a>
        </td></tr>

        <tr><td style="border-top:1px solid #1a1a1a;padding-top:24px;">
          <p style="margin:0;font-size:13px;color:#aaa;line-height:1.7;">Ready to book or have questions? Just reply or call me directly. I can usually get out within 24–48 hours.</p>
          <p style="margin:20px 0 0;font-size:13px;color:#fff;font-weight:700;">Ryan Luck</p>
          <p style="margin:2px 0 0;font-size:12px;color:#555;">Luck Images · ryan@luckimages.com · luckimages.com</p>
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

  const [contact, setContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "", brokerage: "" });
  const [contactMode, setContactMode] = useState<"none" | "new" | "search">("none");
  const [searchQuery, setSearchQuery] = useState("");

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
      if (data.address) setAddress(data.address);
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
      phone: contactForm.phone || null,
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

    if (outcome === "interested") {
      setPitchSent(false);
      setPitchSubject("Real Estate Photography — Luck Images");
      setPitchContact(contact);
      setShowPitch(true);
    } else {
      showFlash(outcome === "call_again" ? "Logged — will call again" : "Marked dead");
    }

    setNotes("");
    setAddress("");
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
            {address ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[#4ade80]">📍 {address}</p>
                <button onClick={() => setAddress("")} className="text-[#444] hover:text-white text-xs">✕</button>
              </div>
            ) : (
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
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
            ) : contactMode === "new" ? (
              <form onSubmit={createContact} className="space-y-2">
                <input required autoFocus
                  value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Agent name *"
                  className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone"
                    className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                  <input value={contactForm.brokerage} onChange={e => setContactForm(f => ({ ...f, brokerage: e.target.value }))}
                    placeholder="Brokerage"
                    className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                </div>
                <input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Email (for pitch email)"
                  className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                <div className="flex gap-2 pt-1">
                  <button type="button"
                    onClick={() => { setContactMode("none"); setContactForm({ name: "", phone: "", email: "", brokerage: "" }); }}
                    className="text-xs px-3 py-2 border border-white/10 text-[#555] hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 text-xs tracking-[1px] uppercase bg-white text-black py-2 hover:bg-[#ddd] transition-colors font-bold">
                    Save &amp; Select
                  </button>
                </div>
              </form>
            ) : contactMode === "search" ? (
              <div className="space-y-2">
                <input autoFocus
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Name, brokerage, or phone..."
                  className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
                />
                {searchQuery && (
                  <div className="bg-[#181818] border border-white/10 max-h-44 overflow-y-auto divide-y divide-white/5">
                    {filteredContacts.length === 0 && <p className="px-3 py-3 text-xs text-[#444]">No results</p>}
                    {filteredContacts.slice(0, 8).map(c => (
                      <button key={c.id}
                        onClick={() => { setContact(c); setContactMode("none"); setSearchQuery(""); }}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-white/5 transition-colors">
                        <span className="font-medium">{c.name}</span>
                        {c.brokerage && <span className="text-[#555] ml-2">{c.brokerage}</span>}
                        {callAgainCounts[c.id] > 0 && (
                          <span className="text-[#fbbf24] ml-2">({callAgainCounts[c.id]}x tried)</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => { setContactMode("none"); setSearchQuery(""); }}
                  className="text-xs text-[#444] hover:text-white transition-colors">Cancel</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setContactMode("new")}
                  className="flex-1 text-xs tracking-[1px] uppercase border border-white/10 px-3 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all">
                  + New contact
                </button>
                <button onClick={() => setContactMode("search")}
                  className="flex-1 text-xs tracking-[1px] uppercase border border-white/10 px-3 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all">
                  Search existing
                </button>
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
                <span className="text-[10px] text-[#4ade80]/50 font-normal tracking-normal normal-case">sends pitch email</span>
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
                <div key={log.id}
                  className="px-4 py-3.5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => log.contact && setContact(log.contact)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{log.contact?.name || "Unknown"}</span>
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
                      {log.outcome === "interested" && log.contact && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setPitchContact(log.contact!);
                            setPitchSent(false);
                            setPitchSubject("Real Estate Photography — Luck Images");
                            setShowPitch(true);
                          }}
                          className="text-[10px] text-[#4ade80] hover:underline"
                        >
                          ✉ pitch
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
