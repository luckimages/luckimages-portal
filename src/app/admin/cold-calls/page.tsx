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
  is_hot: boolean;
  notes: string | null;
};

type CallLog = {
  id: string;
  contact_id: string;
  called_at: string;
  outcome: string;
  notes: string | null;
  listing_address: string | null;
  callback_at: string | null;
  called_by: string;
};

const OUTCOMES = [
  { value: "no_answer",     label: "No Answer",      color: "bg-zinc-700 text-zinc-300" },
  { value: "not_interested",label: "Not Interested",  color: "bg-red-900 text-red-300" },
  { value: "interested",    label: "Interested",      color: "bg-blue-900 text-blue-300" },
  { value: "callback",      label: "Callback",        color: "bg-yellow-900 text-yellow-300" },
  { value: "booked",        label: "Booked!",         color: "bg-green-900 text-green-300" },
];

const SERVICES = [
  { label: "Drone Photos (Lot Lines)", price: 200 },
  { label: "Interior/Exterior Photos", price: 175 },
  { label: "Photo + Drone Package",    price: 325 },
  { label: "Video Walkthrough",        price: 250 },
  { label: "Matterport 3D Tour",       price: 225 },
  { label: "Twilight Shoot",           price: 250 },
  { label: "Full Package",             price: 750 },
  { label: "Custom",                   price: 0 },
];

