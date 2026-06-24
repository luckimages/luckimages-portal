"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  type: string;
  stage: string;
  notes: string | null;
  total_invoices: number;
  total_revenue: number;
  is_hot: boolean;
  created_at: string;
};

type CallLog = {
  id: string;
  outcome: string;
  notes: string | null;
  called_at: string;
  called_by: string;
  listing_address: string | null;
};

type EmailLog = {
  id: string;
  subject: string;
  body: string | null;
  sent_at: string;
  sent_by: string;
};

type Shoot = {
  id: string;
  address: string;
  shoot_date: string;
  status: string;
  package: string | null;
  price: number | null;
};

type TimelineEvent =
  | { kind: "call"; ts: string; data: CallLog }
  | { kind: "email"; ts: string; data: EmailLog }
  | { kind: "shoot"; ts: string; data: Shoot };

const STAGES = ["lead", "interested", "follow-up", "booked", "client", "dead"];
const STAGE_COLORS: Record<string, string> = {
  lead: "bg-zinc-700 text-zinc-300",
  interested: "bg-blue-900 text-blue-300",
  "follow-up": "bg-yellow-900 text-yellow-300",
  booked: "bg-green-900 text-green-300",
  client: "bg-emerald-900 text-emerald-300",
  dead: "bg-red-950 text-red-400",
};

const CALL_COLORS: Record<string, string> = {
  interested: "text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20",
  call_again: "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20",
  dead: "text-[#555] bg-white/5 border-white/5",
};
const CALL_LABELS: Record<string, string> = {
  interested: "Interested",
  call_again: "Call Again",
  dead: "Dead",
  no_answer: "No Answer",
  not_interested: "Not Interested",
  callback: "Callback",
  booked: "Booked",
};

