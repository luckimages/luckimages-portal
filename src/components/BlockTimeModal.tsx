"use client";

import { useState, type ReactNode } from "react";

// Shared "block time off" modal — used by the Master Calendar and My
// Nocturne so Ryan/Leif mark days or specific hours they can't shoot from
// either place, against the same /api/admin/availability blocks.

export type Block = { id: string; user_id: string; user_name: string; all_day: boolean; start_at: string; end_at: string; note: string | null };

function toDateStr(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtT(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function blockWhenLabel(b: Block): string {
  const dOpts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  const sD = new Date(b.start_at), eD = new Date(b.end_at);
  const sameDay = toDateStr(b.start_at) === toDateStr(b.end_at);
  if (b.all_day) {
    return sameDay
      ? `${sD.toLocaleDateString("en-US", dOpts)} · All day`
      : `${sD.toLocaleDateString("en-US", dOpts)} – ${eD.toLocaleDateString("en-US", dOpts)} · All day`;
  }
  return sameDay
    ? `${sD.toLocaleDateString("en-US", dOpts)} · ${fmtT(b.start_at)} – ${fmtT(b.end_at)}`
    : `${sD.toLocaleDateString("en-US", dOpts)} ${fmtT(b.start_at)} – ${eD.toLocaleDateString("en-US", dOpts)} ${fmtT(b.end_at)}`;
}

export default function BlockTimeModal({ block, onClose, onSaved }: { block?: Block; onClose: () => void; onSaved: () => void }) {
  const todayStr = toDateStr(new Date().toISOString());
  const [uiMode, setUiMode] = useState<"view" | "edit">(block ? "view" : "edit");
  const [mode, setMode] = useState<"days" | "times">(block ? (block.all_day ? "days" : "times") : "days");
  const [startDate, setStartDate] = useState(block ? toDateStr(block.start_at) : todayStr);
  const [endDate, setEndDate] = useState(block ? toDateStr(block.end_at) : todayStr);
  const [startAt, setStartAt] = useState(block && !block.all_day ? toLocalInput(block.start_at) : `${todayStr}T09:00`);
  const [endAt, setEndAt] = useState(block && !block.all_day ? toLocalInput(block.end_at) : `${todayStr}T17:00`);
  const [note, setNote] = useState(block?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    let sIso: string, eIso: string, allDay: boolean;
    if (mode === "days") {
      if (!startDate || !endDate) { setErr("Pick a start and end day"); return; }
      if (endDate < startDate) { setErr("End day is before start day"); return; }
      sIso = new Date(`${startDate}T00:00:00`).toISOString();
      eIso = new Date(`${endDate}T23:59:59`).toISOString();
      allDay = true;
    } else {
      if (!startAt || !endAt) { setErr("Pick a start and end time"); return; }
      if (new Date(endAt) <= new Date(startAt)) { setErr("End is before start"); return; }
      sIso = new Date(startAt).toISOString();
      eIso = new Date(endAt).toISOString();
      allDay = false;
    }
    setSaving(true);
    const res = await fetch("/api/admin/availability", {
      method: block ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: block?.id, allDay, startAt: sIso, endAt: eIso, note }),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setErr((await res.json().catch(() => ({}))).error || "Couldn't save");
  }

  async function remove() {
    if (!block) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/availability?id=${block.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) onSaved();
    else setErr("Couldn't remove this block");
  }

  const inputCls = "w-full bg-[#181818] border border-white/10 text-white text-base px-4 py-3 outline-none focus:border-white/30";
  const heading = block
    ? (uiMode === "view" ? `${block.user_name} has blocked this time` : "Edit time block")
    : "Mark when you can't shoot";

  const shell = (children: ReactNode) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75" />
      <div className="relative bg-[#141414] border border-white/10 w-full max-w-2xl p-8 md:p-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-[11px] tracking-[3px] uppercase text-[#666] mb-1.5">Block Time</p>
            <p className="text-xl font-black tracking-tight">{heading}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );

  if (block && uiMode === "view") {
    return shell(
      <>
        <div className="mt-6 border border-white/10 divide-y divide-white/10">
          <div className="px-4 py-3.5">
            <p className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1">When</p>
            <p className="text-base text-white">{blockWhenLabel(block)}</p>
          </div>
          {block.note && (
            <div className="px-4 py-3.5">
              <p className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1">Note</p>
              <p className="text-base text-white">{block.note}</p>
            </div>
          )}
        </div>
        {err && <p className="text-xs text-red-400 mt-3">{err}</p>}
        <div className="flex gap-3 mt-7">
          <button onClick={() => { setUiMode("edit"); setErr(""); }}
            className="flex-1 text-xs tracking-[2px] uppercase font-bold text-black bg-white hover:bg-white/90 py-3.5 transition-colors">
            Edit Time Block
          </button>
          <button onClick={onClose}
            className="flex-1 text-xs tracking-[2px] uppercase text-white/60 hover:text-white py-3.5 border border-white/10 hover:border-white/30 transition-colors">
            Cancel
          </button>
        </div>
      </>
    );
  }

  return shell(
    <>
      <p className="text-sm text-white/50 mt-2 mb-5">Leif and Ryan both see this — so nobody books a shoot into your time off.</p>

      <div className="flex gap-1 border border-white/10 p-0.5 mb-5">
        {(["days", "times"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 text-[11px] tracking-[1px] uppercase py-2 transition-colors ${mode === m ? "bg-white text-black font-bold" : "text-[#666] hover:text-white"}`}>
            {m === "days" ? "Full Day(s)" : "Specific Times"}
          </button>
        ))}
      </div>

      {mode === "days" ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1.5 block">From</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1.5 block">Through</label>
            <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1.5 block">Start</label>
            <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1.5 block">End</label>
            <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1.5 block">Note (optional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
          placeholder="e.g. Family trip, other job, appointment" className={`${inputCls} resize-none`} />
      </div>

      {err && <p className="text-xs text-red-400 mt-3">{err}</p>}

      <div className="flex gap-3 mt-7">
        <button onClick={save} disabled={saving}
          className="flex-1 text-xs tracking-[2px] uppercase font-bold text-black bg-white hover:bg-white/90 py-3.5 transition-colors disabled:opacity-40">
          {saving ? "Saving…" : block ? "Save Changes" : "Block This Time"}
        </button>
        <button onClick={block ? () => { setUiMode("view"); setErr(""); } : onClose}
          className="flex-1 text-xs tracking-[2px] uppercase text-white/60 hover:text-white py-3.5 border border-white/10 hover:border-white/30 transition-colors">
          Cancel
        </button>
      </div>
      {block && (
        <button onClick={remove} disabled={deleting}
          className="w-full mt-3 text-[11px] tracking-[1.5px] uppercase text-[#f87171]/80 hover:text-[#f87171] transition-colors disabled:opacity-40">
          {deleting ? "Removing…" : "Remove this block"}
        </button>
      )}
    </>
  );
}
