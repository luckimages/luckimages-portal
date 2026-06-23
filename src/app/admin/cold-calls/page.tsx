"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function ColdCallsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("contact");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [dailyGoal] = useState(20);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [listingAddress, setListingAddress] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [logging, setLogging] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", brokerage: "", listing_address: "" });
  const [zillow, setZillow] = useState("");
  const [zillowLoading, setZillowLoading] = useState(false);
  const [callerName, setCallerName] = useState("ryan");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: cs }, { data: logs }] = await Promise.all([
      supabase.from("contacts").select("*").order("is_hot", { ascending: false }).order("total_revenue", { ascending: false }),
      supabase.from("cold_calls").select("*").order("called_at", { ascending: false }),
    ]);
    setContacts(cs || []);
    setCallLogs(logs || []);

    const today = new Date().toISOString().split("T")[0];
    const todayCalls = (logs || []).filter(l => l.called_at.startsWith(today));
    setTodayCount(todayCalls.length);
    setTotalCount((logs || []).length);

    if (preselectedId && cs) {
      const found = cs.find(c => c.id === preselectedId);
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

  async function logCall() {
    if (!activeContact || !outcome) return;
    setLogging(true);
    const supabase = createClient();
    await supabase.from("cold_calls").insert({
      contact_id: activeContact.id,
      outcome,
      notes: callNotes || null,
      listing_address: listingAddress || null,
      callback_at: callbackAt ? new Date(callbackAt).toISOString() : null,
      called_by: callerName,
    });

    // Update contact stage based on outcome
    const stageMap: Record<string, string> = {
      interested: "interested",
      callback: "follow-up",
      booked: "booked",
      not_interested: "dead",
    };
    if (stageMap[outcome]) {
      await supabase.from("contacts").update({ stage: stageMap[outcome] }).eq("id", activeContact.id);
    }

    setOutcome("");
    setCallNotes("");
    setListingAddress("");
    setCallbackAt("");
    setLogging(false);
    await loadData();

    // Auto-show email if interested or callback
    if (outcome === "interested" || outcome === "callback") {
      const tmpl = EMAIL_TEMPLATES[0];
      setEmailSubject(tmpl.subject);
      setEmailBody(tmpl.body(activeContact.name.split(" ")[0]));
      setShowEmail(true);
    }
  }

  async function sendEmail() {
    if (!activeContact?.email) return;
    setSendingEmail(true);
    const res = await fetch("/api/admin/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: activeContact.id, to: activeContact.email, subject: emailSubject, body: emailBody }),
    });
    if (res.ok) {
      setShowEmail(false);
      setEmailSubject("");
      setEmailBody("");
      await loadData();
    }
    setSendingEmail(false);
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { data } = await supabase.from("contacts").insert({
      ...newContact,
      type: "lead",
      stage: "lead",
    }).select().single();
    if (data) setActiveContact(data);
    setShowAddContact(false);
    setNewContact({ name: "", email: "", phone: "", brokerage: "", listing_address: "" });
    await loadData();
  }

  async function importFromZillow() {
    if (!zillow.trim()) return;
    setZillowLoading(true);
    try {
      const res = await fetch("/api/admin/zillow-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: zillow }),
      });
      const data = await res.json();
      if (data.address) {
        setNewContact(n => ({ ...n, listing_address: data.address, brokerage: data.brokerage || n.brokerage }));
      }
    } catch {}
    setZillowLoading(false);
    setZillow("");
  }

  const filteredContacts = contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.brokerage?.toLowerCase().includes(search.toLowerCase())
  );

  const contactCallLogs = callLogs.filter(l => l.contact_id === activeContact?.id);
  const todayProgress = Math.min((todayCount / dailyGoal) * 100, 100);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push("/dashboard")} className="text-zinc-500 text-sm hover:text-white">
            ← Dashboard
          </button>
          <h1 className="text-lg font-bold">📞 Cold Calls</h1>
        </div>
        <div className="flex items-center gap-6">
          {/* Daily goal */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-bold">{todayCount} <span className="text-zinc-500 font-normal">/ {dailyGoal} today</span></div>
              <div className="text-xs text-zinc-500">{totalCount} all time</div>
            </div>
            <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${todayProgress}%` }}
              />
            </div>
            <div className="text-sm font-bold text-green-400">{Math.round(todayProgress)}%</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            Logging as:
            <select value={callerName} onChange={e => setCallerName(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white focus:outline-none">
              <option value="ryan">Ryan</option>
              <option value="leif">Leif</option>
            </select>
          </div>
          <button onClick={() => router.push("/admin/contacts")} className="text-sm text-zinc-400 hover:text-white">
            All Contacts →
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — contact list */}
        <div className="w-72 border-r border-zinc-800 flex flex-col">
          <div className="p-3 border-b border-zinc-800 space-y-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
            />
            <button
              onClick={() => setShowAddContact(true)}
              className="w-full py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              + New Contact
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.map(c => {
              const lastCall = callLogs.find(l => l.contact_id === c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveContact(c)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors ${activeContact?.id === c.id ? "bg-zinc-800/60" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{c.is_hot ? "🔥 " : ""}{c.name}</span>
                    {lastCall && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${OUTCOMES.find(o => o.value === lastCall.outcome)?.color || "bg-zinc-700 text-zinc-400"}`}>
                        {OUTCOMES.find(o => o.value === lastCall.outcome)?.label || lastCall.outcome}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 truncate mt-0.5">{c.brokerage || c.email || "—"}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel — active contact */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeContact ? (
            <>
              {/* Contact header */}
              <div className="px-6 py-5 border-b border-zinc-800">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{activeContact.name}</h2>
                    <div className="flex gap-4 mt-1 text-sm text-zinc-400">
                      {activeContact.phone && <span>📱 {activeContact.phone}</span>}
                      {activeContact.email && <span>✉️ {activeContact.email}</span>}
                      {activeContact.brokerage && <span>🏢 {activeContact.brokerage}</span>}
                    </div>
                    {activeContact.notes && <p className="text-xs text-zinc-500 mt-2">{activeContact.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    {activeContact.email && (
                      <button
                        onClick={() => {
                          const tmpl = EMAIL_TEMPLATES[0];
                          setEmailSubject(tmpl.subject);
                          setEmailBody(tmpl.body(activeContact.name.split(" ")[0]));
                          setShowEmail(true);
                        }}
                        className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                      >
                        ✉️ Email
                      </button>
                    )}
                    {activeContact.phone && (
                      <a href={`tel:${activeContact.phone}`}
                        className="px-3 py-1.5 text-sm bg-green-900 hover:bg-green-800 text-green-300 rounded-lg transition-colors">
                        📞 Call
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Log a call */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-4">Log This Call</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-zinc-500 mb-2 block">Outcome *</label>
                      <div className="flex flex-wrap gap-2">
                        {OUTCOMES.map(o => (
                          <button
                            key={o.value}
                            onClick={() => setOutcome(o.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                              outcome === o.value
                                ? `${o.color} border-transparent scale-105`
                                : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500"
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Listing Address</label>
                      <input
                        value={listingAddress}
                        onChange={e => setListingAddress(e.target.value)}
                        placeholder="123 Main St, Austin TX"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
                      <textarea
                        rows={2}
                        value={callNotes}
                        onChange={e => setCallNotes(e.target.value)}
                        placeholder="What happened on the call..."
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
                      />
                    </div>
                    {(outcome === "callback") && (
                      <div>
                        <label className="text-xs text-zinc-500 mb-1 block">Callback Date/Time</label>
                        <input
                          type="datetime-local"
                          value={callbackAt}
                          onChange={e => setCallbackAt(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                        />
                      </div>
                    )}
                    <button
                      onClick={logCall}
                      disabled={!outcome || logging}
                      className="w-full py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-40"
                    >
                      {logging ? "Logging..." : "Log Call"}
                    </button>
                  </div>
                </div>

                {/* Call history */}
                {contactCallLogs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-zinc-400">Call History</h3>
                    <div className="space-y-2">
                      {contactCallLogs.map(log => (
                        <div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${OUTCOMES.find(o => o.value === log.outcome)?.color || "bg-zinc-700 text-zinc-300"}`}>
                              {OUTCOMES.find(o => o.value === log.outcome)?.label || log.outcome}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {new Date(log.called_at).toLocaleDateString()} · {log.called_by}
                            </span>
                          </div>
                          {log.listing_address && <p className="text-xs text-zinc-400 mt-1">📍 {log.listing_address}</p>}
                          {log.notes && <p className="text-xs text-zinc-400 mt-1">{log.notes}</p>}
                          {log.callback_at && (
                            <p className="text-xs text-yellow-400 mt-1">
                              📅 Callback: {new Date(log.callback_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-zinc-600">
                <div className="text-5xl mb-4">📞</div>
                <div className="text-lg font-medium text-zinc-500">Select a contact to start calling</div>
                <div className="text-sm text-zinc-600 mt-1">or add a new one from Zillow</div>
              </div>
            </div>
          )}
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
                className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button onClick={sendEmail} disabled={sendingEmail || !activeContact.email}
                className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 disabled:opacity-40 transition-colors">
                {sendingEmail ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-5">Add New Contact</h2>
            {/* Zillow import */}
            <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
              <label className="text-xs text-zinc-500 mb-1 block">Paste Zillow listing URL to auto-fill</label>
              <div className="flex gap-2">
                <input value={zillow} onChange={e => setZillow(e.target.value)}
                  placeholder="https://zillow.com/homedetails/..."
                  className="flex-1 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-zinc-500" />
                <button onClick={importFromZillow} disabled={zillowLoading || !zillow}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors">
                  {zillowLoading ? "..." : "Import"}
                </button>
              </div>
            </div>
            <form onSubmit={addContact} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Name *</label>
                <input required value={newContact.name} onChange={e => setNewContact(n => ({ ...n, name: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Phone</label>
                <input value={newContact.phone} onChange={e => setNewContact(n => ({ ...n, phone: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Email</label>
                <input type="email" value={newContact.email} onChange={e => setNewContact(n => ({ ...n, email: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Brokerage</label>
                <input value={newContact.brokerage} onChange={e => setNewContact(n => ({ ...n, brokerage: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Listing Address</label>
                <input value={newContact.listing_address} onChange={e => setNewContact(n => ({ ...n, listing_address: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddContact(false)}
                  className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm hover:bg-zinc-800 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors">
                  Add Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
