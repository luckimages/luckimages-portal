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
  { value: "no_answer", label: "No Answer", color: "bg-zinc-700 text-zinc-300" },
  { value: "not_interested", label: "Not Interested", color: "bg-red-900 text-red-300" },
  { value: "interested", label: "Interested", color: "bg-blue-900 text-blue-300" },
  { value: "callback", label: "Callback", color: "bg-yellow-900 text-yellow-300" },
  { value: "booked", label: "Booked!", color: "bg-green-900 text-green-300" },
];

const SERVICES = [
  { label: "Drone Photos (Lot Lines)", price: 200 },
  { label: "Interior/Exterior Photos", price: 175 },
  { label: "Photo + Drone Package", price: 325 },
  { label: "Video Walkthrough", price: 250 },
  { label: "Matterport 3D Tour", price: 225 },
  { label: "Twilight Shoot", price: 250 },
  { label: "Full Package", price: 750 },
  { label: "Custom", price: 0 },
];

const EMAIL_TEMPLATES = [
  {
    label: "Drone Follow-up",
    subject: "Drone Photos for Your Listing",
    body: (name: string) => `Hi ${name},\n\nGreat speaking with you! As mentioned, I specialize in drone photography with lot lines overlaid — 10 aerial shots delivered within 24 hours for $200 flat.\n\nPerfect for land and lot listings to show buyers exactly what they're getting.\n\nHappy to get out there this week — what day works best?\n\nRyan Luck\nLuck Images\n(512) 555-0100\nluckimages.com`,
  },
  {
    label: "Full Package Follow-up",
    subject: "Real Estate Photography — Luck Images",
    body: (name: string) => `Hi ${name},\n\nThanks for your time today! I'd love to show you what we do at Luck Images.\n\nWe offer listing photos, drone aerials, video walkthroughs, Matterport 3D tours, and twilight shoots — all with next-day turnaround.\n\nCheck out our portfolio at luckimages.com and let me know when you have a listing coming up.\n\nRyan Luck\nLuck Images\n(512) 555-0100`,
  },
  {
    label: "Left Voicemail",
    subject: "Following Up — Luck Images Real Estate Photography",
    body: (name: string) => `Hi ${name},\n\nI left you a voicemail earlier — just wanted to follow up in case email is easier.\n\nI'm Ryan with Luck Images, a real estate photography company based in Austin. I noticed your listing and wanted to reach out about drone photos with lot lines overlaid.\n\n10 aerial shots, 24hr turnaround, $200 flat.\n\nLet me know if you'd like to set something up!\n\nRyan Luck\nLuck Images\nluckimages.com`,
  },
];

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
  const [dailyGoal] = useState(20);
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
  const [zillowAgent, setZillowAgent] = useState<{ name: string; phone: string } | null>(null);
  const [service, setService] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [logging, setLogging] = useState(false);
  const [callerName, setCallerName] = useState("ryan");
  const [showEmail, setShowEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: cs }, { data: logs }] = await Promise.all([
      supabase.from("contacts").select("*").order("name", { ascending: true }),
      supabase.from("cold_calls").select("*").order("called_at", { ascending: false }),
    ]);
    setContacts(cs || []);
    setCallLogs(logs || []);
    const today = new Date().toISOString().split("T")[0];
    setTodayCount((logs || []).filter((l: CallLog) => l.called_at.startsWith(today)).length);
    if (preselectedId && cs) {
      const found = cs.find((c: Contact) => c.id === preselectedId);
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
    setZillowAgent(null);
    try {
      const res = await fetch("/api/admin/zillow-import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: zillow }),
      });
      const data = await res.json();
      if (data.address) setListingAddress(data.address);
      if (data.agentName) {
        setZillowAgent({ name: data.agentName, phone: data.agentPhone || "" });
        // Pre-fill new contact form if no contact selected
        if (!activeContact) {
          setShowNewContact(true);
          setNewContact(f => ({
            ...f,
            name: data.agentName || f.name,
            phone: data.agentPhone || f.phone,
          }));
        }
      }
    } catch {}
    setZillowLoading(false);
    setZillow("");
  }

  async function logCall() {
    if (!activeContact || !outcome) return;
    setLogging(true);
    const supabase = createClient();
    const notesWithService = [
      service ? `Service: ${service}${servicePrice ? ` ($${servicePrice})` : ""}` : "",
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
    if (outcome === "interested" || outcome === "callback") {
      const tmpl = EMAIL_TEMPLATES[0];
      setEmailSubject(tmpl.subject);
      setEmailBody(tmpl.body(activeContact.name.split(" ")[0]));
      setShowEmail(true);
    }
    setOutcome(""); setCallNotes(""); setListingAddress(""); setCallbackAt(""); setZillow(""); setZillowAgent(null); setService(""); setServicePrice("");
    setLogging(false);
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
    if (data) setActiveContact(data);
    setShowNewContact(false);
    setNewContact({ name: "", phone: "", email: "", brokerage: "" });
    await loadData();
  }

  async function sendEmail() {
    if (!activeContact?.email) return;
    setSendingEmail(true);
    await fetch("/api/admin/send-email", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: activeContact.id, to: activeContact.email, subject: emailSubject, body: emailBody }),
    });
    setSendingEmail(false);
    setShowEmail(false);
  }

  // Follow-up queue: contacts whose last call was no_answer or callback, or stage is follow-up/interested
  const followUpQueue = contacts.filter(c => {
    if (c.stage === "interested" || c.stage === "follow-up") return true;
    const lastCall = callLogs.find(l => l.contact_id === c.id);
    return lastCall && (lastCall.outcome === "no_answer" || lastCall.outcome === "callback");
  }).map(c => {
    const lastCall = callLogs.find(l => l.contact_id === c.id);
    return { contact: c, lastCall };
  });

  const filteredContacts = contacts.filter(c =>
    !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.brokerage?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const recentLogs = callLogs.slice(0, 12);

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push("/dashboard")} className="text-[#555] text-sm hover:text-white transition-colors">
            ← Dashboard
          </button>
          <h1 className="text-sm font-bold tracking-[3px] uppercase">📞 Cold Calls</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-32 h-1.5 bg-[#222] overflow-hidden">
              <div className="h-full bg-[#4ade80] transition-all duration-500" style={{ width: `${Math.min((todayCount / dailyGoal) * 100, 100)}%` }} />
            </div>
            <span className="text-sm font-bold text-[#4ade80] tabular-nums">{todayCount}/{dailyGoal} today</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#555]">
            Logging as:
            <select value={callerName} onChange={e => setCallerName(e.target.value)}
              className="bg-[#181818] border border-white/10 px-2 py-1 text-xs text-white focus:outline-none">
              <option value="ryan">Ryan</option>
              <option value="leif">Leif</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">

        {/* FOLLOW-UP QUEUE */}
        {followUpQueue.length > 0 && (
          <section>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
              Follow-Up Queue — {followUpQueue.length} to contact
            </p>
            <div className="grid grid-cols-3 gap-3">
              {followUpQueue.map(({ contact, lastCall }) => {
                const outcomeInfo = OUTCOMES.find(o => o.value === lastCall?.outcome);
                return (
                  <button
                    key={contact.id}
                    onClick={() => { setActiveContact(contact); window.scrollTo({ top: 400, behavior: "smooth" }); }}
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
                        Last called {new Date(lastCall.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                    {contact.stage === "interested" && !lastCall && (
                      <span className="text-xs text-blue-400">Interested — follow up</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* MAIN 2-COL: LOG A CALL + RECENT CALLS */}
        <div className="grid grid-cols-2 gap-8">

          {/* LEFT — Log a call */}
          <section>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
              Log a Call
            </p>
            <div className="bg-[#111] border border-white/10 p-6 space-y-5">

              {/* Zillow */}
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Zillow Listing URL</p>
                <div className="flex gap-2">
                  <input value={zillow} onChange={e => setZillow(e.target.value)}
                    placeholder="https://zillow.com/homedetails/..."
                    className="flex-1 bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                  <button onClick={importFromZillow} disabled={zillowLoading || !zillow.trim()}
                    className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all disabled:opacity-40">
                    {zillowLoading ? "..." : "Import"}
                  </button>
                </div>
                {listingAddress && <p className="text-xs text-[#4ade80] mt-1.5">📍 {listingAddress}</p>}
                {zillowAgent && (
                  <div className="mt-2 bg-blue-950/40 border border-blue-800/40 px-3 py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-blue-300 font-medium">Agent found: {zillowAgent.name}</p>
                      {zillowAgent.phone && <p className="text-xs text-blue-400/70">{zillowAgent.phone}</p>}
                    </div>
                    {!activeContact && (
                      <button onClick={() => { setShowNewContact(true); setNewContact(f => ({ ...f, name: zillowAgent.name, phone: zillowAgent.phone })); }}
                        className="text-xs text-blue-300 border border-blue-700/50 px-2 py-1 hover:bg-blue-900/30 transition-colors flex-shrink-0">
                        Use as Contact
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Contact */}
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Contact</p>
                {activeContact ? (
                  <div className="bg-[#181818] border border-white/10 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{activeContact.name}</p>
                      <p className="text-xs text-[#555]">{activeContact.brokerage || activeContact.phone || "—"}</p>
                      {activeContact.phone && (
                        <a href={`tel:${activeContact.phone}`} className="text-xs text-[#4ade80] hover:underline mt-0.5 block">
                          📱 {activeContact.phone}
                        </a>
                      )}
                    </div>
                    <button onClick={() => { setActiveContact(null); setContactSearch(""); }} className="text-[#555] hover:text-white text-xs">✕</button>
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
                        className="flex-1 text-xs tracking-[1px] uppercase bg-white text-black py-2 hover:bg-[#ddd] transition-colors">
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
                        {filteredContacts.length === 0 && (
                          <p className="px-3 py-2 text-xs text-[#444]">No match</p>
                        )}
                      </div>
                    )}
                    <button onClick={() => setShowNewContact(true)} className="text-xs text-[#555] hover:text-white transition-colors">
                      + New contact
                    </button>
                  </div>
                )}
              </div>

              {/* Listing address (manual if no Zillow) */}
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

              {/* Callback date if applicable */}
              {outcome === "callback" && (
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Callback Date/Time</p>
                  <input type="datetime-local" value={callbackAt} onChange={e => setCallbackAt(e.target.value)}
                    className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30" />
                </div>
              )}

              {/* Service */}
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
                        placeholder="0" className="w-24 bg-transparent text-white text-xs px-2 py-2 outline-none" />
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

              <div className="flex gap-3">
                {activeContact?.email && (
                  <button onClick={() => {
                    const tmpl = EMAIL_TEMPLATES[0];
                    setEmailSubject(tmpl.subject);
                    setEmailBody(tmpl.body(activeContact.name.split(" ")[0]));
                    setShowEmail(true);
                  }} className="px-4 py-2.5 text-xs tracking-[2px] uppercase border border-white/10 text-[#888] hover:text-white hover:border-white/30 transition-all">
                    ✉ Email
                  </button>
                )}
                <button onClick={logCall} disabled={!activeContact || !outcome || logging}
                  className="flex-1 py-2.5 text-xs tracking-[3px] uppercase font-semibold bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  {logging ? "Logging..." : "Log Call"}
                </button>
              </div>
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
                      const otherLines = lines.filter(l => !l.startsWith("Service:")).join(" ");
                      return (
                        <>
                          {svcLine && <p className="text-xs text-[#6366f1] mt-0.5">{svcLine}</p>}
                          {otherLines && <p className="text-xs text-[#444] italic mt-0.5">{otherLines}</p>}
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

      {/* Email Modal */}
      {showEmail && activeContact && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">Send Follow-up Email</h2>
            <div className="space-y-3 mb-4">
              <div className="flex gap-2 flex-wrap">
                {EMAIL_TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => { setEmailSubject(t.subject); setEmailBody(t.body(activeContact.name.split(" ")[0])); }}
                    className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors">
                    {t.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">To</label>
                <div className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg">{activeContact.email}</div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Subject</label>
                <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Body</label>
                <textarea rows={8} value={emailBody} onChange={e => setEmailBody(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none font-mono text-xs" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowEmail(false)}
                className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={sendEmail} disabled={sendingEmail || !activeContact.email}
                className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 disabled:opacity-40 transition-colors">
                {sendingEmail ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
