"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";

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

// ── Main page ─────────────────────────────────────────────────────────────────
const WEEK_HOUR_START = 8;   // 8 AM
const WEEK_HOUR_END = 20;    // 8 PM
const WEEK_SPAN = WEEK_HOUR_END - WEEK_HOUR_START;

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay()); // Sunday-first
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function CalendarPage() {
  const [view, setView] = useState<"month" | "week">("month");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [eventMap, setEventMap] = useState<Record<string, CalEvent[]>>({});
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [viewBlock, setViewBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Single-select — exactly one filter is ever active, defaulting to shoots
  // (this page absorbed the old Shoot Log "Schedule" tab, whose whole job
  // was showing scheduled shoots on a month grid).
  const [activeType, setActiveType] = useState<string>("shoot");

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const weekStart = startOfWeek(weekAnchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekDayStrs = weekDays.map(d => toDateStr(d.toISOString()));
  // Which month buckets the current view needs from the API.
  const monthsNeeded = view === "month"
    ? [monthKey]
    : [...new Set(weekDayStrs.map(s => s.slice(0, 7)))];
  const monthsKey = monthsNeeded.join(",");

  const load = useCallback(async () => {
    setLoading(true);
    const keys = monthsKey.split(",");
    const packs = await Promise.all(keys.map(k => Promise.all([
      fetch(`/api/admin/calendar?month=${k}`).then(r => (r.ok ? r.json() : null)),
      fetch(`/api/admin/availability?month=${k}`).then(r => (r.ok ? r.json() : null)),
    ])));

    const dedupe = <T extends { id: string }>(arr: T[]) => {
      const seen = new Set<string>();
      return arr.filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true)));
    };
    const shoots = dedupe(packs.flatMap(([c]) => (c?.shoots ?? []) as Shoot[]));
    const updates = dedupe(packs.flatMap(([c]) => (c?.updates ?? []) as Update[]));
    const contacts = dedupe(packs.flatMap(([c]) => (c?.contacts ?? []) as Contact[]));
    const calls = dedupe(packs.flatMap(([c]) => (c?.calls ?? []) as Call[]));
    const timeEntries = dedupe(packs.flatMap(([c]) => (c?.timeEntries ?? []) as TimeEntry[]));
    const blockList: Block[] = dedupe(packs.flatMap(([, a]) => (a?.blocks ?? []) as Block[]));
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
  }, [monthsKey]);

  useEffect(() => { load(); }, [load]);

  // Calendar grid — Sunday-first
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateStr(new Date().toISOString());
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.toLocaleDateString("en-US", { month: "short" })} ${weekStart.getDate()}–${weekEnd.getDate()}`
    : `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  function goToday() {
    const now = new Date();
    setCalMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setWeekAnchor(now);
  }
  function switchView(v: "month" | "week") {
    if (v === "week") setWeekAnchor(selectedDay ? new Date(selectedDay + "T12:00:00") : new Date());
    setView(v);
  }
  const navPrev = () => view === "month" ? setCalMonth(new Date(year, month - 1, 1)) : setWeekAnchor(addDays(weekStart, -7));
  const navNext = () => view === "month" ? setCalMonth(new Date(year, month + 1, 1)) : setWeekAnchor(addDays(weekStart, 7));

  // Blocks indexed by day (for the always-visible strip on each cell).
  const blocksByDay: Record<string, Block[]> = {};
  for (const b of blocks) for (const d of blockDays(b)) (blocksByDay[d] ||= []).push(b);

  const btnCls = "text-xs tracking-[1px] uppercase text-[#888] hover:text-white hover:border-white/30 transition-colors border border-white/10 px-3 py-1.5";
  // Modal shows the active filter's events for that day, plus availability
  // blocks always (they're conflict info you need whatever you're looking at).
  const selectedAll = selectedDay
    ? (eventMap[selectedDay] || []).filter(e => e.type === activeType || e.type === "unavailable")
    : [];

  return (
    <main className="h-screen overflow-hidden bg-[#0c0c0c] text-white flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col px-6 md:px-12 lg:px-16 py-6 md:py-8 gap-4 max-w-[1500px] mx-auto w-full">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight uppercase">Master Calendar</h1>
            <div className="flex items-center border border-white/10">
              {(["month", "week"] as const).map(v => (
                <button key={v} onClick={() => switchView(v)}
                  className={`text-[10px] tracking-[1.5px] uppercase px-3 py-1.5 transition-colors ${view === v ? "bg-white text-black font-bold" : "text-[#666] hover:text-white"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center border border-white/10">
              <button onClick={navPrev} className="text-[#888] hover:text-white transition-colors px-3 py-1.5 text-sm">‹</button>
              <span className="text-xs tracking-[2px] uppercase text-white px-2 min-w-[130px] text-center">{view === "month" ? monthLabel : weekLabel}</span>
              <button onClick={navNext} className="text-[#888] hover:text-white transition-colors px-3 py-1.5 text-sm">›</button>
            </div>
            <button onClick={goToday} className={btnCls}>Today</button>
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

        {/* Calendar grid */}
        <div className="flex-1 min-h-0 flex flex-col">
          {view === "month" && (
          <div className="grid grid-cols-7 shrink-0">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-[10px] tracking-[2px] uppercase text-[#666] py-1.5">{d}</div>
            ))}
          </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs tracking-[3px] uppercase text-[#333]">Loading...</p>
            </div>
          ) : view === "week" ? (
            <WeekGrid
              days={weekDays}
              dayStrs={weekDayStrs}
              eventMap={eventMap}
              blocksByDay={blocksByDay}
              activeType={activeType}
              todayStr={todayStr}
              onSelectDay={setSelectedDay}
              onSelectBlock={setViewBlock}
            />
          ) : (
            <div
              className="flex-1 min-h-0 grid grid-cols-7 gap-px bg-white/[0.07] border border-white/[0.07]"
              style={{ gridTemplateRows: `repeat(${Math.ceil((firstDayOfWeek + daysInMonth) / 7)}, minmax(0, 1fr))` }}
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
                      <div key={`blk-${b.id}`} role="button" tabIndex={0}
                        onClick={e => { e.stopPropagation(); setViewBlock(b); }}
                        className="px-1.5 py-0.5 text-[9px] tracking-[0.5px] uppercase rounded-sm bg-[#f87171]/12 text-[#f87171] truncate hover:bg-[#f87171]/20 transition-colors cursor-pointer">
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
                              <button onClick={() => { setSelectedDay(null); setViewBlock(ev.raw as Block); }} className="text-[10px] tracking-[1px] uppercase text-[#f87171] hover:opacity-70 transition-opacity">Edit block →</button>
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

      {viewBlock && (
        <BlockTimeModal block={viewBlock} onClose={() => setViewBlock(null)} onSaved={() => { setViewBlock(null); load(); }} />
      )}
    </main>
  );
}

// ── Week view — hourly grid, 8 AM–8 PM ────────────────────────────────────────
function WeekGrid({ days, dayStrs, eventMap, blocksByDay, activeType, todayStr, onSelectDay, onSelectBlock }: {
  days: Date[];
  dayStrs: string[];
  eventMap: Record<string, CalEvent[]>;
  blocksByDay: Record<string, Block[]>;
  activeType: string;
  todayStr: string;
  onSelectDay: (d: string) => void;
  onSelectBlock: (b: Block) => void;
}) {
  const hours = Array.from({ length: WEEK_SPAN + 1 }, (_, i) => WEEK_HOUR_START + i);
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const pct = (h: number) => ((h - WEEK_HOUR_START) / WEEK_SPAN) * 100;
  const cols = { gridTemplateColumns: "52px 1fr" };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Day header — no borders, labels only */}
      <div className="grid shrink-0" style={cols}>
        <div />
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const isToday = dayStrs[i] === todayStr;
            return (
              <button key={i} onClick={() => onSelectDay(dayStrs[i])}
                className="py-2 text-center hover:opacity-80 transition-opacity">
                <span className="text-[9px] tracking-[1.5px] uppercase text-[#666]">{DOW[d.getDay()]}</span>
                <span className={`block text-sm font-bold ${isToday ? "text-white" : "text-[#888]"}`}>
                  {isToday ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white text-black">{d.getDate()}</span> : d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hour grid — the box wraps only the day columns */}
      <div className="flex-1 min-h-0 grid overflow-hidden py-3" style={cols}>
        <div className="relative">
          {hours.map(h => (
            <div key={h} className="absolute right-2 -translate-y-1/2 text-[9px] text-[#555] tabular-nums" style={{ top: `${pct(h)}%` }}>
              {h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}
            </div>
          ))}
        </div>

        <div className="relative grid grid-cols-7 border border-white/[0.07]">
        {days.map((_, di) => {
          const ds = dayStrs[di];
          const evs = (eventMap[ds] || []).filter(e => e.type === activeType);
          const dayBlocks = activeType !== "unavailable" ? (blocksByDay[ds] || []) : [];
          const isToday = ds === todayStr;

          // Side-by-side lanes for events sharing an hour.
          const buckets = new Map<number, CalEvent[]>();
          for (const e of evs) {
            const hr = Math.max(WEEK_HOUR_START, Math.min(WEEK_HOUR_END - 1, new Date(e.time).getHours()));
            (buckets.get(hr) ?? buckets.set(hr, []).get(hr)!).push(e);
          }

          return (
            <div key={di} onClick={() => onSelectDay(ds)}
              className={`relative cursor-pointer ${di > 0 ? "border-l border-white/[0.07]" : ""} ${isToday ? "bg-white/[0.02]" : ""}`}>
              {hours.slice(1).map(h => (
                <div key={h} className="absolute left-0 right-0 border-t border-white/[0.04]" style={{ top: `${pct(h)}%` }} />
              ))}

              {dayBlocks.map(b => {
                let topH = WEEK_HOUR_START, botH = WEEK_HOUR_END;
                if (!b.all_day) {
                  if (toDateStr(b.start_at) === ds) { const s = new Date(b.start_at); topH = s.getHours() + s.getMinutes() / 60; }
                  if (toDateStr(b.end_at) === ds) { const e = new Date(b.end_at); botH = e.getHours() + e.getMinutes() / 60; }
                }
                const top = Math.max(0, pct(topH));
                const height = Math.min(100, pct(botH)) - top;
                if (height <= 0) return null;
                return (
                  <button key={b.id} onClick={e => { e.stopPropagation(); onSelectBlock(b); }}
                    className="absolute left-0.5 right-0.5 bg-[#f87171]/10 border border-[#f87171]/25 rounded-sm px-1 py-0.5 overflow-hidden text-left hover:bg-[#f87171]/20 transition-colors"
                    style={{ top: `${top}%`, height: `${height}%` }}>
                    <span className="text-[9px] text-[#f87171] tracking-[0.5px] uppercase">{b.user_name} off</span>
                  </button>
                );
              })}

              {evs.map(e => {
                const t = new Date(e.time);
                const raw = t.getHours() + t.getMinutes() / 60;
                const top = pct(Math.max(WEEK_HOUR_START, Math.min(WEEK_HOUR_END - 1, raw)));
                const hr = Math.max(WEEK_HOUR_START, Math.min(WEEK_HOUR_END - 1, t.getHours()));
                const lane = buckets.get(hr)!;
                const idx = lane.indexOf(e);
                const w = 100 / lane.length;
                const st = TYPE_STYLE[e.type];
                const shoot = e.type === "shoot" ? (e.raw as Shoot | undefined) : undefined;
                const title = shoot?.contact_name || e.label.split(",")[0];
                return (
                  <button key={e.id} onClick={ev => { ev.stopPropagation(); onSelectDay(ds); }}
                    className={`absolute rounded-sm border px-1 py-0.5 text-left overflow-hidden hover:brightness-125 transition-all ${st.bg} ${st.border} ${st.text}`}
                    style={{ top: `${top}%`, height: `calc(${(1 / WEEK_SPAN) * 100}% - 2px)`, left: `calc(${idx * w}% + 1px)`, width: `calc(${w}% - 2px)` }}>
                    <span className="block text-[10px] font-semibold leading-tight truncate">{title}</span>
                    <span className="block text-[9px] opacity-60 leading-tight">{fmtTime(e.time)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

// ── Block-time modal ──────────────────────────────────────────────────────────
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

function BlockTimeModal({ block, onClose, onSaved }: { block?: Block; onClose: () => void; onSaved: () => void }) {
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
        <button onClick={remove} disabled={deleting}
          className="w-full mt-3 text-[11px] tracking-[1.5px] uppercase text-[#f87171]/80 hover:text-[#f87171] transition-colors disabled:opacity-40">
          {deleting ? "Removing…" : "Remove this block"}
        </button>
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
