"use client";

import { useEffect, useState } from "react";

type Enrollment = {
  id: string; sequence_id: string; status: string; next_step: number; next_run_on: string | null;
  stopped_reason: string | null; created_at: string; sequences: { name: string; steps: unknown[] } | null;
};
type SequenceOption = { id: string; name: string; active: boolean; steps: unknown[] };

const STOP_REASONS: Record<string, string> = {
  replied: "they replied", booked: "they booked a shoot", unsubscribed: "they unsubscribed", do_not_contact: "Do Not Contact",
  marked_dead: "marked dead", manual: "stopped by hand", sequence_deleted: "sequence deleted",
};

const fmtDate = (d: string | null) => d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";

// Contact page card: the contact's tags (used for Contacts filters, saved
// views, Outreach, and enrolling a whole tag into a sequence) and their
// sequence. Hidden until supabase-crm-phase2-3.sql has been run.
export default function ContactTagsAndSequence({ contactId, initialTags }: { contactId: string; initialTags: string[] }) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [available, setAvailable] = useState(true);
  const [sequences, setSequences] = useState<SequenceOption[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/tags?view=all").then(r => r.ok ? r.json() : { tags: [], unavailable: true }).then(d => {
      if (d.unavailable) setAvailable(false);
      setAllTags((d.tags || []).map((t: { tag: string }) => t.tag));
    });
    fetch("/api/admin/sequences").then(r => r.ok ? r.json() : { sequences: [] }).then(d => setSequences((d.sequences || []).filter((s: SequenceOption) => s.active && s.steps.length > 0)));
    fetch(`/api/admin/sequences?contact_id=${contactId}`).then(r => r.ok ? r.json() : { enrollments: [] }).then(d => setEnrollments(d.enrollments || []));
  }, [contactId]);

  async function saveTags(next: string[]) {
    setTags(next);
    const res = await fetch("/api/admin/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set", contactId, tags: next }) });
    if (res.ok) {
      const d = await res.json();
      setTags(d.tags);
      setAllTags(prev => [...new Set([...prev, ...d.tags])]);
    }
  }

  function addTag(raw: string) {
    const tag = raw.replace(/,/g, " ").replace(/\s+/g, " ").trim();
    setTagInput("");
    if (!tag || tags.some(t => t.toLowerCase() === tag.toLowerCase())) return;
    // Reuse an existing tag's spelling so "kw lakeway" joins "KW Lakeway".
    const existing = allTags.find(t => t.toLowerCase() === tag.toLowerCase());
    saveTags([...tags, existing || tag]);
  }

  async function refreshEnrollments() {
    const d = await fetch(`/api/admin/sequences?contact_id=${contactId}`).then(r => r.json());
    setEnrollments(d.enrollments || []);
  }

  async function start() {
    if (!pick) return;
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enroll", sequenceId: pick, contactIds: [contactId] }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(d.error || "Couldn't start the sequence."); return; }
    setMessage(d.enrolled === 0 ? (d.note || "Not started.") : d.ranNow ? "Started — the first step went out." : "Started.");
    setPick("");
    window.parent?.postMessage({ type: "nocturne:follow-ups-changed" }, window.location.origin);
    refreshEnrollments();
  }

  async function stop(enrollmentId: string) {
    if (!confirm("Stop this sequence for them?")) return;
    await fetch("/api/admin/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop", enrollmentId }) });
    refreshEnrollments();
  }

  if (!available) return null;

  const active = enrollments.find(e => e.status === "active");
  const last = enrollments[0];

  return (
    <div className="bg-[#111] border border-white/10 divide-y divide-white/5">
      <div className="px-5 py-4">
        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Tags</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-white/[0.06] border border-white/10 text-[#ddd]">
              {t}
              <button onClick={() => saveTags(tags.filter(x => x !== t))} className="text-[#666] hover:text-red-400 leading-none" aria-label={`Remove ${t}`}>×</button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
            onBlur={() => tagInput.trim() && addTag(tagInput)}
            list={`tag-options-${contactId}`}
            placeholder={tags.length ? "+ tag" : "Add a tag (e.g. Luxury, KW Lakeway)"}
            className="min-w-[140px] flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[#444] py-1"
          />
          <datalist id={`tag-options-${contactId}`}>
            {allTags.filter(t => !tags.includes(t)).map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
      </div>

      <div className="px-5 py-4 space-y-2">
        <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Sequence</p>
        {active ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-[#ccc]">
              In <span className="text-white font-semibold">{active.sequences?.name || "a sequence"}</span>
              {" · "}step {active.next_step + 1} of {active.sequences?.steps.length ?? "?"}
              {active.next_run_on ? ` · ${fmtDate(active.next_run_on)}` : ""}
            </p>
            <button onClick={() => stop(active.id)} className="text-[10px] tracking-[1px] uppercase text-[#555] hover:text-red-400">Stop</button>
          </div>
        ) : (
          <>
            {last && (
              <p className="text-[11px] text-[#555]">
                Last: {last.sequences?.name || "sequence"} — {last.status === "completed" ? "finished" : `stopped (${STOP_REASONS[last.stopped_reason || ""] || "stopped"})`}
              </p>
            )}
            {sequences.length === 0 ? (
              <p className="text-[11px] text-[#444]">No sequences turned on yet — build one in Sequences.</p>
            ) : (
              <div className="flex gap-2">
                <select value={pick} onChange={e => setPick(e.target.value)} className="flex-1 bg-[#1a1a1a] border border-white/10 text-xs text-[#ccc] px-2 py-2 outline-none">
                  <option value="">Start a sequence...</option>
                  {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={start} disabled={!pick || busy}
                  className="text-[10px] tracking-[1px] uppercase font-bold px-4 bg-white text-black hover:bg-white/90 disabled:opacity-30">
                  {busy ? "..." : "Start"}
                </button>
              </div>
            )}
          </>
        )}
        {message && <p className="text-[11px] text-[#888]">{message}</p>}
      </div>
    </div>
  );
}
