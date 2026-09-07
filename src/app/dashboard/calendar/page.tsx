"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Shoot = { id: string; address: string; status: string; scheduled_at: string | null; delivered_at: string | null; paid_at: string | null; contact_id: string | null; contact_name: string | null; price: number | null };
type Update = { id: string; message: string; category: string; created_at: string; created_by: string; link?: string };
type Contact = { id: string; name: string; created_at: string; stage: string };
type Call = { id: string; called_at: string; outcome: string; called_by: string; contact_id: string; listing_address: string | null; contact_name: string | null };
type TimeEntry = { id: string; user_id: string; user_name: string; started_at: string; stopped_at: string | null; duration_seconds: number | null };

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
};

const LEGEND = [
  { type: "shoot",            label: "Shoot Scheduled" },
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
export default function CalendarPage() {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [eventMap, setEventMap] = useState<Record<string, CalEvent[]>>({});
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
    const res = await fetch(`/api/admin/calendar?month=${monthKey}`);
    if (!res.ok) { setLoading(false); return; }
    const { shoots, updates, contacts, calls, timeEntries } = await res.json();

    const map: Record<string, CalEvent[]> = {};
    function add(dateStr: string, ev: CalEvent) {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(ev);
    }

    // Shoots
    for (const s of shoots as Shoot[]) {
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

  const selectedEvents = selectedDay
    ? (eventMap[selectedDay] || []).filter(e => e.type === activeType)
    : [];

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <div className="flex-1 flex flex-col px-4 md:px-8 py-8 gap-4">
        {/* Page title + legend */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
          <div>
            <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">Unified</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">Master Calendar</h1>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} className="text-[#555] hover:text-white transition-colors px-3 py-1.5 border border-white/10 text-sm">‹</button>
                <span className="text-sm tracking-[2px] uppercase text-[#888] min-w-[140px] text-center">{monthLabel}</span>
                <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} className="text-[#555] hover:text-white transition-colors px-3 py-1.5 border border-white/10 text-sm">›</button>
                <button onClick={() => setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-3 py-1.5">Today</button>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#555]">{monthCount} {activeLegendLabel.toLowerCase()}{monthCount !== 1 ? "s" : ""}</p>
                {monthRevenue > 0 && <p className="text-sm font-bold text-[#4ade80]">${monthRevenue.toLocaleString()}</p>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {LEGEND.map(l => {
              const s = TYPE_STYLE[l.type];
              const on = activeType === l.type;
              return (
                <button key={l.type} onClick={() => { setActiveType(l.type); setSelectedDay(null); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 border text-[10px] tracking-wide transition-all ${on ? `${s.border} ${s.text}` : "border-white/5 text-[#2a2a2a]"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${on ? s.dot : "bg-white/10"}`} />
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-5 flex-1 min-h-0">
          {/* ── Calendar grid ── */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-[10px] tracking-[2px] uppercase text-[#444] py-2">{d}</div>
              ))}
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs tracking-[3px] uppercase text-[#333]">Loading...</p>
              </div>
            ) : (
              <div
                className="flex-1 grid grid-cols-7 gap-px bg-white/5"
                style={{ gridTemplateRows: `repeat(${Math.ceil((firstDayOfWeek + daysInMonth) / 7)}, 1fr)` }}
              >
                {Array.from({ length: Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7 }).map((_, i) => {
                  const dayNum = i - firstDayOfWeek + 1;
                  if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} className="bg-[#0c0c0c]" />;

                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const dayEvents = (eventMap[dateStr] || []).filter(e => e.type === activeType);
                  const isToday = dateStr === todayStr;
                  const isSelected = selectedDay === dateStr;

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                      className={`bg-[#0e0e0e] min-h-[110px] p-2 flex flex-col gap-1 cursor-pointer transition-colors hover:brightness-125 ${
                        isSelected ? "ring-2 ring-inset ring-[#a78bfa]" : isToday ? "ring-1 ring-inset ring-white/20" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-bold mb-1 ${isToday || isSelected ? "text-white" : dayEvents.length > 0 ? "text-[#666]" : "text-[#444]"}`}>{dayNum}</p>
                        {dayEvents.length > 0 && <span className="text-[9px] text-[#333]">{dayEvents.length}</span>}
                      </div>

                      {dayEvents.map(ev => {
                        if (ev.type === "shoot") {
                          const shoot = ev.raw as Shoot | undefined;
                          const chipTitle = shoot?.contact_name || ev.label.split(",")[0];
                          const chipClass = SHOOT_CHIP_CLASS[ev.meta || ""] || SHOOT_CHIP_DEFAULT;
                          return (
                            <div key={ev.id} className={`px-1.5 py-1 text-[10px] leading-tight rounded-sm border truncate ${chipClass}`}>
                              <p className="font-semibold truncate">{chipTitle}</p>
                              <p className="opacity-60 truncate mt-0.5">{fmtTime(ev.time)}</p>
                              {ev.meta && <p className="text-[9px] tracking-[1px] uppercase opacity-50 mt-0.5">{ev.meta.replace(/_/g, " ")}</p>}
                            </div>
                          );
                        }
                        const s = TYPE_STYLE[ev.type];
                        return (
                          <div key={ev.id} className={`px-1.5 py-1 text-[10px] rounded-sm border truncate ${s.bg} ${s.border} ${s.text}`}>
                            {ev.label}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Day detail panel ── */}
          <div className={`w-full md:w-80 shrink-0 flex flex-col transition-all ${selectedDay ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
            <div className="bg-[#111] border border-white/10 flex-1 overflow-y-auto">
              {selectedDay ? (
                <>
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] tracking-[2px] uppercase text-[#555]">
                        {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}
                      </p>
                      <p className="text-sm font-bold">
                        {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <button onClick={() => setSelectedDay(null)} className="text-[#444] hover:text-white transition-colors text-lg leading-none">✕</button>
                  </div>

                  {selectedEvents.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-xs text-[#333]">Nothing on this day.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {selectedEvents.map(ev => {
                        const s = TYPE_STYLE[ev.type];
                        return (
                          <div key={ev.id} className={`px-4 py-3 ${s.bg}`}>
                            <div className="flex items-start gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${s.dot}`} />
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-semibold ${s.text} mb-0.5`}>{s.label}</p>
                                <p className="text-sm text-white leading-snug truncate">{ev.label}</p>
                                {ev.meta && <p className="text-[10px] text-[#555] mt-0.5 capitalize">{ev.meta}</p>}
                                <p className="text-[10px] text-[#333] mt-0.5">{fmtTime(ev.time)}</p>
                                {ev.link && (
                                  <a href={ev.link} className={`text-[10px] tracking-[1px] uppercase mt-1.5 inline-block ${s.text} hover:opacity-70 transition-opacity`}>
                                    View →
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-center px-4">
                  <p className="text-xs text-[#222]">Click a day to see all events</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
