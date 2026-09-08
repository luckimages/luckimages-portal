"use client";

import { useMemo, useState } from "react";

// "[REBUTTAL:<originalISO>|<proposedISO>]" leading line in notes — the shoot
// has no dedicated columns for the reschedule negotiation, so the realtor's
// original request and our counter-proposal both live in this marker (see
// api/admin/reschedule-request). Pipe-delimited because ISO timestamps
// contain colons.
export function parseRebuttal(raw: string | null | undefined): { original: string | null; proposed: string | null; rest: string } {
  const str = raw || "";
  const m = str.match(/^\[REBUTTAL:([^|]+)\|([^\]]+)\]\n?([\s\S]*)$/);
  if (m) return { original: m[1], proposed: m[2], rest: m[3] || "" };
  return { original: null, proposed: null, rest: str };
}

export type PendingShootModalShoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  notes: string | null;
  client_name?: string | null;
};

type Props = {
  shoot: PendingShootModalShoot;
  onClose: () => void;
  /** Fired after a successful Confirm & Notify. */
  onConfirmed?: (id: string) => void;
  /** Fired after a proposed time is emailed to the realtor. */
  onProposed?: (id: string, proposedIso: string) => void;
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// One place to accept or push back on a pending booking request — usable
// anywhere a pending shoot is shown (dashboard widget, Shoot Log, board).
// Keeps the realtor's requested time visible in its own field while the
// admin edits a separate "our proposed time" field, so the original ask is
// never overwritten on screen.
export default function PendingShootModal({ shoot, onClose, onConfirmed, onProposed }: Props) {
  const reb = useMemo(() => parseRebuttal(shoot.notes), [shoot.notes]);

  // The realtor's true original request: the stashed original if we've already
  // countered once, otherwise whatever's currently on the shoot.
  const requestedIso = reb.original || shoot.scheduled_at;
  const alreadyProposed = reb.proposed;

  const [proposed, setProposed] = useState(() =>
    toDatetimeLocal(alreadyProposed || shoot.scheduled_at || new Date().toISOString())
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"confirm" | "propose" | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  async function confirm() {
    setBusy("confirm"); setErr(""); setDone("");
    try {
      const res = await fetch("/api/admin/confirm-booking", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shootId: shoot.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || "Couldn't confirm"); setBusy(null); return; }
      setDone("Confirmed — realtor notified & calendar invite sent ✓");
      onConfirmed?.(shoot.id);
      setTimeout(onClose, 900);
    } catch {
      setErr("Network error"); setBusy(null);
    }
  }

  async function propose() {
    if (!proposed) return;
    setBusy("propose"); setErr(""); setDone("");
    const iso = new Date(proposed).toISOString();
    try {
      const res = await fetch("/api/admin/reschedule-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shootId: shoot.id, proposedTime: iso, message: note || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || "Couldn't send"); setBusy(null); return; }
      setDone(data.emailed ? "Proposed time sent to the realtor ✓" : "Proposed time saved — realtor has no email on file");
      onProposed?.(shoot.id, iso);
      setTimeout(onClose, 1100);
    } catch {
      setErr("Network error"); setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75" />
      <div className="relative bg-[#141414] border border-[#fbbf24]/30 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[3px] uppercase text-[#fbbf24]">Pending Request</p>
            <p className="text-sm font-semibold mt-1 leading-snug">{shoot.address}</p>
            {shoot.client_name && <p className="text-xs text-white/40 mt-0.5">{shoot.client_name}</p>}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-lg leading-none shrink-0">✕</button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Confirm as-is */}
          <div className="border border-white/10 p-4">
            <p className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1">Realtor requested</p>
            <p className="text-sm text-white font-medium">{fmt(requestedIso)}</p>
            <button
              onClick={confirm}
              disabled={busy !== null}
              className="mt-3 w-full text-xs tracking-[2px] uppercase font-bold text-black bg-[#4ade80] hover:bg-[#34d399] py-3 transition-colors disabled:opacity-40"
            >
              {busy === "confirm" ? "Confirming…" : "Confirm This Time & Notify"}
            </button>
          </div>

          {/* Push back with a different time */}
          <div className="border border-white/10 p-4">
            <p className="text-[10px] tracking-[2px] uppercase text-white/40 mb-2">
              {alreadyProposed ? "Update your proposed time" : "Or propose a different time"}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] tracking-[1.5px] uppercase text-white/30 mb-1">They asked for</p>
                <div className="bg-[#0f0f0f] border border-white/10 text-white/50 text-xs px-3 py-2.5 select-none">
                  {fmt(requestedIso)}
                </div>
              </div>
              <div>
                <p className="text-[9px] tracking-[1.5px] uppercase text-[#fbbf24]/70 mb-1">We propose</p>
                <input
                  type="datetime-local"
                  value={proposed}
                  onChange={e => setProposed(e.target.value)}
                  onClick={e => { try { (e.currentTarget as HTMLInputElement).showPicker(); } catch {} }}
                  className="w-full bg-[#181818] border border-[#fbbf24]/30 text-white text-xs px-3 py-2 outline-none focus:border-[#fbbf24]/60"
                />
              </div>
            </div>

            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional note to the realtor — e.g. why that time doesn't work…"
              rows={3}
              className="mt-3 w-full bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30 resize-none placeholder:text-white/20"
            />

            <button
              onClick={propose}
              disabled={busy !== null || !proposed}
              className="mt-3 w-full text-xs tracking-[2px] uppercase font-bold text-black bg-[#fbbf24] hover:bg-[#fbbf24]/90 py-3 transition-colors disabled:opacity-40"
            >
              {busy === "propose" ? "Sending…" : alreadyProposed ? "Send Updated Time" : "Send Proposed Time"}
            </button>

            {alreadyProposed && (
              <p className="text-[10px] text-[#fbbf24] mt-2">
                {"⏳ Currently awaiting the realtor's reply to "}{fmt(alreadyProposed)}
              </p>
            )}
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}
          {done && <p className="text-xs text-[#4ade80]">{done}</p>}
        </div>
      </div>
    </div>
  );
}
