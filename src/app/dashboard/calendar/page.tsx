"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Shoot = { id: string; address: string; status: string; scheduled_at: string | null; delivered_at: string | null; paid_at: string | null; contact_id: string | null; price: number | null };
type Update = { id: string; message: string; category: string; created_at: string; created_by: string };
type Contact = { id: string; name: string; created_at: string; stage: string };
type Call = { id: string; called_at: string; outcome: string; called_by: string; contact_id: string; listing_address: string | null; contact_name: string | null };
type TimeEntry = { id: string; user_id: string; user_name: string; started_at: string; stopped_at: string | null; duration_seconds: number | null };

type CalEvent = {
  id: string;
  type: "shoot" | "delivery" | "payment" | "update" | "contact" | "call" | "clock_in" | "clock_out";
  label: string;
  time: string;
  meta?: string;
  link?: string;
  raw?: unknown;
};

// ── Colors ─────────────────────────────────────────────────────────────────────
const TYPE_STYLE: Record<string, { dot: string; bg: string; border: string; text: string; label: string }> = {
  shoot:     { dot: "bg-[#4ade80]", bg: "bg-[#4ade80]/10", border: "border-[#4ade80]/30", text: "text-[#4ade80]",  label: "Shoot" },
  delivery:  { dot: "bg-[#34d399]", bg: "bg-[#34d399]/10", border: "border-[#34d399]/30", text: "text-[#34d399]",  label: "Delivery" },
  payment:   { dot: "bg-[#86efac]", bg: "bg-[#86efac]/10", border: "border-[#86efac]/30", text: "text-[#86efac]",  label: "Payment" },
  update:    { dot: "bg-[#a78bfa]", bg: "bg-[#a78bfa]/10", border: "border-[#a78bfa]/30", text: "text-[#a78bfa]",  label: "App Update" },
  contact:   { dot: "bg-[#fbbf24]", bg: "bg-[#fbbf24]/10", border: "border-[#fbbf24]/30", text: "text-[#fbbf24]",  label: "New Contact" },
  call:      { dot: "bg-[#60a5fa]", bg: "bg-[#60a5fa]/10", border: "border-[#60a5fa]/30", text: "text-[#60a5fa]",  label: "Call" },
  clock_in:  { dot: "bg-[#fb923c]", bg: "bg-[#fb923c]/10", border: "border-[#fb923c]/30", text: "text-[#fb923c]",  label: "Clocked In" },
  clock_out: { dot: "bg-[#fdba74]", bg: "bg-[#fdba74]/10", border: "border-[#fdba74]/30", text: "text-[#fdba74]",  label: "Clocked Out" },
};

