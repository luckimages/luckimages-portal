"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Device, Call as TwilioCall } from "@twilio/voice-sdk";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";
import { formatPhone, digitsOnly } from "@/lib/format";
import ContactAvatar from "@/components/ContactAvatar";

type Mode = "calls" | "messages" | "voicemail";

type Contact = { id: string; name: string; phone: string | null; email: string | null; brokerage: string | null };

type Message = {
  id: string;
  contact_id: string | null;
  direction: "inbound" | "outbound";
  body: string | null;
  status: string | null;
  sent_by: string | null;
  created_at: string;
};

type Call = {
  id: string;
  contact_id: string | null;
  direction: "inbound" | "outbound";
  from_number: string | null;
  to_number: string | null;
  status: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  is_voicemail: boolean;
  answered_by: string | null;
  created_at: string;
};

type TwilioStatus = { smsConfigured: boolean; voiceConfigured: boolean; phoneNumber: string | null };

function fmtDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function ConfigNotice({ what }: { what: string }) {
  return (
    <div className="border border-[#fbbf24]/25 bg-[#fbbf24]/5 px-5 py-4 text-xs text-[#fbbf24]/90 leading-relaxed">
      <span className="font-bold uppercase tracking-[1px]">Not connected yet — </span>
      {what} Everything below is fully built and will start working the moment Twilio credentials are added to the environment.
    </div>
  );
}

function PhoneInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>((searchParams.get("tab") as Mode) || "messages");
  const [loading, setLoading] = useState(true);
  const [twilio, setTwilio] = useState<TwilioStatus | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(searchParams.get("contact"));
  const [contactSearch, setContactSearch] = useState("");
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);

  const [dialNumber, setDialNumber] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<"idle" | "connecting" | "ready" | "error">("idle");
  const [deviceError, setDeviceError] = useState("");
  const [incomingCall, setIncomingCall] = useState<TwilioCall | null>(null);
  const [activeCall, setActiveCall] = useState<{ call: TwilioCall; label: string; startedAt: number } | null>(null);
  const [callElapsed, setCallElapsed] = useState(0);
  const deviceRef = useRef<Device | null>(null);

  // ── Voice SDK: register a browser Device so calls ring right here ────
  useEffect(() => {
    if (mode !== "calls" || !twilio?.voiceConfigured || deviceRef.current) return;

    let cancelled = false;
    setDeviceStatus("connecting");

    fetch("/api/twilio/token")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to get token"))))
      .then(({ token }) => {
        if (cancelled) return;
        const device = new Device(token, { logLevel: "error" });
        deviceRef.current = device;

        device.on("registered", () => !cancelled && setDeviceStatus("ready"));
        device.on("error", (e) => { if (!cancelled) { setDeviceStatus("error"); setDeviceError(e.message || "Device error"); } });

        device.on("incoming", (call) => {
          setIncomingCall(call);
          call.on("cancel", () => setIncomingCall(null));
          call.on("reject", () => setIncomingCall(null));
          call.on("disconnect", () => { setIncomingCall(null); setActiveCall(null); });
        });

        device.register();
      })
      .catch((e) => { if (!cancelled) { setDeviceStatus("error"); setDeviceError(e.message || "Could not connect"); } });

    return () => {
      cancelled = true;
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, [mode, twilio]);

  // Live call-duration ticker
  useEffect(() => {
    if (!activeCall) { setCallElapsed(0); return; }
    const id = setInterval(() => setCallElapsed(Math.floor((Date.now() - activeCall.startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [activeCall]);

  function logCallEvent(body: Record<string, unknown>) {
    fetch("/api/twilio/call-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  }

  function wireUpCall(call: TwilioCall, label: string) {
    setActiveCall({ call, label, startedAt: Date.now() });
    const callSid = call.parameters?.CallSid;
    call.on("accept", () => { if (callSid) logCallEvent({ callSid, event: "accepted" }); });
    call.on("disconnect", () => {
      if (callSid) logCallEvent({ callSid, event: "ended", durationSeconds: Math.floor((Date.now() - (activeCall?.startedAt || Date.now())) / 1000) });
      setActiveCall(null);
      setIncomingCall(null);
    });
  }

  function answerIncoming() {
    if (!incomingCall) return;
    incomingCall.accept();
    wireUpCall(incomingCall, contactName(findContactIdForNumber(incomingCall.parameters?.From)) || formatPhone(incomingCall.parameters?.From) || "Incoming call");
    setIncomingCall(null);
  }

  function declineIncoming() {
    incomingCall?.reject();
    setIncomingCall(null);
  }

  function hangUp() {
    activeCall?.call.disconnect();
  }

  function makeCall() {
    const device = deviceRef.current;
    const digits = digitsOnly(dialNumber);
    if (!device || digits.length < 10) return;
    const to = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    const matchedContactId = findContactIdForNumber(to);
    device.connect({ params: { To: to } }).then((call) => {
      const callSid = call.parameters?.CallSid;
      if (callSid) logCallEvent({ callSid, event: "started", contactId: matchedContactId, toNumber: to });
      wireUpCall(call, contactName(matchedContactId) || formatPhone(to));
    });
    setDialNumber("");
  }

  function findContactIdForNumber(raw: string | null | undefined) {
    if (!raw) return null;
    const digits = digitsOnly(raw).slice(-10);
    return contacts.find((c) => digitsOnly(c.phone || "").slice(-10) === digits)?.id || null;
  }

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: c }, { data: m }, { data: calls }] = await Promise.all([
      supabase.from("contacts").select("id, name, phone, email, brokerage").neq("stage", "deleted").order("name"),
      supabase.from("messages").select("id, contact_id, direction, body, status, sent_by, created_at").order("created_at", { ascending: true }),
      supabase.from("calls").select("id, contact_id, direction, from_number, to_number, status, duration_seconds, recording_url, is_voicemail, answered_by, created_at").order("created_at", { ascending: false }),
    ]);
    setContacts(c || []);
    setMessages(m || []);
    setCalls(calls || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
      else loadData();
    });
    fetch("/api/twilio/status").then((r) => (r.ok ? r.json() : null)).then(setTwilio);
  }, [router, loadData]);

  // Deep-linked from a contact profile's "Call" button — prefill the dial
  // pad with their number once contacts have loaded.
  useEffect(() => {
    const contactParam = searchParams.get("contact");
    if (mode !== "calls" || !contactParam || contacts.length === 0 || dialNumber) return;
    const c = contacts.find((x) => x.id === contactParam);
    if (c?.phone) setDialNumber(formatPhone(c.phone));
  }, [mode, contacts, searchParams, dialNumber]);

  function switchMode(m: Mode) {
    setMode(m);
    router.replace(`/dashboard/phone?tab=${m}`, { scroll: false });
  }

  // ── Messages tab derived state ──────────────────────────────────────
  const messagesByContact = new Map<string, Message[]>();
  for (const msg of messages) {
    if (!msg.contact_id) continue;
    if (!messagesByContact.has(msg.contact_id)) messagesByContact.set(msg.contact_id, []);
    messagesByContact.get(msg.contact_id)!.push(msg);
  }
  const threadContacts = contacts
    .filter((c) => c.phone)
    .filter((c) => !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase()) || (c.brokerage || "").toLowerCase().includes(contactSearch.toLowerCase()))
    .map((c) => {
      const thread = messagesByContact.get(c.id) || [];
      const last = thread[thread.length - 1];
      return { contact: c, lastMessage: last, lastAt: last ? new Date(last.created_at).getTime() : 0 };
    })
    .sort((a, b) => b.lastAt - a.lastAt);

  const selectedContact = contacts.find((c) => c.id === selectedContactId) || null;
  const selectedThread = selectedContactId ? messagesByContact.get(selectedContactId) || [] : [];

  async function sendMessage() {
    if (!selectedContactId || !composeText.trim()) return;
    setSending(true);
    const res = await fetch("/api/twilio/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: selectedContactId, body: composeText.trim() }),
    });
    setSending(false);
    if (res.ok) { setComposeText(""); await loadData(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error || "Failed to send"); }
  }

  // ── Voicemail tab derived state ──────────────────────────────────────
  const voicemails = calls.filter((c) => c.is_voicemail && c.recording_url);

  function contactName(id: string | null) {
    if (!id) return null;
    return contacts.find((c) => c.id === id)?.name || null;
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <div className="px-6 md:px-8 pt-6 pb-4 shrink-0 flex flex-wrap items-center justify-between gap-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Phone</h1>
          <p className="text-xs text-[#444] mt-0.5 tracking-wide">Shared line — calls, texts &amp; voicemail for the whole team.</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {(["messages", "calls", "voicemail"] as Mode[]).map((m) => (
            <button key={m} onClick={() => switchMode(m)}
              className={`text-[10px] tracking-[2px] uppercase px-4 py-2 border transition-colors ${mode === m ? "border-white text-white bg-white/10" : "border-white/20 text-[#555] hover:text-white hover:border-white/40"}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
        </div>
      ) : (
        <div className="flex-1 px-6 md:px-8 py-6 max-w-6xl mx-auto w-full">
          {mode === "messages" && (
            <div className="space-y-4">
              {twilio && !twilio.smsConfigured && <ConfigNotice what="Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to send/receive real texts." />}
              <div className="border border-white/10 grid grid-cols-1 md:grid-cols-[280px_1fr] h-[65vh]">
                {/* Contact list */}
                <div className="border-b md:border-b-0 md:border-r border-white/10 flex flex-col min-h-0">
                  <div className="p-3 border-b border-white/10">
                    <input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Search contacts..."
                      className="w-full bg-[#181818] border border-white/10 text-xs text-white px-3 py-2 outline-none focus:border-white/30 placeholder:text-[#333]" />
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                    {threadContacts.length === 0 && <p className="text-xs text-[#333] italic p-4">No contacts with a phone number.</p>}
                    {threadContacts.map(({ contact, lastMessage }) => (
                      <button key={contact.id} onClick={() => setSelectedContactId(contact.id)}
                        className={`w-full text-left px-3 py-3 flex items-center gap-2.5 transition-colors ${selectedContactId === contact.id ? "bg-white/[0.06]" : "hover:bg-white/[0.02]"}`}>
                        <ContactAvatar contactId={contact.id} name={contact.name} size={30} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-xs text-[#555] truncate">{lastMessage ? lastMessage.body : formatPhone(contact.phone)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Thread */}
                <div className="flex flex-col min-h-0">
                  {!selectedContact ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-xs text-[#444] italic">Select a contact to view their thread.</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2.5">
                        <ContactAvatar contactId={selectedContact.id} name={selectedContact.name} size={28} />
                        <div>
                          <p className="text-sm font-semibold">{selectedContact.name}</p>
                          <p className="text-xs text-[#555]">{formatPhone(selectedContact.phone)}</p>
                        </div>
                        <a href={`/admin/contacts/${selectedContact.id}`} className="ml-auto text-[10px] tracking-[1px] uppercase text-[#555] hover:text-white transition-colors">
                          View Contact →
                        </a>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                        {selectedThread.length === 0 && <p className="text-xs text-[#333] italic">No messages yet.</p>}
                        {selectedThread.map((m) => (
                          <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[70%] px-3 py-2 text-sm ${m.direction === "outbound" ? "bg-[#4ade80]/15 text-white" : "bg-white/[0.06] text-white"}`}>
                              <p className="whitespace-pre-wrap">{m.body}</p>
                              <p className="text-[9px] text-[#555] mt-1">
                                {m.direction === "outbound" ? (m.sent_by || "sent") : "received"} · {fmtWhen(m.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="p-3 border-t border-white/10 flex gap-2">
                        <input value={composeText} onChange={(e) => setComposeText(e.target.value)} placeholder="Type a message..."
                          className="flex-1 bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                        <button type="submit" disabled={sending || !composeText.trim()}
                          className="text-xs tracking-[1px] uppercase font-bold px-5 bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-30">
                          {sending ? "..." : "Send"}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {mode === "calls" && (
            <div className="space-y-4">
              {twilio && !twilio.voiceConfigured && <ConfigNotice what="Add TWILIO_API_KEY, TWILIO_API_SECRET, and TWILIO_TWIML_APP_SID (on top of the SMS vars) to make/receive calls right in the browser." />}

              {incomingCall && (
                <div className="border border-[#4ade80]/40 bg-[#4ade80]/10 p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] tracking-[2px] uppercase text-[#4ade80]">Incoming Call</p>
                    <p className="text-lg font-bold mt-0.5">{contactName(findContactIdForNumber(incomingCall.parameters?.From)) || formatPhone(incomingCall.parameters?.From) || "Unknown"}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={declineIncoming} className="text-xs tracking-[1px] uppercase font-bold px-5 py-3 border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">Decline</button>
                    <button onClick={answerIncoming} className="text-xs tracking-[1px] uppercase font-bold px-5 py-3 bg-[#4ade80] text-black hover:bg-[#5ee08f] transition-colors">Answer</button>
                  </div>
                </div>
              )}

              {activeCall && (
                <div className="border border-white/20 bg-white/[0.04] p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] tracking-[2px] uppercase text-[#60a5fa]">On Call</p>
                    <p className="text-lg font-bold mt-0.5">{activeCall.label}</p>
                    <p className="text-xs text-[#666] mt-0.5 tabular-nums">{Math.floor(callElapsed / 60)}:{String(callElapsed % 60).padStart(2, "0")}</p>
                  </div>
                  <button onClick={hangUp} className="text-xs tracking-[1px] uppercase font-bold px-6 py-3 bg-red-500 text-white hover:bg-red-600 transition-colors shrink-0">
                    Hang Up
                  </button>
                </div>
              )}

              <div className="border border-white/10 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Dial</p>
                  {twilio?.voiceConfigured && (
                    <span className={`text-[10px] tracking-[1px] uppercase ${deviceStatus === "ready" ? "text-[#4ade80]" : deviceStatus === "error" ? "text-red-400" : "text-[#666]"}`}>
                      {deviceStatus === "ready" ? "● Connected" : deviceStatus === "error" ? `● ${deviceError || "Error"}` : "● Connecting..."}
                    </span>
                  )}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); makeCall(); }} className="flex gap-2">
                  <input value={dialNumber} onChange={(e) => setDialNumber(e.target.value)} placeholder="(512) 555-0100"
                    disabled={!twilio?.voiceConfigured}
                    className="flex-1 bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333] disabled:opacity-40" />
                  <button type="submit" disabled={!twilio?.voiceConfigured || deviceStatus !== "ready" || !!activeCall || digitsOnly(dialNumber).length < 10}
                    className="text-xs tracking-[1px] uppercase font-bold px-6 bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    Call
                  </button>
                </form>
                {!twilio?.voiceConfigured && <p className="text-[10px] text-[#444]">Browser calling activates automatically once Voice is connected — no code changes needed then.</p>}
              </div>

              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Call Log</p>
                {calls.length === 0 ? (
                  <p className="text-xs text-[#333] italic border border-white/5 p-6 text-center">No calls yet.</p>
                ) : (
                  <div className="border border-white/5 divide-y divide-white/5">
                    {calls.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-sm">{c.direction === "inbound" ? "↘" : "↗"}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{contactName(c.contact_id) || formatPhone(c.direction === "inbound" ? c.from_number : c.to_number) || "Unknown"}</p>
                          <p className="text-xs text-[#555]">{c.status}{c.answered_by ? ` · answered by ${c.answered_by}` : ""}</p>
                        </div>
                        <span className="text-xs text-[#666] tabular-nums">{fmtDuration(c.duration_seconds)}</span>
                        <span className="text-xs text-[#444] w-24 text-right">{fmtWhen(c.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "voicemail" && (
            <div className="space-y-4">
              {twilio && !twilio.voiceConfigured && <ConfigNotice what="Voicemails will start recording once Voice is connected." />}
              {voicemails.length === 0 ? (
                <p className="text-xs text-[#333] italic border border-white/5 p-6 text-center">No voicemails yet.</p>
              ) : (
                <div className="border border-white/5 divide-y divide-white/5">
                  {voicemails.map((v) => (
                    <div key={v.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{contactName(v.contact_id) || formatPhone(v.from_number) || "Unknown"}</p>
                          <p className="text-xs text-[#555]">{fmtDuration(v.duration_seconds)}</p>
                        </div>
                        <span className="text-xs text-[#444]">{fmtWhen(v.created_at)}</span>
                      </div>
                      <audio controls src={v.recording_url || undefined} className="w-full h-8" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function PhonePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0c0c0c]" />}>
      <PhoneInner />
    </Suspense>
  );
}
