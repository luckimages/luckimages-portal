"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Entry = {
  id: string;
  user_id: string;
  user_name: string;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
};

type DaySummary = {
  date: string; // YYYY-MM-DD
  label: string; // "Mon Jun 23"
  ryan: number;
  leif: number;
};

type WeekSummary = {
  weekLabel: string;
  weekStart: string;
  ryan: number;
  leif: number;
  days: DaySummary[];
};

function fmt(secs: number): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtDecimal(secs: number): string {
  return (secs / 3600).toFixed(1) + "h";
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekLabel(d: Date): string {
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function isRyan(name: string) {
  return name.toLowerCase().includes("ryan") || name.toLowerCase() === "ryan";
}

export default function TimeTrackerPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/time-entries?mode=all")
      .then(r => r.json())
      .then(({ allEntries }) => {
        setEntries(allEntries || []);
        setLoading(false);
      });
  }, []);

  // Build week summaries
  const weekMap = new Map<string, WeekSummary>();
  const dayMap = new Map<string, { ryan: number; leif: number }>();
  const now = Date.now();

  entries.forEach(e => {
    const secs = e.stopped_at
      ? (e.duration_seconds || 0)
      : Math.floor((now - new Date(e.started_at).getTime()) / 1000);

    const dateObj = new Date(e.started_at);
    const dateStr = dateObj.toISOString().split("T")[0];
    const ws = getWeekStart(dateObj);
    const wsStr = ws.toISOString().split("T")[0];

    // Day map
    if (!dayMap.has(dateStr)) dayMap.set(dateStr, { ryan: 0, leif: 0 });
    const day = dayMap.get(dateStr)!;
    if (isRyan(e.user_name)) day.ryan += secs; else day.leif += secs;

    // Week map
    if (!weekMap.has(wsStr)) {
      weekMap.set(wsStr, { weekLabel: weekLabel(ws), weekStart: wsStr, ryan: 0, leif: 0, days: [] });
    }
    const week = weekMap.get(wsStr)!;
    if (isRyan(e.user_name)) week.ryan += secs; else week.leif += secs;
  });

  // Attach days to weeks
  dayMap.forEach((totals, dateStr) => {
    const ws = getWeekStart(new Date(dateStr + "T12:00:00"));
    const wsStr = ws.toISOString().split("T")[0];
    const week = weekMap.get(wsStr);
    if (week) {
      const existing = week.days.find(d => d.date === dateStr);
      if (existing) { existing.ryan = totals.ryan; existing.leif = totals.leif; }
      else week.days.push({ date: dateStr, label: dayLabel(dateStr), ryan: totals.ryan, leif: totals.leif });
    }
  });

  const weeks = Array.from(weekMap.values())
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  weeks.forEach(w => w.days.sort((a, b) => b.date.localeCompare(a.date)));

  // All-time stats
  const allRyan = weeks.reduce((s, w) => s + w.ryan, 0);
  const allLeif = weeks.reduce((s, w) => s + w.leif, 0);
  const allDays = Array.from(dayMap.values());
  const ryanDays = allDays.filter(d => d.ryan > 0);
  const leifDays = allDays.filter(d => d.leif > 0);
  const avgRyanDaily = ryanDays.length ? allRyan / ryanDays.length : 0;
  const avgLeifDaily = leifDays.length ? allLeif / leifDays.length : 0;
  const avgRyanWeekly = weeks.filter(w => w.ryan > 0).length ? allRyan / weeks.filter(w => w.ryan > 0).length : 0;
  const avgLeifWeekly = weeks.filter(w => w.leif > 0).length ? allLeif / weeks.filter(w => w.leif > 0).length : 0;

  const currentWeek = weeks[0];

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push("/dashboard")} className="text-[#555] text-sm hover:text-white transition-colors">
            ← Dashboard
          </button>
          <h1 className="text-sm font-bold tracking-[3px] uppercase">⏱ Time Tracker</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">

        {loading ? (
          <p className="text-xs text-[#555] italic">Loading...</p>
        ) : (
          <>
            {/* ALL-TIME STATS */}
            <section>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                All-Time Stats
              </p>
              <div className="grid grid-cols-3 gap-4">
                {/* Total hours */}
                <div className="bg-[#111] border border-white/10 p-5">
                  <p className="text-xs text-[#555] tracking-[2px] uppercase mb-3">Total Hours</p>
                  <div className="space-y-2">
                    <div className="flex items-end justify-between">
                      <span className="text-sm text-[#888]">Ryan</span>
                      <span className="text-2xl font-bold tabular-nums">{fmtDecimal(allRyan)}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-sm text-[#888]">Leif</span>
                      <span className="text-2xl font-bold tabular-nums">{fmtDecimal(allLeif)}</span>
                    </div>
                    <div className="flex items-end justify-between border-t border-white/10 pt-2 mt-2">
                      <span className="text-xs text-[#555]">Combined</span>
                      <span className="text-sm font-medium text-[#4ade80]">{fmtDecimal(allRyan + allLeif)}</span>
                    </div>
                  </div>
                </div>

                {/* Daily average */}
                <div className="bg-[#111] border border-white/10 p-5">
                  <p className="text-xs text-[#555] tracking-[2px] uppercase mb-3">Avg / Day</p>
                  <div className="space-y-2">
                    <div className="flex items-end justify-between">
                      <span className="text-sm text-[#888]">Ryan</span>
                      <span className="text-2xl font-bold tabular-nums">{fmt(Math.round(avgRyanDaily))}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-sm text-[#888]">Leif</span>
                      <span className="text-2xl font-bold tabular-nums">{fmt(Math.round(avgLeifDaily))}</span>
                    </div>
                    <p className="text-xs text-[#333] pt-1">on days worked</p>
                  </div>
                </div>

                {/* Weekly average */}
                <div className="bg-[#111] border border-white/10 p-5">
                  <p className="text-xs text-[#555] tracking-[2px] uppercase mb-3">Avg / Week</p>
                  <div className="space-y-2">
                    <div className="flex items-end justify-between">
                      <span className="text-sm text-[#888]">Ryan</span>
                      <span className="text-2xl font-bold tabular-nums">{fmt(Math.round(avgRyanWeekly))}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-sm text-[#888]">Leif</span>
                      <span className="text-2xl font-bold tabular-nums">{fmt(Math.round(avgLeifWeekly))}</span>
                    </div>
                    <p className="text-xs text-[#333] pt-1">on weeks worked</p>
                  </div>
                </div>
              </div>
            </section>

            {/* THIS WEEK */}
            {currentWeek && (
              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  This Week — {currentWeek.weekLabel}
                </p>
                <div className="bg-[#111] border border-white/10">
                  {/* Week totals header */}
                  <div className="grid grid-cols-3 border-b border-white/10 p-4">
                    <span className="text-xs text-[#555]">Day</span>
                    <span className="text-xs text-[#555] text-right">Ryan</span>
                    <span className="text-xs text-[#555] text-right">Leif</span>
                  </div>
                  {currentWeek.days.map(day => (
                    <div key={day.date} className="grid grid-cols-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02]">
                      <span className="text-sm text-[#888]">{day.label}</span>
                      <span className={`text-sm text-right tabular-nums font-medium ${day.ryan ? "text-white" : "text-[#333]"}`}>{fmt(day.ryan)}</span>
                      <span className={`text-sm text-right tabular-nums font-medium ${day.leif ? "text-white" : "text-[#333]"}`}>{fmt(day.leif)}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 px-4 py-3 bg-white/[0.03]">
                    <span className="text-xs tracking-[2px] uppercase text-[#555]">Week Total</span>
                    <span className="text-sm text-right tabular-nums font-bold text-[#4ade80]">{fmt(currentWeek.ryan)}</span>
                    <span className="text-sm text-right tabular-nums font-bold text-[#4ade80]">{fmt(currentWeek.leif)}</span>
                  </div>
                </div>
              </section>
            )}

            {/* WEEK BY WEEK */}
            <section>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                Week by Week
              </p>
              <div className="space-y-2">
                {weeks.map((week, i) => {
                  const isOpen = selectedWeek === week.weekStart || (i === 0 && selectedWeek === null);
                  return (
                    <div key={week.weekStart} className="bg-[#111] border border-white/10">
                      <button
                        onClick={() => setSelectedWeek(isOpen ? "__none__" : week.weekStart)}
                        className="w-full grid grid-cols-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <span className="text-sm col-span-2">{week.weekLabel}</span>
                        <span className="text-sm text-right tabular-nums text-[#888]">Ryan {fmt(week.ryan)}</span>
                        <span className="text-sm text-right tabular-nums text-[#888]">Leif {fmt(week.leif)}</span>
                      </button>
                      {isOpen && week.days.length > 0 && (
                        <div className="border-t border-white/10">
                          {week.days.map(day => (
                            <div key={day.date} className="grid grid-cols-4 px-5 py-2.5 border-b border-white/5">
                              <span className="text-xs text-[#555] col-span-2 pl-2">{day.label}</span>
                              <span className={`text-xs text-right tabular-nums ${day.ryan ? "text-white" : "text-[#333]"}`}>{fmt(day.ryan)}</span>
                              <span className={`text-xs text-right tabular-nums ${day.leif ? "text-white" : "text-[#333]"}`}>{fmt(day.leif)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {weeks.length === 0 && (
                  <p className="text-xs text-[#444] italic">No entries yet. Start the timer on the dashboard!</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