const LEGEND = [
  { type: "shoot",     label: "Shoot Scheduled" },
  { type: "delivery",  label: "Delivery" },
  { type: "payment",   label: "Payment" },
  { type: "contact",   label: "New Contact" },
  { type: "call",      label: "Cold Call" },
  { type: "update",    label: "App Update" },
  { type: "clock_in",  label: "Ryan / Leif Clock-in" },
];

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
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(Object.keys(TYPE_STYLE)));

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

    // App updates
    for (const u of updates as Update[]) {
      const d = toDateStr(u.created_at);
      const headline = u.message.split("\n---\n")[0].trim();
      add(d, { id: `update-${u.id}`, type: "update", label: headline, time: u.created_at, meta: u.created_by, link: "/dashboard/updates" });
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

  // Calendar grid
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateStr(new Date().toISOString());
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const selectedEvents = selectedDay
    ? (eventMap[selectedDay] || []).filter(e => activeTypes.has(e.type))
    : [];

  function toggleType(t: string) {
    setActiveTypes(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 gap-4 shrink-0">
        <div className="flex items-center gap-6">
          <a href="/" className="text-lg font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
          <a href="/dashboard?page=apps" className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">← Dashboard</a>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} className="text-[#555] hover:text-white transition-colors px-3 py-1.5 border border-white/10 text-sm">‹</button>
          <span className="text-sm tracking-[2px] uppercase text-[#888] min-w-[160px] text-center">{monthLabel}</span>
          <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} className="text-[#555] hover:text-white transition-colors px-3 py-1.5 border border-white/10 text-sm">›</button>
          <button onClick={() => setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-3 py-1.5">Today</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col px-6 py-6 gap-4">
        {/* Page title + legend */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">Unified</p>
            <h1 className="text-2xl font-black tracking-tight uppercase">Master Calendar</h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {LEGEND.map(l => {
              const s = TYPE_STYLE[l.type];
              const on = activeTypes.has(l.type);
              return (
                <button key={l.type} onClick={() => toggleType(l.type)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 border text-[10px] tracking-wide transition-all ${on ? `${s.border} ${s.text}` : "border-white/5 text-[#2a2a2a]"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${on ? s.dot : "bg-white/10"}`} />
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-5 flex-1 min-h-0">
          {/* ── Calendar grid ── */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-white/10 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-[9px] tracking-[2px] uppercase text-[#333] text-center py-2">{d}</div>
              ))}
            </div>

            {/* Week rows */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs tracking-[3px] uppercase text-[#333]">Loading...</p>
              </div>
            ) : (
              <div className="flex-1 grid auto-rows-fr" style={{ gridTemplateRows: `repeat(${Math.ceil((firstDayOfWeek + daysInMonth) / 7)}, 1fr)` }}>
                {Array.from({ length: Math.ceil((firstDayOfWeek + daysInMonth) / 7) }).map((_, weekIdx) => (
                  <div key={weekIdx} className="grid grid-cols-7 border-b border-white/5">
                    {Array.from({ length: 7 }).map((_, dayOfWeek) => {
                      const dayNum = weekIdx * 7 + dayOfWeek - firstDayOfWeek + 1;
                      if (dayNum < 1 || dayNum > daysInMonth) return <div key={dayOfWeek} className="border-r border-white/5 last:border-r-0" />;
                      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                      const dayEvents = (eventMap[dateStr] || []).filter(e => activeTypes.has(e.type));
                      const isToday = dateStr === todayStr;
                      const isSelected = selectedDay === dateStr;
                      const hasEvents = dayEvents.length > 0;

                      // Group dots by type (unique)
                      const dotTypes = [...new Set(dayEvents.map(e => e.type))];

                      return (
                        <div
                          key={dayOfWeek}
                          onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                          className={`border-r border-white/5 last:border-r-0 p-2 min-h-[80px] flex flex-col gap-1 cursor-pointer transition-colors ${
                            isSelected ? "bg-white/[0.05]" : hasEvents ? "hover:bg-white/[0.02]" : "hover:bg-white/[0.01]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold leading-none ${isToday ? "text-white bg-[#a78bfa] w-5 h-5 rounded-full flex items-center justify-center text-[10px]" : isSelected ? "text-white" : dayEvents.length > 0 ? "text-[#666]" : "text-[#2a2a2a]"}`}>
                              {dayNum}
                            </span>
                            {dayEvents.length > 0 && (
                              <span className="text-[9px] text-[#333]">{dayEvents.length}</span>
                            )}
                          </div>

                          {/* Event chips — show up to 3, then +N */}
                          <div className="flex flex-col gap-0.5 flex-1">
                            {dayEvents.slice(0, 3).map(ev => {
                              const s = TYPE_STYLE[ev.type];
                              return (
                                <div key={ev.id} className={`text-[9px] px-1 py-0.5 truncate ${s.text} ${s.bg} leading-tight`}>
                                  {ev.label}
                                </div>
                              );
                            })}
                            {dayEvents.length > 3 && (
                              <div className="text-[9px] text-[#333] px-1">+{dayEvents.length - 3} more</div>
                            )}
                          </div>

                          {/* Dots for event types present */}
                          {dotTypes.length > 0 && dayEvents.length === 0 && (
                            <div className="flex gap-0.5 flex-wrap mt-auto">
                              {dotTypes.map(t => <span key={t} className={`w-1.5 h-1.5 rounded-full ${TYPE_STYLE[t].dot}`} />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Day detail panel ── */}
          <div className={`w-80 shrink-0 flex flex-col transition-all ${selectedDay ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
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
