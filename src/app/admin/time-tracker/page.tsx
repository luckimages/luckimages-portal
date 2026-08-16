"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

type Entry = {
  id: string;
  user_id: string;
  user_name: string;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
};

type DaySummary = {
  date: string;
  label: string;
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

// Thin horizontal bar comparing two values
function SplitBar({ a, b, colorA = "#4ade80", colorB = "#60a5fa" }: { a: number; b: number; colorA?: string; colorB?: string }) {
  const total = a + b;
  if (!total) return <div className="w-full h-1.5 bg-[#222]" />;
  const pctA = (a / total) * 100;
  const pctB = (b / total) * 100;
  return (
    <div className="w-full h-1.5 flex overflow-hidden gap-px">
      {pctA > 0 && <div style={{ width: `${pctA}%`, backgroundColor: colorA }} />}
      {pctB > 0 && <div style={{ width: `${pctB}%`, backgroundColor: colorB }} />}
    </div>
  );
}

// Mini bar chart for weekly history
function WeekBarChart({ weeks }: { weeks: WeekSummary[] }) {
  const display = weeks.slice(0, 8).reverse();
  const maxSecs = Math.max(...display.map(w => w.ryan + w.leif), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {display.map(w => {
        const totalH = (w.ryan + w.leif) / maxSecs;
        const ryanH = w.ryan / (w.ryan + w.leif || 1);
        return (
          <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="w-full flex flex-col justify-end overflow-hidden" style={{ height: `${Math.round(totalH * 72)}px`, minHeight: 2 }}>
              <div style={{ height: `${ryanH * 100}%`, backgroundColor: "#4ade80", minHeight: 2 }} />
              <div style={{ height: `${(1 - ryanH) * 100}%`, backgroundColor: "#60a5fa", minHeight: w.leif ? 2 : 0 }} />
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 px-2 py-1.5 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <p className="text-[#555] mb-0.5">{w.weekLabel}</p>
              <p className="text-[#4ade80]">Ryan {fmt(w.ryan)}</p>
              <p className="text-[#60a5fa]">Leif {fmt(w.leif)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Donut chart for split
function DonutChart({ ryan, leif }: { ryan: number; leif: number }) {
  const total = ryan + leif;
  if (!total) return <div className="w-20 h-20 rounded-full border-4 border-[#222]" />;
  const ryanPct = ryan / total;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const ryanDash = ryanPct * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#222" strokeWidth="8" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="#60a5fa" strokeWidth="8"
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={0} strokeLinecap="butt"
        transform="rotate(-90 36 36)" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="#4ade80" strokeWidth="8"
        strokeDasharray={`${ryanDash} ${circ - ryanDash}`} strokeDashoffset={0} strokeLinecap="butt"
        transform="rotate(-90 36 36)" />
      <text x="36" y="40" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
        {Math.round(ryanPct * 100)}%
      </text>
    </svg>
  );
}

export default function TimeTrackerPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) { router.replace("/dashboard"); return; }
    });
    fetch("/api/admin/time-entries?mode=all")
      .then(r => r.json())
      .then(({ allEntries }) => {
        setEntries(allEntries || []);
        setLoading(false);
      });
  }, []);

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

    if (!dayMap.has(dateStr)) dayMap.set(dateStr, { ryan: 0, leif: 0 });
    const day = dayMap.get(dateStr)!;
    if (isRyan(e.user_name)) day.ryan += secs; else day.leif += secs;

    if (!weekMap.has(wsStr)) weekMap.set(wsStr, { weekLabel: weekLabel(ws), weekStart: wsStr, ryan: 0, leif: 0, days: [] });
    const week = weekMap.get(wsStr)!;
    if (isRyan(e.user_name)) week.ryan += secs; else week.leif += secs;
  });

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

  const weeks = Array.from(weekMap.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  weeks.forEach(w => w.days.sort((a, b) => b.date.localeCompare(a.date)));

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
  const maxDaySecs = Math.max(...Array.from(dayMap.values()).map(d => Math.max(d.ryan, d.leif)), 1);

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="border-b border-white/10 px-8 py-5 flex items-center gap-6">
        <button onClick={() => router.push("/dashboard?page=apps")} className="text-[#555] text-sm hover:text-white transition-colors">
          ← Dashboard
        </button>
        <h1 className="text-sm font-bold tracking-[3px] uppercase">⏱ Time Tracker</h1>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">
        {loading ? (
          <p className="text-xs text-[#555] italic">Loading...</p>
        ) : (
          <>
            {/* ALL-TIME SUMMARY */}
            <section>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                All-Time
              </p>
              <div className="grid grid-cols-2 gap-6">
                {/* Left: donut + totals */}
                <div className="bg-[#111] border border-white/10 p-6 flex items-center gap-6">
                  <DonutChart ryan={allRyan} leif={allLeif} />
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
                          <span className="text-xs text-[#888]">Ryan</span>
                        </div>
                        <span className="text-lg font-bold tabular-nums">{fmtDecimal(allRyan)}</span>
                      </div>
                      <div className="w-full h-1 bg-[#222] overflow-hidden">
                        <div className="h-full bg-[#4ade80]" style={{ width: `${allRyan + allLeif ? (allRyan / (allRyan + allLeif)) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
                          <span className="text-xs text-[#888]">Leif</span>
                        </div>
                        <span className="text-lg font-bold tabular-nums">{fmtDecimal(allLeif)}</span>
                      </div>
                      <div className="w-full h-1 bg-[#222] overflow-hidden">
                        <div className="h-full bg-[#60a5fa]" style={{ width: `${allRyan + allLeif ? (allLeif / (allRyan + allLeif)) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div className="pt-1 border-t border-white/10 flex justify-between">
                      <span className="text-xs text-[#555]">Combined</span>
                      <span className="text-sm font-semibold text-white">{fmtDecimal(allRyan + allLeif)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: averages */}
                <div className="bg-[#111] border border-white/10 p-6 space-y-4">
                  <p className="text-xs tracking-[2px] uppercase text-[#555]">Averages</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-[#555] mb-2">Per Day Worked</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-[#888]">Ryan</span>
                              <span className="font-medium">{fmt(Math.round(avgRyanDaily))}</span>
                            </div>
                            <div className="w-full h-1 bg-[#222]">
                              <div className="h-full bg-[#4ade80]" style={{ width: `${Math.min((avgRyanDaily / 28800) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-[#888]">Leif</span>
                              <span className="font-medium">{fmt(Math.round(avgLeifDaily))}</span>
                            </div>
                            <div className="w-full h-1 bg-[#222]">
                              <div className="h-full bg-[#60a5fa]" style={{ width: `${Math.min((avgLeifDaily / 28800) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[#555] mb-2">Per Week Worked</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-[#888]">Ryan</span>
                              <span className="font-medium">{fmt(Math.round(avgRyanWeekly))}</span>
                            </div>
                            <div className="w-full h-1 bg-[#222]">
                              <div className="h-full bg-[#4ade80]" style={{ width: `${Math.min((avgRyanWeekly / 144000) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-[#888]">Leif</span>
                              <span className="font-medium">{fmt(Math.round(avgLeifWeekly))}</span>
                            </div>
                            <div className="w-full h-1 bg-[#222]">
                              <div className="h-full bg-[#60a5fa]" style={{ width: `${Math.min((avgLeifWeekly / 144000) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* WEEKLY BAR CHART */}
            {weeks.length > 0 && (
              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  Last {Math.min(weeks.length, 8)} Weeks
                </p>
                <div className="bg-[#111] border border-white/10 p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-[#888]"><span className="w-2 h-2 bg-[#4ade80]" />Ryan</div>
                    <div className="flex items-center gap-1.5 text-xs text-[#888]"><span className="w-2 h-2 bg-[#60a5fa]" />Leif</div>
                  </div>
                  <WeekBarChart weeks={weeks} />
                  <div className="mt-2 flex gap-1.5">
                    {weeks.slice(0, 8).reverse().map(w => (
                      <div key={w.weekStart} className="flex-1 text-center">
                        <p className="text-[10px] text-[#444] truncate">{w.weekLabel.split(" – ")[0]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* THIS WEEK */}
            {currentWeek && (
              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  This Week — {currentWeek.weekLabel}
                </p>
                <div className="bg-[#111] border border-white/10">
                  <div className="grid grid-cols-[1fr_120px_120px_160px] border-b border-white/10 px-5 py-3">
                    <span className="text-xs text-[#555]">Day</span>
                    <span className="text-xs text-[#555] text-right">Ryan</span>
                    <span className="text-xs text-[#555] text-right">Leif</span>
                    <span className="text-xs text-[#555] text-right pr-1">Split</span>
                  </div>
                  {currentWeek.days.map(day => (
                    <div key={day.date} className="grid grid-cols-[1fr_120px_120px_160px] px-5 py-3 border-b border-white/5 items-center hover:bg-white/[0.02]">
                      <span className="text-sm text-[#888]">{day.label}</span>
                      <div className="text-right">
                        <span className={`text-sm tabular-nums font-medium ${day.ryan ? "text-[#4ade80]" : "text-[#333]"}`}>{fmt(day.ryan)}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm tabular-nums font-medium ${day.leif ? "text-[#60a5fa]" : "text-[#333]"}`}>{fmt(day.leif)}</span>
                      </div>
                      <div className="pl-4">
                        <div className="flex gap-0.5 items-end h-5">
                          <div className="w-4 bg-[#4ade80]/20 flex items-end">
                            <div className="w-full bg-[#4ade80]" style={{ height: `${Math.round((day.ryan / maxDaySecs) * 100)}%`, minHeight: day.ryan ? 2 : 0 }} />
                          </div>
                          <div className="w-4 bg-[#60a5fa]/20 flex items-end">
                            <div className="w-full bg-[#60a5fa]" style={{ height: `${Math.round((day.leif / maxDaySecs) * 100)}%`, minHeight: day.leif ? 2 : 0 }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_120px_120px_160px] px-5 py-3 bg-white/[0.03] items-center">
                    <span className="text-xs tracking-[2px] uppercase text-[#555]">Week Total</span>
                    <span className="text-sm text-right tabular-nums font-bold text-[#4ade80]">{fmt(currentWeek.ryan)}</span>
                    <span className="text-sm text-right tabular-nums font-bold text-[#60a5fa]">{fmt(currentWeek.leif)}</span>
                    <div className="pl-4"><SplitBar a={currentWeek.ryan} b={currentWeek.leif} /></div>
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
                  const maxWkDay = Math.max(...week.days.map(d => Math.max(d.ryan, d.leif)), 1);
                  return (
                    <div key={week.weekStart} className="bg-[#111] border border-white/10">
                      <button onClick={() => setSelectedWeek(isOpen ? "__none__" : week.weekStart)}
                        className="w-full px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-4 mb-2">
                          <span className="text-sm flex-1">{week.weekLabel}</span>
                          <span className="text-sm tabular-nums text-[#4ade80]">{fmt(week.ryan)}</span>
                          <span className="text-sm tabular-nums text-[#60a5fa]">{fmt(week.leif)}</span>
                          <span className="text-[#555] text-xs">{isOpen ? "▲" : "▼"}</span>
                        </div>
                        <SplitBar a={week.ryan} b={week.leif} />
                      </button>
                      {isOpen && week.days.length > 0 && (
                        <div className="border-t border-white/10">
                          {week.days.map(day => (
                            <div key={day.date} className="grid grid-cols-[1fr_100px_100px_120px] px-5 py-2.5 border-b border-white/5 items-center">
                              <span className="text-xs text-[#555] pl-2">{day.label}</span>
                              <span className={`text-xs text-right tabular-nums ${day.ryan ? "text-[#4ade80]" : "text-[#333]"}`}>{fmt(day.ryan)}</span>
                              <span className={`text-xs text-right tabular-nums ${day.leif ? "text-[#60a5fa]" : "text-[#333]"}`}>{fmt(day.leif)}</span>
                              <div className="pl-4 flex gap-0.5 items-end h-4">
                                <div className="w-3 bg-[#4ade80]/10 flex items-end">
                                  <div className="w-full bg-[#4ade80]" style={{ height: `${Math.round((day.ryan / maxWkDay) * 100)}%`, minHeight: day.ryan ? 2 : 0 }} />
                                </div>
                                <div className="w-3 bg-[#60a5fa]/10 flex items-end">
                                  <div className="w-full bg-[#60a5fa]" style={{ height: `${Math.round((day.leif / maxWkDay) * 100)}%`, minHeight: day.leif ? 2 : 0 }} />
                                </div>
                              </div>
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