function buildPitchHtml(firstName: string, email: string): string {
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

        <!-- Logo / Brand -->
        <tr><td style="padding-bottom:32px;border-bottom:1px solid #222;">
          <p style="margin:0;font-size:22px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#fff;">LUCK IMAGES</p>
          <p style="margin:4px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#555;">Real Estate Media · Austin, TX</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:32px 0 24px;">
          <p style="margin:0 0 16px;font-size:15px;color:#aaa;">Hi ${firstName},</p>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#ccc;">
            Thanks for taking my call. I wanted to follow up with our full service menu and some examples of what we do for agents across the Austin area.
          </p>
        </td></tr>

        <!-- Services & Pricing -->
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
          <p style="margin:12px 0 0;font-size:11px;color:#444;letter-spacing:1px;">All shoots include next-day delivery. Rush same-day available.</p>
        </td></tr>

        <!-- Portal CTA -->
        <tr><td style="padding-bottom:32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;">
            <tr><td style="padding:24px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;">Client Portal</p>
              <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#fff;">Your media, delivered instantly</p>
              <p style="margin:0 0 16px;font-size:13px;color:#888;line-height:1.6;">
                Every client gets access to a private portal where you can download full-resolution photos, drone video, and walkthrough footage — all in one place, the moment they're ready.
              </p>
              <a href="https://luckimages-portal.vercel.app" style="display:inline-block;background:#fff;color:#000;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:12px 24px;text-decoration:none;">
                View Portal →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Portfolio CTA -->
        <tr><td style="padding-bottom:40px;">
          <p style="margin:0 0 16px;font-size:13px;color:#888;line-height:1.6;">
            Want to see the work first? Check out our full portfolio at <a href="https://luckimages.com" style="color:#4ade80;text-decoration:none;">luckimages.com</a> — everything from aerial lot shots to full twilight packages.
          </p>
          <a href="https://luckimages.com" style="display:inline-block;border:1px solid #333;color:#fff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:12px 24px;text-decoration:none;">
            View Portfolio →
          </a>
        </td></tr>

        <!-- Sign-off -->
        <tr><td style="border-top:1px solid #1a1a1a;padding-top:24px;">
          <p style="margin:0;font-size:13px;color:#aaa;line-height:1.7;">
            Ready to book or have questions? Just reply to this email or call me directly.<br/>
            I can usually get out within 24–48 hours of booking.
          </p>
          <p style="margin:20px 0 0;font-size:13px;color:#fff;font-weight:700;">Ryan Luck</p>
          <p style="margin:2px 0 0;font-size:12px;color:#555;">Luck Images · (512) 555-0100 · ryan@luckimages.com</p>
          <p style="margin:2px 0 0;font-size:12px;color:#555;">luckimages.com</p>
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
  const preselectedId = searchParams.get("contact");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [weekCallCount, setWeekCallCount] = useState(0);
  const [weekLeadCount, setWeekLeadCount] = useState(0);
  const DAILY_GOAL = 20;

  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", brokerage: "" });
  const [outcome, setOutcome] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [listingAddress, setListingAddress] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [zillow, setZillow] = useState("");
  const [zillowLoading, setZillowLoading] = useState(false);
  const [zillowAgent, setZillowAgent] = useState<{ name: string; phone: string }>({ name: "", phone: "" });
  const [showAgentFields, setShowAgentFields] = useState(false);
  const [service, setService] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [concluding, setConcluding] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [callerName, setCallerName] = useState("ryan");

  const [showPitchModal, setShowPitchModal] = useState(false);
  const [pitchSubject, setPitchSubject] = useState("Real Estate Media — Luck Images");
  const [sendingPitch, setSendingPitch] = useState(false);
  const [pitchSent, setPitchSent] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: cs }, { data: logs }] = await Promise.all([
      supabase.from("contacts").select("*").order("name", { ascending: true }),
      supabase.from("cold_calls").select("*").order("called_at", { ascending: false }),
    ]);
    setContacts(cs || []);
    setCallLogs(logs || []);
    const today = new Date().toISOString().split("T")[0];
    const todayLogs = (logs || []).filter((l: CallLog) => l.called_at.startsWith(today));
    setTodayCount(todayLogs.length);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekLogs = (logs || []).filter((l: CallLog) => new Date(l.called_at) >= weekStart);
    setWeekCallCount(weekLogs.length);
    setWeekLeadCount(weekLogs.filter((l: CallLog) => ["interested", "callback", "booked"].includes(l.outcome)).length);

    if (preselectedId && cs) {
      const found = (cs as Contact[]).find(c => c.id === preselectedId);
      if (found) setActiveContact(found);
    }
  }, [preselectedId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
      else setCallerName(data.user.email?.split("@")[0] || "ryan");
    });
    loadData();
  }, [router, loadData]);

  async function importFromZillow() {
    if (!zillow.trim()) return;
    setZillowLoading(true);
    try {
      const res = await fetch("/api/admin/zillow-import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: zillow }),
      });
      const data = await res.json();
      if (data.address) setListingAddress(data.address);
      setZillowAgent({ name: data.agentName || "", phone: data.agentPhone || "" });
      setShowAgentFields(true);
    } catch { /* ignore */ }
    setZillowLoading(false);
    setZillow("");
  }

  async function concludeCall() {
    if (!activeContact || !outcome) return;
    setConcluding(true);
    const supabase = createClient();
    const notesWithService = [
      service ? `Service: ${service}${servicePrice ? ` ($${servicePrice})` : ""}` : "",
      showAgentFields && zillowAgent.name ? `Agent: ${zillowAgent.name}${zillowAgent.phone ? ` · ${zillowAgent.phone}` : ""}` : "",
      callNotes,
    ].filter(Boolean).join("\n");

    await supabase.from("cold_calls").insert({
      contact_id: activeContact.id,
      outcome,
      notes: notesWithService || null,
      listing_address: listingAddress || null,
      callback_at: callbackAt ? new Date(callbackAt).toISOString() : null,
      called_by: callerName,
    });
    const stageMap: Record<string, string> = { interested: "interested", callback: "follow-up", booked: "booked", not_interested: "dead" };
    if (stageMap[outcome]) await supabase.from("contacts").update({ stage: stageMap[outcome] }).eq("id", activeContact.id);

    // Automatically open pitch email modal on interested / callback
    if ((outcome === "interested" || outcome === "callback") && activeContact.email) {
      setPitchSubject("Real Estate Photography — Luck Images");
      setPitchSent(false);
      setShowPitchModal(true);
    }

    setOutcome(""); setCallNotes(""); setListingAddress(""); setCallbackAt(""); setZillow("");
    setZillowAgent({ name: "", phone: "" }); setShowAgentFields(false); setService(""); setServicePrice("");
    setConcluding(false);
    setConcluded(true);
    setTimeout(() => setConcluded(false), 2000);
    await loadData();
  }

  async function createAndSelect(e: React.FormEvent) {
    e.preventDefault();
    if (!newContact.name.trim()) return;
    const supabase = createClient();
    const { data } = await supabase.from("contacts").insert({
      name: newContact.name, phone: newContact.phone || null,
      email: newContact.email || null, brokerage: newContact.brokerage || null,
      stage: "lead", type: "lead",
    }).select().single();
    if (data) setActiveContact(data as Contact);
    setShowNewContact(false);
    setNewContact({ name: "", phone: "", email: "", brokerage: "" });
    await loadData();
  }

  async function sendPitchEmail() {
    if (!activeContact?.email) return;
    setSendingPitch(true);
    const firstName = activeContact.name.split(" ")[0];
    const html = buildPitchHtml(firstName, activeContact.email);
    await fetch("/api/admin/send-email", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: activeContact.id,
        to: activeContact.email,
        subject: pitchSubject,
        html,
        body: `Hi ${firstName},\n\nPlease see attached for our full service menu and pricing.\n\nRyan Luck\nLuck Images`,
      }),
    });
    setSendingPitch(false);
    setPitchSent(true);
  }

  const followUpQueue = contacts.filter(c => {
    if (c.stage === "interested" || c.stage === "follow-up") return true;
    const lastCall = callLogs.find(l => l.contact_id === c.id);
    return lastCall && (lastCall.outcome === "no_answer" || lastCall.outcome === "callback");
  }).map(c => ({ contact: c, lastCall: callLogs.find(l => l.contact_id === c.id) }));

  const filteredContacts = contacts.filter(c =>
    !contactSearch ||
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.brokerage?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const recentLogs = callLogs.slice(0, 15);

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">

      {/* Header */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 md:py-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 md:gap-6">
          <button onClick={() => router.push("/dashboard")} className="text-[#555] text-sm hover:text-white transition-colors shrink-0">
            ← Back
          </button>
          <h1 className="text-sm font-bold tracking-[3px] uppercase">📞 Cold Calls</h1>
        </div>
        <div className="flex items-center gap-4 md:gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-24 md:w-32 h-1.5 bg-[#222] overflow-hidden">
              <div className="h-full bg-[#4ade80] transition-all duration-500" style={{ width: `${Math.min((todayCount / DAILY_GOAL) * 100, 100)}%` }} />
            </div>
            <span className="text-sm font-bold text-[#4ade80] tabular-nums">{todayCount}/{DAILY_GOAL}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#555]">
            <span className="hidden sm:inline">Logging as:</span>
            <select value={callerName} onChange={e => setCallerName(e.target.value)}
              className="bg-[#181818] border border-white/10 px-2 py-1 text-xs text-white focus:outline-none">
              <option value="ryan">Ryan</option>
              <option value="leif">Leif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Week stats bar */}
      <div className="border-b border-white/10 px-4 md:px-8 py-3 flex items-center gap-6 md:gap-10 bg-[#0e0e0e]">
        <div className="flex items-center gap-2">
          <span className="text-xl md:text-2xl font-bold tabular-nums">{weekCallCount}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">calls this week</span>
        </div>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl md:text-2xl font-bold tabular-nums text-[#4ade80]">{weekLeadCount}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">leads</span>
        </div>
        <div className="w-px h-5 bg-white/10 hidden md:block" />
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#fbbf24]">
            {weekCallCount > 0 ? Math.round((weekLeadCount / weekCallCount) * 100) : 0}%
          </span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">conversion</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-8">

        {/* FOLLOW-UP QUEUE */}
        {followUpQueue.length > 0 && (
          <section>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
              Follow-Up Queue — {followUpQueue.length} to contact
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {followUpQueue.map(({ contact, lastCall }) => {
                const outcomeInfo = OUTCOMES.find(o => o.value === lastCall?.outcome);
                return (
                  <button
                    key={contact.id}
                    onClick={() => { setActiveContact(contact); window.scrollTo({ top: 300, behavior: "smooth" }); }}
                    className={`bg-[#111] border text-left p-4 hover:border-white/20 transition-all ${activeContact?.id === contact.id ? "border-white/30" : "border-white/10"}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium truncate">{contact.is_hot ? "🔥 " : ""}{contact.name}</p>
                      {lastCall && (
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${outcomeInfo?.color || "bg-zinc-700 text-zinc-300"}`}>
                          {outcomeInfo?.label || lastCall.outcome}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#555]">{contact.brokerage || contact.phone || "—"}</p>
                    {lastCall?.listing_address && <p className="text-xs text-[#444] mt-1">📍 {lastCall.listing_address}</p>}
                    {lastCall && (
                      <p className="text-xs text-[#333] mt-1">
                        Last: {new Date(lastCall.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* MAIN 2-COL: LOG A CALL + RECENT CALLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

          {/* LEFT — Log a call */}
          <section>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
              Log a Call
            </p>
            <div className="bg-[#111] border border-white/10 p-5 md:p-6 space-y-5">

              {/* Zillow */}
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Zillow Listing URL</p>
                <div className="flex gap-2">
                  <input value={zillow} onChange={e => setZillow(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && importFromZillow()}
                    placeholder="https://zillow.com/homedetails/..."
                    className="flex-1 bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                  <button onClick={importFromZillow} disabled={zillowLoading || !zillow.trim()}
                    className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all disabled:opacity-40">
                    {zillowLoading ? "..." : "Import"}
                  </button>
                </div>
                {listingAddress && <p className="text-xs text-[#4ade80] mt-1.5">📍 {listingAddress}</p>}
                {showAgentFields && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-[#555] tracking-[1px] uppercase">Listing Agent</p>
                    <div className="flex gap-2">
                      <input value={zillowAgent.name} onChange={e => setZillowAgent(a => ({ ...a, name: e.target.value }))}
                        placeholder="Agent name"
                        className="flex-1 bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                      <input value={zillowAgent.phone} onChange={e => setZillowAgent(a => ({ ...a, phone: e.target.value }))}
                        placeholder="Phone"
                        className="w-32 bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    </div>
                    {!activeContact && zillowAgent.name && (
                      <button onClick={() => {
                        setShowNewContact(true);
                        setNewContact(f => ({ ...f, name: zillowAgent.name, phone: zillowAgent.phone }));
                      }} className="text-xs text-[#4ade80] hover:underline">
                        + Use as contact
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Contact */}
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Contact</p>
                {activeContact ? (
                  <div className="bg-[#181818] border border-white/10 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{activeContact.name}</p>
                      <p className="text-xs text-[#555]">{activeContact.brokerage || activeContact.phone || "—"}</p>
                      {activeContact.phone && (
                        <a href={`tel:${activeContact.phone}`} className="text-xs text-[#4ade80] hover:underline mt-0.5 block">
                          📱 {activeContact.phone}
                        </a>
                      )}
                      {activeContact.email && (
                        <p className="text-xs text-[#555] mt-0.5">{activeContact.email}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {activeContact.email && (
                        <button
                          onClick={() => { setPitchSubject("Real Estate Photography — Luck Images"); setPitchSent(false); setShowPitchModal(true); }}
                          className="text-xs tracking-[1px] uppercase border border-white/10 px-3 py-1.5 text-[#888] hover:text-white hover:border-white/30 transition-all whitespace-nowrap"
                        >
                          ✉ Send Pitch
                        </button>
                      )}
                      <button onClick={() => { setActiveContact(null); setContactSearch(""); }} className="text-[#444] hover:text-white text-xs transition-colors">✕</button>
                    </div>
                  </div>
                ) : showNewContact ? (
                  <form onSubmit={createAndSelect} className="space-y-2">
                    <input required autoFocus value={newContact.name} onChange={e => setNewContact(f => ({ ...f, name: e.target.value }))}
                      placeholder="Name *" className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={newContact.phone} onChange={e => setNewContact(f => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone" className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30" />
                      <input value={newContact.brokerage} onChange={e => setNewContact(f => ({ ...f, brokerage: e.target.value }))}
                        placeholder="Brokerage" className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30" />
                    </div>
                    <input type="email" value={newContact.email} onChange={e => setNewContact(f => ({ ...f, email: e.target.value }))}
                      placeholder="Email" className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowNewContact(false)}
                        className="text-xs text-[#555] hover:text-white px-3 py-2 border border-white/10 transition-colors">Cancel</button>
                      <button type="submit"
                        className="flex-1 text-xs tracking-[1px] uppercase bg-white text-black py-2 hover:bg-[#ddd] transition-colors font-semibold">
                        Create &amp; Select
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <input value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                      placeholder="Search contacts..."
                      className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    {contactSearch && (
                      <div className="bg-[#181818] border border-white/10 max-h-40 overflow-y-auto divide-y divide-white/5">
                        {filteredContacts.slice(0, 10).map(c => (
                          <button key={c.id} onClick={() => { setActiveContact(c); setContactSearch(""); }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors">
                            <span className="font-medium">{c.name}</span>
                            {c.brokerage && <span className="text-[#555] ml-2">{c.brokerage}</span>}
                          </button>
                        ))}
                        {filteredContacts.length === 0 && <p className="px-3 py-2 text-xs text-[#444]">No match</p>}
                      </div>
                    )}
                    <button onClick={() => setShowNewContact(true)} className="text-xs text-[#555] hover:text-white transition-colors">
                      + New contact
                    </button>
                  </div>
                )}
              </div>

              {/* Listing address (manual) */}
              {!listingAddress && (
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Listing Address <span className="normal-case text-[#333]">(or use Zillow above)</span></p>
                  <input value={listingAddress} onChange={e => setListingAddress(e.target.value)}
                    placeholder="123 Main St, Austin TX"
                    className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                </div>
              )}

              {/* Outcome */}
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Outcome</p>
                <div className="flex flex-wrap gap-1.5">
                  {OUTCOMES.map(o => (
                    <button key={o.value} onClick={() => setOutcome(outcome === o.value ? "" : o.value)}
                      className={`text-xs px-3 py-1.5 rounded-full transition-all ${outcome === o.value ? o.color : "bg-[#1a1a1a] text-[#555] hover:text-white"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Callback date */}
              {outcome === "callback" && (
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Callback Date/Time</p>
                  <input type="datetime-local" value={callbackAt} onChange={e => setCallbackAt(e.target.value)}
                    className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 [color-scheme:dark]" />
                </div>
              )}

              {/* Service pitched */}
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Service Pitched</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SERVICES.map(s => (
                    <button key={s.label} onClick={() => {
                      setService(s.label === service ? "" : s.label);
                      if (s.price && s.label !== service) setServicePrice(String(s.price));
                      else if (s.label === service) setServicePrice("");
                    }}
                      className={`text-xs px-3 py-1.5 border transition-all ${service === s.label ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white"}`}>
                      {s.label}{s.price ? ` · $${s.price}` : ""}
                    </button>
                  ))}
                </div>
                {service && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#555]">Price quoted:</span>
                    <div className="flex items-center bg-[#181818] border border-white/10">
                      <span className="text-xs text-[#555] px-2">$</span>
                      <input type="number" value={servicePrice} onChange={e => setServicePrice(e.target.value)}
                        placeholder="0" className="w-20 bg-transparent text-white text-xs px-2 py-2 outline-none" />
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Notes</p>
                <textarea value={callNotes} onChange={e => setCallNotes(e.target.value)} rows={3}
                  placeholder="What happened on the call..."
                  className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 resize-none placeholder:text-[#333]" />
              </div>

              <button
                onClick={concludeCall}
                disabled={!activeContact || !outcome || concluding}
                className={`w-full py-3 text-xs tracking-[3px] uppercase font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  concluded ? "bg-[#4ade80] text-black" : "bg-white text-black hover:bg-[#ddd]"
                }`}
              >
                {concluding ? "Logging..." : concluded ? "✓ Concluded" : "Conclude Call"}
              </button>
            </div>
          </section>

          {/* RIGHT — Recent call log */}
          <section>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
              Recent Calls
            </p>
            <div className="bg-[#111] border border-white/10 divide-y divide-white/5">
              {recentLogs.length === 0 ? (
                <p className="text-xs text-[#333] italic p-6">No calls logged yet.</p>
              ) : recentLogs.map(log => {
                const contact = contacts.find(c => c.id === log.contact_id);
                const outcomeInfo = OUTCOMES.find(o => o.value === log.outcome);
                return (
                  <div key={log.id} className="p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => contact && setActiveContact(contact)}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{contact?.name || "Unknown"}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${outcomeInfo?.color || "bg-zinc-800 text-zinc-400"}`}>
                        {outcomeInfo?.label || log.outcome}
                      </span>
                    </div>
                    {log.listing_address && <p className="text-xs text-[#555]">📍 {log.listing_address}</p>}
                    {log.notes && (() => {
                      const lines = log.notes.split("\n");
                      const svcLine = lines.find(l => l.startsWith("Service:"));
                      const other = lines.filter(l => !l.startsWith("Service:")).join(" ");
                      return (
                        <>
                          {svcLine && <p className="text-xs text-[#6366f1] mt-0.5">{svcLine}</p>}
                          {other && <p className="text-xs text-[#444] italic mt-0.5">{other}</p>}
                        </>
                      );
                    })()}
                    <p className="text-xs text-[#333] mt-1">
                      {new Date(log.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {log.called_by}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>

      {/* Pitch Email Modal */}
      {showPitchModal && activeContact && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => !sendingPitch && setShowPitchModal(false)}>
          <div className="bg-[#111] border border-white/15 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-xs tracking-[3px] uppercase font-semibold">Send Pitch Email</p>
                <p className="text-xs text-[#555] mt-0.5">Sends pricing, portfolio + portal info</p>
              </div>
              <button onClick={() => setShowPitchModal(false)} className="text-[#555] hover:text-white text-lg leading-none transition-colors">✕</button>
            </div>

            {pitchSent ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-3xl">✓</p>
                <p className="text-sm font-semibold text-[#4ade80]">Email sent to {activeContact.email}</p>
                <p className="text-xs text-[#555]">They&apos;ll receive pricing, portfolio link, and portal info.</p>
                <button onClick={() => setShowPitchModal(false)}
                  className="mt-4 text-xs tracking-[2px] uppercase border border-white/10 px-6 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all">
                  Close
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1.5">To</p>
                  <div className="bg-[#181818] border border-white/10 px-4 py-2.5 text-sm text-white">
                    {activeContact.name} — {activeContact.email}
                  </div>
                </div>
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1.5">Subject</p>
                  <input value={pitchSubject} onChange={e => setPitchSubject(e.target.value)}
                    className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
                </div>
                <div className="bg-[#0e0e0e] border border-white/5 p-4 space-y-1">
                  <p className="text-xs text-[#555] tracking-[1px] uppercase mb-2">Email includes</p>
                  {["Full services & pricing (Photos, Drone, Video, Matterport, Twilight, Full Package)", "Portfolio link — luckimages.com", "Client portal overview — how media delivery works", "Personal sign-off from Ryan"].map(item => (
                    <p key={item} className="text-xs text-[#888] flex items-start gap-2"><span className="text-[#4ade80] shrink-0">✓</span>{item}</p>
                  ))}
                </div>
                {!activeContact.email && (
                  <p className="text-xs text-[#fbbf24]">⚠ No email on file for this contact — add one first.</p>
                )}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowPitchModal(false)}
                    className="flex-1 py-3 text-xs tracking-[2px] uppercase border border-white/10 text-[#888] hover:text-white hover:border-white/30 transition-all">
                    Cancel
                  </button>
                  <button onClick={sendPitchEmail} disabled={sendingPitch || !activeContact.email}
                    className="flex-1 py-3 text-xs tracking-[2px] uppercase font-bold bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-40">
                    {sendingPitch ? "Sending..." : "Send Email →"}
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