export default function ContactProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "" });
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const loadContact = useCallback(async () => {
    const supabase = createClient();
    const [{ data: c }, { data: calls }, { data: emails }, { data: sh }] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).single(),
      supabase.from("cold_calls").select("*").eq("contact_id", id).order("called_at", { ascending: false }),
      supabase.from("email_log").select("*").eq("contact_id", id).order("sent_at", { ascending: false }),
      supabase.from("shoots").select("*").eq("contact_id", id).order("shoot_date", { ascending: false }),
    ]);
    if (!c) { router.replace("/admin/contacts"); return; }
    setContact(c);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", brokerage: c.brokerage || "", stage: c.stage, notes: c.notes || "" });
    setNoteInput(c.notes || "");
    setCallLogs(calls || []);
    setEmailLogs(emails || []);
    setShoots(sh || []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
      else loadContact();
    });
  }, [router, loadContact]);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from("contacts").update({ ...form, updated_at: new Date().toISOString() }).eq("id", contact.id).select().single();
    if (data) setContact(data);
    setSaving(false);
    setEditing(false);
  }

  async function saveNote() {
    if (!contact) return;
    setSavingNote(true);
    const supabase = createClient();
    await supabase.from("contacts").update({ notes: noteInput }).eq("id", contact.id);
    setContact(c => c ? { ...c, notes: noteInput } : c);
    setSavingNote(false);
  }

  async function toggleHot() {
    if (!contact) return;
    const supabase = createClient();
    await supabase.from("contacts").update({ is_hot: !contact.is_hot }).eq("id", contact.id);
    setContact(c => c ? { ...c, is_hot: !c.is_hot } : c);
  }

  async function updateStage(stage: string) {
    if (!contact) return;
    const supabase = createClient();
    await supabase.from("contacts").update({ stage }).eq("id", contact.id);
    setContact(c => c ? { ...c, stage } : c);
  }

  // Build unified timeline
  const timeline: TimelineEvent[] = [
    ...callLogs.map(l => ({ kind: "call" as const, ts: l.called_at, data: l })),
    ...emailLogs.map(l => ({ kind: "email" as const, ts: l.sent_at, data: l })),
    ...shoots.map(s => ({ kind: "shoot" as const, ts: s.shoot_date, data: s })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const callAgainCount = callLogs.filter(l => l.outcome === "call_again").length;
  const isInterested = callLogs.some(l => l.outcome === "interested");

  if (loading) {
    return <div className="min-h-screen bg-[#0c0c0c] text-[#555] flex items-center justify-center text-xs tracking-[3px] uppercase">Loading...</div>;
  }
  if (!contact) return null;

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">

      {/* Header */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-[#555] text-sm hover:text-white transition-colors">← Back</button>
          <div className="flex items-center gap-2">
            <button onClick={toggleHot} className="text-lg leading-none" title="Toggle hot lead">
              {contact.is_hot ? "🔥" : <span className="text-[#333] hover:text-[#555] text-lg">🔥</span>}
            </button>
            <h1 className="font-bold">{contact.name}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase ${STAGE_COLORS[contact.stage] || "bg-zinc-700 text-zinc-300"}`}>
              {contact.stage}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/admin/cold-calls?contact=${contact.id}`)}
            className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all"
          >
            📞 Call
          </button>
          <button
            onClick={() => setEditing(true)}
            className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

        {/* ═══ LEFT: Contact info + notes ═══ */}
        <div className="space-y-5">

          {/* Info card */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-4">
            <p className="text-xs tracking-[3px] uppercase text-[#555]">Contact Info</p>
            <div className="space-y-3">
              {contact.brokerage && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-0.5">Brokerage</p>
                  <p className="text-sm">{contact.brokerage}</p>
                </div>
              )}
              {contact.phone && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-0.5">Phone</p>
                  <a href={`tel:${contact.phone}`} className="text-sm text-[#4ade80] font-mono">{contact.phone}</a>
                </div>
              )}
              {contact.email && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-0.5">Email</p>
                  <p className="text-sm break-all">{contact.email}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Stage</p>
                <select
                  value={contact.stage}
                  onChange={e => updateStage(e.target.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border-0 cursor-pointer focus:outline-none ${STAGE_COLORS[contact.stage] || "bg-zinc-700 text-zinc-300"}`}
                >
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {contact.total_revenue > 0 && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-0.5">Total Revenue</p>
                  <p className="text-sm font-bold text-[#4ade80]">${contact.total_revenue.toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-0.5">Added</p>
                <p className="text-xs text-[#555]">{new Date(contact.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-3">
            <p className="text-xs tracking-[3px] uppercase text-[#555]">Stats</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0e0e0e] border border-white/5 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{callLogs.length}</p>
                <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Total Calls</p>
              </div>
              <div className="bg-[#0e0e0e] border border-white/5 p-3 text-center">
                <p className={`text-2xl font-bold tabular-nums ${isInterested ? "text-[#4ade80]" : ""}`}>
                  {isInterested ? "🔥" : callAgainCount > 0 ? callAgainCount : "—"}
                </p>
                <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">
                  {isInterested ? "Interested" : callAgainCount > 0 ? "Retries" : "No Activity"}
                </p>
              </div>
              <div className="bg-[#0e0e0e] border border-white/5 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{emailLogs.length}</p>
                <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Emails Sent</p>
              </div>
              <div className="bg-[#0e0e0e] border border-white/5 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{shoots.length}</p>
                <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Shoots</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-3">
            <p className="text-xs tracking-[3px] uppercase text-[#555]">Notes</p>
            <textarea
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              rows={5}
              placeholder="Add notes about this contact..."
              className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 resize-none placeholder:text-[#333]"
            />
            <button
              onClick={saveNote}
              disabled={savingNote || noteInput === (contact.notes || "")}
              className="w-full py-2 text-xs tracking-[1px] uppercase border border-white/10 text-[#888] hover:text-white hover:border-white/30 transition-all disabled:opacity-30"
            >
              {savingNote ? "Saving..." : "Save Notes"}
            </button>
          </div>
        </div>

        {/* ═══ RIGHT: Timeline ═══ */}
        <div className="md:col-span-2 space-y-4">
          <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Interaction History — {timeline.length} events
          </p>

          {timeline.length === 0 ? (
            <div className="bg-[#111] border border-white/10 p-10 text-center">
              <p className="text-[#333] text-sm">No interactions logged yet.</p>
              <button
                onClick={() => router.push(`/admin/cold-calls?contact=${contact.id}`)}
                className="mt-4 text-xs tracking-[1px] uppercase border border-white/10 px-6 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all"
              >
                Log First Call →
              </button>
            </div>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-6 bottom-6 w-px bg-white/5" />

              {timeline.map((event, i) => (
                <div key={`${event.kind}-${i}`} className="flex gap-4 pb-3">
                  {/* Icon dot */}
                  <div className="relative shrink-0 mt-4">
                    <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-base border ${
                      event.kind === "call" ? "bg-[#111] border-white/10" :
                      event.kind === "email" ? "bg-[#111] border-white/10" :
                      "bg-[#111] border-white/10"
                    }`}>
                      {event.kind === "call" ? "📞" : event.kind === "email" ? "✉️" : "📸"}
                    </div>
                  </div>

                  {/* Card */}
                  <div className="flex-1 bg-[#111] border border-white/10 p-4 mt-2">
                    {event.kind === "call" && (() => {
                      const call = event.data as CallLog;
                      return (
                        <>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase border ${CALL_COLORS[call.outcome] || "text-[#555] bg-white/5 border-white/5"}`}>
                                {CALL_LABELS[call.outcome] || call.outcome}
                              </span>
                              <span className="text-xs text-[#555]">Cold Call</span>
                            </div>
                            <span className="text-[10px] text-[#333] shrink-0">
                              {new Date(call.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          {call.listing_address && <p className="text-xs text-[#555]">📍 {call.listing_address}</p>}
                          {call.notes && <p className="text-xs text-[#666] italic mt-1">"{call.notes}"</p>}
                          <p className="text-[10px] text-[#333] mt-1.5">by {call.called_by}</p>
                        </>
                      );
                    })()}

                    {event.kind === "email" && (() => {
                      const email = event.data as EmailLog;
                      return (
                        <>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase text-[#818cf8] bg-[#818cf8]/10 border border-[#818cf8]/20">
                                Email Sent
                              </span>
                            </div>
                            <span className="text-[10px] text-[#333] shrink-0">
                              {new Date(email.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{email.subject}</p>
                          {email.body && (
                            <p className="text-xs text-[#555] mt-1 line-clamp-2">{email.body}</p>
                          )}
                          <p className="text-[10px] text-[#333] mt-1.5">by {email.sent_by}</p>
                        </>
                      );
                    })()}

                    {event.kind === "shoot" && (() => {
                      const shoot = event.data as Shoot;
                      return (
                        <>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase text-[#34d399] bg-[#34d399]/10 border border-[#34d399]/20">
                                Shoot — {shoot.status}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#333] shrink-0">
                              {new Date(shoot.shoot_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{shoot.address}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {shoot.package && <span className="text-xs text-[#555]">{shoot.package}</span>}
                            {shoot.price && <span className="text-xs font-bold text-[#4ade80]">${shoot.price.toLocaleString()}</span>}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => setEditing(false)}>
          <div className="bg-[#111] border border-white/15 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-bold tracking-[2px] uppercase">Edit Contact</p>
              <button onClick={() => setEditing(false)} className="text-[#555] hover:text-white">✕</button>
            </div>
            <form onSubmit={saveEdit} className="space-y-3">
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Name *"
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone"
                  className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Email"
                  className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
              </div>
              <input value={form.brokerage} onChange={e => setForm(f => ({ ...f, brokerage: e.target.value }))}
                placeholder="Brokerage"
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30">
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditing(false)}
                  className="flex-1 py-3 text-xs tracking-[1px] uppercase border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 text-xs tracking-[1px] uppercase bg-white text-black hover:bg-[#ddd] transition-colors font-bold disabled:opacity-40">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
