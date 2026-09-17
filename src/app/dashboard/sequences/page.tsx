"use client";

import { useEffect, useState } from "react";

type Step = { day: number; kind: "email" | "call" | "text"; subject?: string; body?: string; note?: string };
type Counts = { active: number; completed: number; stopped: number };
type Sequence = { id: string; name: string; description: string | null; active: boolean; steps: Step[]; counts: Counts };
type Draft = { id?: string; name: string; description: string; active: boolean; steps: Step[] };
type Enrollment = {
  id: string; contact_id: string; status: string; next_step: number; next_run_on: string | null;
  started_on: string; stopped_reason: string | null; enrolled_by: string | null; created_at: string;
  contact: { id: string; name: string; brokerage: string | null; email: string | null } | null;
};
type ContactHit = { id: string; name: string; brokerage: string | null; email: string | null };

const STOP_REASONS: Record<string, string> = {
  replied: "Replied",
  booked: "Booked a shoot",
  unsubscribed: "Unsubscribed",
  do_not_contact: "Do Not Contact",
  marked_dead: "Marked dead",
  manual: "Stopped by hand",
  contact_deleted: "Contact deleted",
  sequence_deleted: "Sequence deleted",
};

const KIND_LABEL: Record<Step["kind"], string> = { email: "Email (sends automatically)", call: "Call (follow-up for you)", text: "Text (follow-up for you)" };

// A starting point — nothing is saved until Save is clicked, so edit freely.
const STARTER: Draft = {
  name: "New Lead — First Two Weeks",
  description: "For fresh leads from cold calls and the website.",
  active: true,
  steps: [
    { day: 0, kind: "email", subject: "Photos for your next listing", body: "Hi {first_name},\n\nThanks for connecting with Luck Images. We shoot Real Estate photography, drone, and twilight across Austin, with next-day delivery.\n\nYou can see our work and pricing at https://www.luckimages.com/pricing — and when you have a listing coming up, you can book right from our client portal.\n\n{sender_name}\nLuck Images" },
    { day: 2, kind: "call", note: "Intro call — ask about upcoming listings and how they handle photos now." },
    { day: 5, kind: "text", note: "Short text: share a favorite recent gallery and ask if anything's coming up." },
    { day: 9, kind: "email", subject: "Anything coming up?", body: "Hi {first_name},\n\nJust checking in — do you have any listings coming up in the next few weeks? Happy to hold a spot on the calendar for you.\n\n{sender_name}\nLuck Images" },
    { day: 14, kind: "call", note: "Last touch — if no answer, leave a short voicemail and move them to nurture." },
  ],
};

const EMPTY_DRAFT: Draft = { name: "", description: "", active: true, steps: [{ day: 0, kind: "email", subject: "", body: "" }] };

