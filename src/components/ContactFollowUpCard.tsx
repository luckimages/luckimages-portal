"use client";

import { useState } from "react";

export type FollowUpTodo = {
  id: string;
  title: string | null;
  notes: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  created_by?: string | null;
  completed_at: string | null;
  completed_by: string | null;
};

type Assignee = "ryan" | "leif" | "both";
const ASSIGNEE_LABEL: Record<Assignee, string> = { ryan: "Ryan", leif: "Leif", both: "Ryan & Leif" };
const NEXT_ASSIGNEE: Record<Assignee, Assignee> = { ryan: "leif", leif: "both", both: "ryan" };

// Local (Austin) calendar dates as YYYY-MM-DD.
function localToday(): string {
  return new Date().toLocaleDateString("en-CA");
}
function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function describeDue(due: string): { text: string; cls: string } {
  const today = localToday();
  const days = Math.round((Date.parse(`${due.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const pretty = new Date(`${due.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (days < 0) return { text: `${pretty} · ${-days} day${days === -1 ? "" : "s"} overdue`, cls: "text-red-400" };
  if (days === 0) return { text: "Due today", cls: "text-[#fbbf24]" };
  if (days === 1) return { text: `Tomorrow · ${pretty}`, cls: "text-white" };
  return { text: `${pretty} · in ${days} days`, cls: "text-white" };
}

// Contact page card: the contact's next follow-up (set / move / done / who
// owns it) plus their Do Not Contact + email-unsubscribe status.
export default function ContactFollowUpCard({
  contactId, meEmail, open, available, doNotContact, unsubscribedAt, onChanged, onToggleDoNotContact, onClearUnsubscribe,
}: {
  contactId: string;
  meEmail: string;
  open: FollowUpTodo | null;
  available: boolean;
  doNotContact: boolean;
  unsubscribedAt: string | null;
  onChanged: () => void;
  onToggleDoNotContact: (next: boolean) => Promise<void>;
  onClearUnsubscribe: () => Promise<void>;
}) {
  const me = (meEmail.split("@")[0] || "").toLowerCase();
  const [note, setNote] = useState("");
  const [newAssignee, setNewAssignee] = useState<Assignee>(me === "ryan" || me === "leif" ? me : "both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, ...body }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Couldn't save the follow-up.");
      return;
    }
    setNote("");
    window.parent?.postMessage({ type: "nocturne:follow-ups-changed" }, window.location.origin);
    onChanged();
  }

  function schedule(dueDate: string) {
    if (!dueDate) return;
    if (open) post({ action: "set", dueDate });
    else post({ action: "set", dueDate, note, assignee: newAssignee });
  }

  const quickDates = [{ label: "Tomorrow", days: 1 }, { label: "3 Days", days: 3 }, { label: "1 Week", days: 7 }];
  const btn = "text-[10px] tracking-[1px] uppercase py-2 px-3 border border-white/15 text-[#aaa] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40";
  const due = open?.due_date ? describeDue(open.due_date) : null;

  return (
    <div className="bg-[#111] border border-white/10 divide-y divide-white/5">
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Next Follow-up</p>
          {open && (
            <button
              onClick={() => post({ action: "set", dueDate: open.due_date || localToday(), assignee: NEXT_ASSIGNEE[(open.assigned_to as Assignee) || "both"] })}
              disabled={busy}
              title="Click to change who owns this follow-up"
              className="text-[10px] tracking-[1px] uppercase px-2 py-1 border border-white/10 text-[#888] hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
            >
              {ASSIGNEE_LABEL[(open.assigned_to as Assignee) || "both"] || "Ryan & Leif"}
            </button>
          )}
        </div>

        {!available ? (
          <p className="text-xs text-[#444]">Follow-ups turn on once the CRM database update (supabase-crm-phase1.sql) has been run.</p>
        ) : open ? (
          <>
            {due && <p className={`text-sm font-semibold ${due.cls}`}>{due.text}</p>}
            {open.title && <p className="text-xs text-[#888]">{open.title}</p>}
            {open.notes && <p className="text-xs text-[#666] whitespace-pre-line">{open.notes}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button onClick={() => post({ action: "complete" })} disabled={busy}
                className="text-[10px] tracking-[1px] uppercase font-bold py-2 px-4 bg-[#4ade80] text-black hover:bg-[#34d399] transition-colors disabled:opacity-40">
                ✓ Done
              </button>
              <span className="text-[10px] text-[#444] uppercase tracking-[1px] ml-1">Move to</span>
              {quickDates.map(o => (
                <button key={o.days} onClick={() => schedule(plusDays(o.days))} disabled={busy} className={btn}>{o.label}</button>
              ))}
              <input type="date" onChange={e => schedule(e.target.value)} disabled={busy}
                className="bg-[#1a1a1a] border border-white/10 text-white text-xs px-2 py-1.5 outline-none focus:border-white/30 [color-scheme:dark]" />
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-[#555]">No follow-up scheduled.</p>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="What's the follow-up about? (optional)"
              className="w-full bg-[#1a1a1a] border border-white/10 text-white text-xs px-3 py-2 outline-none focus:border-white/30 placeholder:text-[#444]" />
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setNewAssignee(a => NEXT_ASSIGNEE[a])} disabled={busy} className={btn} title="Who owns it — click to change">
                {ASSIGNEE_LABEL[newAssignee]}
              </button>
              <span className="text-[10px] text-[#444] uppercase tracking-[1px] ml-1">Follow up</span>
              {quickDates.map(o => (
                <button key={o.days} onClick={() => schedule(plusDays(o.days))} disabled={busy} className={btn}>{o.label}</button>
              ))}
              <input type="date" onChange={e => schedule(e.target.value)} disabled={busy}
                className="bg-[#1a1a1a] border border-white/10 text-white text-xs px-2 py-1.5 outline-none focus:border-white/30 [color-scheme:dark]" />
            </div>
          </>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={doNotContact}
            onClick={() => onToggleDoNotContact(!doNotContact)}
            className={`relative w-9 h-5 rounded-full transition-colors ${doNotContact ? "bg-red-500" : "bg-white/15"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${doNotContact ? "left-[18px]" : "left-0.5"}`} />
          </button>
          <span className={`text-[10px] tracking-[2px] uppercase ${doNotContact ? "text-red-400" : "text-[#555]"}`}>Do Not Contact</span>
        </label>
        {unsubscribedAt ? (
          <p className="text-[11px] text-[#666]">
            Unsubscribed from emails {new Date(unsubscribedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" · "}
            <button
              onClick={() => { if (confirm("Only do this if they asked to get emails again. Resubscribe them?")) onClearUnsubscribe(); }}
              className="underline hover:text-white transition-colors"
            >
              Undo
            </button>
          </p>
        ) : (
          <p className="text-[11px] text-[#444]">Subscribed to emails</p>
        )}
      </div>
    </div>
  );
}
