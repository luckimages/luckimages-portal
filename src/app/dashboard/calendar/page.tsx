"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Shoot = { id: string; address: string; status: string; scheduled_at: string | null; delivered_at: string | null; paid_at: string | null; contact_id: string | null; contact_name: string | null; price: number | null };
type Update = { id: string; message: string; category: string; created_at: string; created_by: string; link?: string };
type Contact = { id: string; name: string; created_at: string; stage: string };
type Call = { id: string; called_at: string; outcome: string; called_by: string; contact_id: string; listing_address: string | null; contact_name: string | null };
type TimeEntry = { id: string; user_id: string; user_name: string; started_at: string; stopped_at: string | null; duration_seconds: number | null };
type Block = { id: string; user_id: string; user_name: string; all_day: boolean; start_at: string; end_at: string; note: string | null };

type CalEvent = {
  id: string;
  type: string;
  label: string;
  time: string;
  meta?: string;
  link?: string;
  raw?: unknown;
};

// ── Colors ─────────────────────────────────────────────────────────────────────
// update_* types split the old single "App Update" bucket by the same
// categories the Command Center posts use, so history is filterable by kind.
const TYPE_STYLE: Record<string, { dot: string; bg: string; border: string; text: string; label: string }> = {
  shoot:            { dot: "bg-[#4ade80]", bg: "bg-[#4ade80]/10", border: "border-[#4ade80]/30", text: "text-[#4ade80]",  label: "Shoot" },
  delivery:         { dot: "bg-[#34d399]", bg: "bg-[#34d399]/10", border: "border-[#34d399]/30", text: "text-[#34d399]",  label: "Delivery" },
  payment:          { dot: "bg-[#86efac]", bg: "bg-[#86efac]/10", border: "border-[#86efac]/30", text: "text-[#86efac]",  label: "Payment" },
  contact:          { dot: "bg-[#fbbf24]", bg: "bg-[#fbbf24]/10", border: "border-[#fbbf24]/30", text: "text-[#fbbf24]",  label: "New Contact" },
  call:             { dot: "bg-[#60a5fa]", bg: "bg-[#60a5fa]/10", border: "border-[#60a5fa]/30", text: "text-[#60a5fa]",  label: "Call" },
  clock_in:         { dot: "bg-[#fb923c]", bg: "bg-[#fb923c]/10", border: "border-[#fb923c]/30", text: "text-[#fb923c]",  label: "Clocked In" },
  clock_out:        { dot: "bg-[#fdba74]", bg: "bg-[#fdba74]/10", border: "border-[#fdba74]/30", text: "text-[#fdba74]",  label: "Clocked Out" },
  update_alerts:    { dot: "bg-red-500",    bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-400",    label: "Alert" },
  update_shoots:    { dot: "bg-[#60a5fa]", bg: "bg-[#60a5fa]/10", border: "border-[#60a5fa]/30", text: "text-[#60a5fa]",  label: "Shoot Update" },
  update_clients:   { dot: "bg-[#fbbf24]", bg: "bg-[#fbbf24]/10", border: "border-[#fbbf24]/30", text: "text-[#fbbf24]",  label: "Client Update" },
  update_marketing: { dot: "bg-[#f472b6]", bg: "bg-[#f472b6]/10", border: "border-[#f472b6]/30", text: "text-[#f472b6]",  label: "Marketing" },
  update_finance:   { dot: "bg-[#4ade80]", bg: "bg-[#4ade80]/10", border: "border-[#4ade80]/30", text: "text-[#4ade80]",  label: "Finance" },
  update_team:      { dot: "bg-[#fb923c]", bg: "bg-[#fb923c]/10", border: "border-[#fb923c]/30", text: "text-[#fb923c]",  label: "Team" },
  update_nocturne:  { dot: "bg-[#a78bfa]", bg: "bg-[#a78bfa]/10", border: "border-[#a78bfa]/30", text: "text-[#a78bfa]",  label: "Nocturne Dev" },
  unavailable:      { dot: "bg-[#f87171]", bg: "bg-[#f87171]/10", border: "border-[#f87171]/40", text: "text-[#f87171]",  label: "Unavailable" },
};

const LEGEND = [
  { type: "shoot",            label: "Shoot Scheduled" },
  { type: "unavailable",      label: "Unavailable" },
  { type: "delivery",         label: "Delivery" },
  { type: "payment",          label: "Payment" },
  { type: "contact",          label: "New Contact" },
  { type: "call",             label: "Cold Call" },
  { type: "clock_in",         label: "Ryan / Leif Clock-in" },
  { type: "update_alerts",    label: "Alert" },
  { type: "update_shoots",    label: "Shoot Update" },
  { type: "update_clients",   label: "Client Update" },
  { type: "update_marketing", label: "Marketing" },
  { type: "update_finance",   label: "Finance" },
  { type: "update_team",      label: "Team" },
  { type: "update_nocturne",  label: "Nocturne Dev" },
];

// Matches the shoot-card status coloring from the old Shoot Log schedule tab.
const SHOOT_CHIP_CLASS: Record<string, string> = {
  pending:   "bg-[#fbbf24]/10 border-[#fbbf24]/20 text-[#fbbf24]",
  completed: "bg-[#4ade80]/10 border-[#4ade80]/20 text-[#4ade80]",
  cancelled: "bg-white/[0.03] border-white/5 text-[#444]",
};
const SHOOT_CHIP_DEFAULT = "bg-[#4ade80]/5 border-[#4ade80]/15 text-[#aaa]";

function toDateStr(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Every calendar day an availability block touches (inclusive).
function blockDays(b: Block): string[] {
  const days: string[] = [];
  const cur = new Date(b.start_at); cur.setHours(0, 0, 0, 0);
  const last = new Date(b.end_at);
  while (cur <= last) { days.push(toDateStr(cur.toISOString())); cur.setDate(cur.getDate() + 1); }
  return days;
}

function blockDayLabel(b: Block, dayStr: string): string {
  if (b.all_day) return "All day";
  const s = new Date(b.start_at), e = new Date(b.end_at);
  const sameDay = (d: Date) => toDateStr(d.toISOString()) === dayStr;
  const from = sameDay(s) ? fmtT(b.start_at) : "12:00 AM";
  const to = sameDay(e) ? fmtT(b.end_at) : "11:59 PM";
  return `${from} – ${to}`;
}
function fmtT(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDuration(sec: number | null) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Naive "+s" breaks on words like "Delivery" → "deliverys" — handle the
// consonant-+-y case (delivery → deliveries) since that's the one legend
// label it actually applies to.
function pluralize(word: string, count: number) {
  if (count === 1) return word;
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  return word + "s";
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [eventMap, setEventMap] = useState<Record<string, CalEvent[]>>({});
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Single-select — exactly one filter is ever active, defaulting to shoots
  // (this page absorbed the old Shoot Log "Schedule" tab, whose whole job
  // was showing scheduled shoots on a month grid).
  const [activeType, setActiveType] = useState<string>("shoot");

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const load = useCallback(async () => {
    setLoading(true);
    const [res, blockRes] = await Promise.all([
      fetch(`/api/admin/calendar?month=${monthKey}`),
      fetch(`/api/admin/availability?month=${monthKey}`),
    ]);
    if (!res.ok) { setLoading(false); return; }
    const { shoots, updates, contacts, calls, timeEntries } = await res.json();
    const blockList: Block[] = blockRes.ok ? (await blockRes.json()).blocks || [] : [];
    setBlocks(blockList);

    const map: Record<string, CalEvent[]> = {};
    function add(dateStr: string, ev: CalEvent) {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(ev);
    }

    // Shoots — cancelled ones live only in the Shoot Log's Cancelled folder,
    // never on the calendar.
    for (const s of shoots as Shoot[]) {
      if (s.status === "cancelled") continue;
      if (s.scheduled_at) {
        const d = toDateStr(s.scheduled_at);
        add(d, { id: `shoot-${s.id}`, type: "shoot", label: s.address, time: s.scheduled_at, meta: s.status, link: "/dashboard/board", raw: s });
      }
      if (s.delivered_at) {
        const d = toDateStr(s.delivered_at);
        add(d, { id: `delivery-${s.id}`, type: "delivery", label: `Delivered — ${s.address}`, time: s.delivered_at, link: "/dashboard/board" });
      }
      if (s.paid_at) {
        const d = toDateStr(s.paid_at);
        add(d, { id: `payment-${s.id}`, type: "payment", label: `Paid ${s.price ? `$${s.price.toLocaleString()}` : ""} — ${s.address}`, time: s.paid_at, link: "/dashboard/board" });
      }
    }

    // Manual/system updates — split by category so they're filterable by kind
    for (const u of updates as Update[]) {
      const d = toDateStr(u.created_at);
      const headline = u.message.split("\n---\n")[0].trim();
      const category = u.category || "nocturne";
      add(d, { id: `update-${u.id}`, type: `update_${category}`, label: headline, time: u.created_at, meta: u.created_by, link: u.link || "/dashboard/updates" });
    }

    // New contacts
    for (const c of contacts as Contact[]) {
      const d = toDateStr(c.created_at);
      add(d, { id: `contact-${c.id}`, type: "contact", label: c.name, time: c.created_at, meta: c.stage, link: `/admin/contacts/${c.id}` });
    }

    // Calls
    for (const c of calls as Call[]) {
      const d = toDateStr(c.called_at);
      add(d, { id: `call-${c.id}`, type: "call", label: c.contact_name || c.listing_address || "Call", time: c.called_at, meta: `${c.called_by} · ${c.outcome.replace(/_/g, " ")}`, link: c.contact_id ? `/admin/contacts/${c.contact_id}` : undefined });
    }

    // Time entries
    for (const t of timeEntries as TimeEntry[]) {
      const dIn = toDateStr(t.started_at);
      add(dIn, { id: `in-${t.id}`, type: "clock_in", label: `${t.user_name} clocked in`, time: t.started_at, meta: t.duration_seconds ? `session: ${fmtDuration(t.duration_seconds)}` : "active" });
      if (t.stopped_at) {
        const dOut = toDateStr(t.stopped_at);
        add(dOut, { id: `out-${t.id}`, type: "clock_out", label: `${t.user_name} clocked out`, time: t.stopped_at, meta: fmtDuration(t.duration_seconds) });
      }
    }

    // Availability blocks — one event per day the block spans
    for (const b of blockList) {
      for (const d of blockDays(b)) {
        add(d, {
          id: `block-${b.id}-${d}`,
          type: "unavailable",
          label: b.note ? `${b.user_name} — ${b.note}` : `${b.user_name} unavailable`,
          time: b.all_day ? `${d}T00:00:00` : (toDateStr(b.start_at) === d ? b.start_at : `${d}T00:00:00`),
          meta: blockDayLabel(b, d),
          raw: b,
        });
      }
    }

    // Sort each day's events by time
    for (const d of Object.keys(map)) {
      map[d].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    }

    setEventMap(map);
    setLoading(false);
  }, [monthKey]);

  useEffect(() => { load(); }, [load]);

  // Calendar grid — Monday-first, matching the old Shoot Log schedule look
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateStr(new Date().toISOString());
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const monthLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const allEvents = Object.values(eventMap).flat();
  const monthCount = allEvents.filter(e => e.type === activeType).length;
  const monthRevenue = activeType === "shoot"
    ? allEvents.filter(e => e.type === "shoot").reduce((sum, e) => sum + ((e.raw as Shoot | undefined)?.price || 0), 0)
    : 0;
  const activeLegendLabel = LEGEND.find(l => l.type === activeType)?.label || "event";

  // Blocks indexed by day (for the always-visible strip on each cell).
  const blocksByDay: Record<string, Block[]> = {};
  for (const b of blocks) for (const d of blockDays(b)) (blocksByDay[d] ||= []).push(b);

  async function deleteBlock(id: string) {
    await fetch(`/api/admin/availability?id=${id}`, { method: "DELETE" });
    load();
  }

  const btnCls = "text-xs tracking-[1px] uppercase text-[#888] hover:text-white hover:border-white/30 transition-colors border border-white/10 px-3 py-1.5";
  // Modal shows the active filter's events for that day, plus availability
  // blocks always (they're conflict info you need whatever you're looking at).
  const selectedAll = selectedDay
    ? (eventMap[selectedDay] || []).filter(e => e.type === activeType || e.type === "unavailable")
    : [];

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <div className="flex-1 flex flex-col px-4 md:px-8 py-8 gap-5 max-w-[1500px] mx-auto w-full">

        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">Unified</p>
              <h1 className="text-3xl font-black tracking-tight uppercase">Master Calendar</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center border border-white/10">
                <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} className="text-[#888] hover:text-white transition-colors px-3 py-1.5 text-sm">‹</button>
                <span className="text-xs tracking-[2px] uppercase text-white px-2 min-w-[130px] text-center">{monthLabel}</span>
                <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} className="text-[#888] hover:text-white transition-colors px-3 py-1.5 text-sm">›</button>
              </div>
              <button onClick={() => setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className={btnCls}>Today</button>
              <select
                value={activeType}
                onChange={e => { setActiveType(e.target.value); setSelectedDay(null); }}
                className="text-xs tracking-[1px] uppercase text-[#888] bg-[#0c0c0c] border border-white/10 px-3 py-1.5 outline-none focus:border-white/30 cursor-pointer hover:text-white transition-colors"
              >
                {LEGEND.map(l => <option key={l.type} value={l.type} className="bg-[#141414] normal-case tracking-normal">{l.label}</option>)}
              </select>
              <button onClick={() => setShowBlockModal(true)} className={btnCls}>Block Time</button>
            </div>
          </div>
          <p className="text-xs text-[#555]">
            {monthCount} {pluralize(activeLegendLabel.toLowerCase(), monthCount)} this month
            {monthRevenue > 0 && <span className="text-[#4ade80] font-semibold"> · ${monthRevenue.toLocaleString()}</span>}
          </p>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="grid grid-cols-7">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-[10px] tracking-[2px] uppercase text-[#666] py-2">{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs tracking-[3px] uppercase text-[#333]">Loading...</p>
            </div>
          ) : (
            <div
              className="flex-1 grid grid-cols-7 gap-px bg-white/[0.07] border border-white/[0.07]"
              style={{ gridTemplateRows: `repeat(${Math.ceil((firstDayOfWeek + daysInMonth) / 7)}, minmax(96px, 1fr))` }}
            >
              {Array.from({ length: Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7 }).map((_, i) => {
                const dayNum = i - firstDayOfWeek + 1;
                if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} className="bg-[#0d0d0d]" />;

                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const dayEvents = (eventMap[dateStr] || []).filter(e => e.type === activeType);
                const dayBlocks = activeType !== "unavailable" ? (blocksByDay[dateStr] || []) : [];
                const isToday = dateStr === todayStr;

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(dateStr)}
                    className={`bg-[#121212] p-1.5 flex flex-col gap-1 text-left cursor-pointer transition-colors hover:bg-[#181818] overflow-hidden ${
                      isToday ? "ring-1 ring-inset ring-white/30" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isToday ? "text-white" : dayEvents.length + dayBlocks.length > 0 ? "text-[#aaa]" : "text-[#555]"}`}>{dayNum}</span>
                      {dayEvents.length + dayBlocks.length > 0 && <span className="text-[9px] text-[#666]">{dayEvents.length + dayBlocks.length}</span>}
                    </div>

                    {dayBlocks.map(b => (
                      <div key={`blk-${b.id}`} className="px-1.5 py-0.5 text-[9px] tracking-[0.5px] uppercase rounded-sm bg-[#f87171]/12 text-[#f87171] truncate">
                        {b.user_name} off{b.all_day ? "" : ` · ${blockDayLabel(b, dateStr).split(" – ")[0]}`}
                      </div>
                    ))}

                    {dayEvents.slice(0, 4).map(ev => {
                      if (ev.type === "shoot") {
                        const shoot = ev.raw as Shoot | undefined;
                        const chipTitle = shoot?.contact_name || ev.label.split(",")[0];
                        const chipClass = SHOOT_CHIP_CLASS[ev.meta || ""] || SHOOT_CHIP_DEFAULT;
                        return (
                          <div key={ev.id} className={`px-1.5 py-1 text-[10px] leading-tight rounded-sm border truncate ${chipClass}`}>
                            <span className="font-semibold">{chipTitle}</span>
                            <span className="opacity-50"> · {fmtTime(ev.time)}</span>
                          </div>
                        );
                      }
                      const s = TYPE_STYLE[ev.type];
                      return (
                        <div key={ev.id} className={`px-1.5 py-1 text-[10px] rounded-sm truncate ${s.bg} ${s.text}`}>
                          {ev.label}
                        </div>
                      );
                    })}
                    {dayEvents.length > 4 && <span className="text-[9px] text-[#666] px-1">+{dayEvents.length - 4} more</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <div className="absolute inset-0 bg-black/75" />
          <div className="relative bg-[#141414] border border-white/10 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#141414]">
              <div>
                <p className="text-[9px] tracking-[2px] uppercase text-[#555]">{new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}</p>
                <p className="text-sm font-bold">{new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-[#555] hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>

            {selectedAll.length === 0 ? (
              <div className="py-14 text-center"><p className="text-xs text-[#444]">Nothing on this day.</p></div>
            ) : (
              <div className="divide-y divide-white/5">
                {selectedAll.map(ev => {
                  const s = TYPE_STYLE[ev.type];
                  return (
                    <div key={ev.id} className="px-5 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${s.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[10px] font-semibold tracking-[1px] uppercase ${s.text} mb-0.5`}>{s.label}</p>
                          <p className="text-sm text-white leading-snug line-clamp-3">{ev.label}</p>
                          {ev.meta && <p className="text-[11px] text-[#666] mt-0.5 capitalize">{ev.meta}</p>}
                          {ev.type !== "unavailable" && <p className="text-[11px] text-[#444] mt-0.5">{fmtTime(ev.time)}</p>}
                          <div className="flex items-center gap-4 mt-1.5">
                            {ev.link && <a href={ev.link} className={`text-[10px] tracking-[1px] uppercase ${s.text} hover:opacity-70 transition-opacity`}>View →</a>}
                            {ev.type === "unavailable" && ev.raw != null && (
                              <button onClick={() => deleteBlock((ev.raw as Block).id)} className="text-[10px] tracking-[1px] uppercase text-[#f87171] hover:opacity-70 transition-opacity">Remove block ✕</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showBlockModal && (
        <BlockTimeModal onClose={() => setShowBlockModal(false)} onSaved={() => { setShowBlockModal(false); load(); }} />
      )}
    </main>
  );
}

// ── Block-time modal ──────────────────────────────────────────────────────────
function BlockTimeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const todayStr = toDateStr(new Date().toISOString());
  const [mode, setMode] = useState<"days" | "times">("days");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [startAt, setStartAt] = useState(`${todayStr}T09:00`);
  const [endAt, setEndAt] = useState(`${todayStr}T17:00`);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allDay, startAt: sIso, endAt: eIso, note }),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setErr((await res.json().catch(() => ({}))).error || "Couldn't save");
  }

  const inputCls = "w-full bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75" />
      <div className="relative bg-[#141414] border border-white/10 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-[10px] tracking-[3px] uppercase text-[#666]">Block Time</p>
            <p className="text-sm font-semibold mt-1">Mark when you can&apos;t shoot</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>
        <p className="text-xs text-white/50 mt-2 mb-4">Leif and Ryan both see this — so nobody books a shoot into your time off.</p>

        <div className="flex gap-1 border border-white/10 p-0.5 mb-4">
          {(["days", "times"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 text-[10px] tracking-[1px] uppercase py-1.5 transition-colors ${mode === m ? "bg-white text-black font-bold" : "text-[#666] hover:text-white"}`}>
              {m === "days" ? "Full Day(s)" : "Specific Times"}
            </button>
          ))}
        </div>

        {mode === "days" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1 block">From</label>
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1 block">Through</label>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1 block">Start</label>
              <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1 block">End</label>
              <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className="text-[10px] tracking-[2px] uppercase text-white/40 mb-1 block">Note (optional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Family trip, other job, appointment" className={inputCls} />
        </div>

        {err && <p className="text-xs text-red-400 mt-3">{err}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={save} disabled={saving}
            className="flex-1 text-xs tracking-[2px] uppercase font-bold text-black bg-white hover:bg-white/90 py-3 transition-colors disabled:opacity-40">
            {saving ? "Saving…" : "Block This Time"}
          </button>
          <button onClick={onClose} className="text-xs tracking-[2px] uppercase text-white/50 hover:text-white px-6 py-3 border border-white/10 hover:border-white/30 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