const fmtDate = (d: string | null) => d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [enrollTag, setEnrollTag] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contactHits, setContactHits] = useState<ContactHit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/sequences").then(r => r.ok ? r.json() : { sequences: [], unavailable: true }).then(d => {
      setSequences(d.sequences || []);
      setUnavailable(!!d.unavailable);
      setLoaded(true);
    });
    fetch("/api/admin/tags?view=all").then(r => r.ok ? r.json() : { tags: [] }).then(d => setTags(d.tags || []));
  }, []);

  useEffect(() => {
    const q = contactQuery.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q)}`).then(r => r.ok ? r.json() : { contacts: [] }).then(d => setContactHits(d.contacts || []));
    }, 200);
    return () => clearTimeout(timer);
  }, [contactQuery]);

  async function refreshSequences() {
    const d = await fetch("/api/admin/sequences").then(r => r.json());
    setSequences(d.sequences || []);
  }

  async function refreshEnrollments(sequenceId: string) {
    const d = await fetch(`/api/admin/sequences?sequence_id=${sequenceId}`).then(r => r.json());
    setEnrollments(d.enrollments || []);
  }

  function open(s: Sequence) {
    setDraft({ id: s.id, name: s.name, description: s.description || "", active: s.active, steps: s.steps.map(st => ({ ...st })) });
    setMessage(null);
    setEnrollments([]);
    refreshEnrollments(s.id);
  }

  function startNew(template: Draft) {
    setDraft({ ...template, steps: template.steps.map(st => ({ ...st })) });
    setEnrollments([]);
    setMessage(null);
  }

  function updateStep(i: number, patch: Partial<Step>) {
    setDraft(d => d && { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  }

  function addStep(kind: Step["kind"]) {
    setDraft(d => {
      if (!d) return d;
      const lastDay = d.steps.length ? Math.max(...d.steps.map(s => s.day)) : -2;
      const step: Step = kind === "email" ? { day: lastDay + 2, kind, subject: "", body: "" } : { day: lastDay + 2, kind, note: "" };
      return { ...d, steps: [...d.steps, step] };
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", ...draft }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMessage({ text: d.error || "Couldn't save.", error: true }); return; }
    setDraft({ id: d.sequence.id, name: d.sequence.name, description: d.sequence.description || "", active: d.sequence.active, steps: d.sequence.steps });
    setMessage({ text: "Saved." });
    refreshSequences();
  }

  async function remove() {
    if (!draft?.id || !confirm(`Delete "${draft.name}"? Everyone still in it stops.`)) return;
    await fetch("/api/admin/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: draft.id }) });
    setDraft(null);
    refreshSequences();
  }

  async function enroll(payload: { contactIds?: string[]; tag?: string }) {
    if (!draft?.id) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enroll", sequenceId: draft.id, ...payload }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage({ text: d.error || "Couldn't enroll.", error: true }); return; }
    const skipped = d.skipped ? ` ${d.skipped} skipped (already in a sequence, Do Not Contact, or dead).` : "";
    const when = d.enrolled === 0 ? "" : d.ranNow ? " Day-0 steps went out now." : " Their first steps run with tomorrow morning's send.";
    setMessage({ text: `Enrolled ${d.enrolled}.${skipped}${when}` });
    setContactQuery("");
    setContactHits([]);
    refreshEnrollments(draft.id);
    refreshSequences();
  }

  async function stopEnrollment(e: Enrollment) {
    if (!draft?.id || !confirm(`Stop the sequence for ${e.contact?.name || "this contact"}?`)) return;
    await fetch("/api/admin/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop", enrollmentId: e.id }) });
    refreshEnrollments(draft.id);
    refreshSequences();
  }

  const inputCls = "w-full bg-[#1a1a1a] border border-white/10 text-white text-xs px-3 py-2 outline-none focus:border-white/30 placeholder:text-[#444]";
  const saved = sequences.find(s => s.id === draft?.id);
  const selectedTag = tags.find(t => t.tag === enrollTag);

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="px-4 md:px-8 py-8 w-full space-y-6">
        <div>
          <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-1">Command Center</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">Sequences</h1>
          <p className="text-xs text-[#555] mt-1 max-w-3xl">
            Follow-up on autopilot. Emails send on their own (with the unsubscribe footer); calls and texts show up as follow-ups for you to do.
            Someone leaves a sequence automatically when they reply, book a shoot, unsubscribe, or get marked Do Not Contact or dead.
          </p>
        </div>

        {unavailable && (
          <p className="text-xs text-[#fbbf24]">Sequences turn on once supabase-crm-phase2-3.sql has been run in Supabase.</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* ── Sequence list ── */}
          <div className="bg-[#111] border border-white/10">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <p className="text-xs tracking-[2px] uppercase text-[#888] font-semibold">Sequences</p>
              <button onClick={() => startNew(EMPTY_DRAFT)} className="text-[10px] tracking-[1px] uppercase text-white border border-white/20 px-2 py-1 hover:bg-white/5">+ New</button>
            </div>
            {!loaded ? (
              <p className="text-xs text-[#444] italic p-4">Loading...</p>
            ) : sequences.length === 0 ? (
              <div className="p-4 space-y-3">
                <p className="text-xs text-[#555]">No sequences yet.</p>
                <button onClick={() => startNew(STARTER)} className="w-full text-[10px] tracking-[1px] uppercase text-black bg-white py-2 font-bold hover:bg-white/90">Start from a template</button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {sequences.map(s => (
                  <button key={s.id} onClick={() => open(s)}
                    className={`w-full text-left px-4 py-3 transition-colors ${draft?.id === s.id ? "bg-white/[0.06]" : "hover:bg-white/[0.02]"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.active ? "bg-[#4ade80]" : "bg-[#444]"}`} />
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                    </div>
                    <p className="text-[11px] text-[#555] mt-0.5">{s.steps.length} steps · {s.counts.active} active · {s.counts.completed} finished</p>
                  </button>
                ))}
                <button onClick={() => startNew(STARTER)} className="w-full text-left px-4 py-2.5 text-[10px] tracking-[1px] uppercase text-[#555] hover:text-white">+ From template</button>
              </div>
            )}
          </div>

          {/* ── Editor + enrollment ── */}
          {!draft ? (
            <div className="bg-[#111] border border-white/10 p-10 text-center">
              <p className="text-xs text-[#444]">Pick a sequence, or create one.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-[#111] border border-white/10 p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
                  <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Sequence name" className={`${inputCls} text-sm font-semibold`} />
                  <label className="flex items-center gap-2 text-[10px] tracking-[1px] uppercase text-[#888] cursor-pointer select-none py-2">
                    <input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} className="accent-white" />
                    On
                  </label>
                </div>
                <input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Who it's for (optional)" className={inputCls} />

                <div className="space-y-3">
                  {draft.steps.map((s, i) => (
                    <div key={i} className="border border-white/10 p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] tracking-[1px] uppercase text-[#555]">Day</span>
                        <input type="number" min={0} max={365} value={s.day} onChange={e => updateStep(i, { day: Number(e.target.value) })}
                          className="w-16 bg-[#1a1a1a] border border-white/10 text-white text-xs px-2 py-1.5 outline-none focus:border-white/30" />
                        <select value={s.kind} onChange={e => updateStep(i, { kind: e.target.value as Step["kind"] })}
                          className="bg-[#1a1a1a] border border-white/10 text-xs text-[#ccc] px-2 py-1.5 outline-none">
                          {(["email", "call", "text"] as const).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                        </select>
                        <button onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}
                          className="ml-auto text-[10px] tracking-[1px] uppercase text-[#555] hover:text-red-400">Remove</button>
                      </div>
                      {s.kind === "email" ? (
                        <>
                          <input value={s.subject || ""} onChange={e => updateStep(i, { subject: e.target.value })} placeholder="Subject" className={inputCls} />
                          <textarea value={s.body || ""} onChange={e => updateStep(i, { body: e.target.value })} rows={7}
                            placeholder="Message — use {first_name} and {sender_name}" className={`${inputCls} resize-y leading-relaxed`} />
                        </>
                      ) : (
                        <input value={s.note || ""} onChange={e => updateStep(i, { note: e.target.value })}
                          placeholder={s.kind === "call" ? "What the call is about" : "What to text"} className={inputCls} />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2 flex-wrap">
                    {(["email", "call", "text"] as const).map(k => (
                      <button key={k} onClick={() => addStep(k)} className="text-[10px] tracking-[1px] uppercase text-[#aaa] border border-white/15 px-3 py-1.5 hover:text-white hover:bg-white/5">+ {k}</button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#444]">Days count from the day someone is enrolled. Steps run in day order when you save. Emails go out with the morning send (around 9–10am).</p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button onClick={save} disabled={saving} className="text-xs tracking-[1px] uppercase font-bold py-2 px-5 bg-white text-black hover:bg-white/90 disabled:opacity-40">
                    {saving ? "Saving..." : "Save"}
                  </button>
                  {draft.id && <button onClick={remove} className="text-[10px] tracking-[1px] uppercase text-[#555] hover:text-red-400">Delete sequence</button>}
                  {message && <p className={`text-xs ${message.error ? "text-red-400" : "text-[#4ade80]"}`}>{message.text}</p>}
                </div>
              </div>

              {saved && (
                <div className="bg-[#111] border border-white/10 p-5 space-y-4">
                  <p className="text-xs tracking-[2px] uppercase text-[#888] font-semibold">Enroll</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] tracking-[1px] uppercase text-[#555]">One contact</p>
                      <input value={contactQuery} onChange={e => { setContactQuery(e.target.value); if (e.target.value.trim().length < 2) setContactHits([]); }}
                        placeholder="Search by name, email, phone..." className={inputCls} />
                      {contactHits.length > 0 && (
                        <div className="border border-white/10 divide-y divide-white/5 max-h-56 overflow-y-auto">
                          {contactHits.map(c => (
                            <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-xs text-white truncate">{c.name}</p>
                                <p className="text-[10px] text-[#555] truncate">{[c.brokerage, c.email].filter(Boolean).join(" · ")}</p>
                              </div>
                              <button onClick={() => enroll({ contactIds: [c.id] })} disabled={busy}
                                className="text-[10px] tracking-[1px] uppercase text-white border border-white/20 px-2 py-1 hover:bg-white/5 disabled:opacity-40 shrink-0">Enroll</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] tracking-[1px] uppercase text-[#555]">Everyone with a tag</p>
                      <div className="flex gap-2">
                        <select value={enrollTag} onChange={e => setEnrollTag(e.target.value)} className="flex-1 bg-[#1a1a1a] border border-white/10 text-xs text-[#ccc] px-2 py-2 outline-none">
                          <option value="">{tags.length ? "Pick a tag" : "No tags yet — add them on contacts"}</option>
                          {tags.map(t => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}
                        </select>
                        <button
                          onClick={() => { if (selectedTag && confirm(`Enroll all ${selectedTag.count} contacts tagged "${selectedTag.tag}"?`)) enroll({ tag: selectedTag.tag }); }}
                          disabled={!selectedTag || busy}
                          className="text-[10px] tracking-[1px] uppercase text-white border border-white/20 px-3 hover:bg-white/5 disabled:opacity-40">
                          Enroll {selectedTag ? selectedTag.count : ""}
                        </button>
                      </div>
                    </div>
                  </div>
                  {saved && !saved.active && <p className="text-xs text-[#fbbf24]">This sequence is off — turn it on and save to enroll people.</p>}
                </div>
              )}

              {saved && (
                <div className="bg-[#111] border border-white/10">
                  <div className="px-5 py-3 border-b border-white/10">
                    <p className="text-xs tracking-[2px] uppercase text-[#888] font-semibold">People in this sequence</p>
                  </div>
                  {enrollments.length === 0 ? (
                    <p className="text-xs text-[#333] italic p-5">Nobody enrolled yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10 text-[#444] tracking-[1px] uppercase">
                            <th className="text-left px-5 py-2.5 font-normal">Contact</th>
                            <th className="text-left px-3 py-2.5 font-normal">Status</th>
                            <th className="text-left px-3 py-2.5 font-normal">Started</th>
                            <th className="text-left px-3 py-2.5 font-normal">By</th>
                            <th className="px-5 py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {enrollments.map(e => (
                            <tr key={e.id} className="border-b border-white/5">
                              <td className="px-5 py-2.5">
                                <a href={`/admin/contacts/${e.contact_id}`} className="text-white hover:underline">{e.contact?.name || "Contact"}</a>
                                {e.contact?.brokerage && <p className="text-[10px] text-[#555]">{e.contact.brokerage}</p>}
                              </td>
                              <td className="px-3 py-2.5">
                                {e.status === "active" ? (
                                  <span className="text-[#4ade80]">Step {Math.min(e.next_step + 1, saved.steps.length)} of {saved.steps.length} · {fmtDate(e.next_run_on)}</span>
                                ) : e.status === "completed" ? (
                                  <span className="text-[#888]">Finished</span>
                                ) : (
                                  <span className="text-[#fbbf24]">{STOP_REASONS[e.stopped_reason || ""] || "Stopped"}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-[#666]">{fmtDate(e.started_on)}</td>
                              <td className="px-3 py-2.5 text-[#666]">{(e.enrolled_by || "").split("@")[0] || "—"}</td>
                              <td className="px-5 py-2.5 text-right">
                                {e.status === "active" && (
                                  <button onClick={() => stopEnrollment(e)} className="text-[10px] tracking-[1px] uppercase text-[#555] hover:text-red-400">Stop</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
