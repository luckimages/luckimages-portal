"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
};

type Entry = {
  id: string;
  user_name: string;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
};

type WeekSummary = { weekLabel: string; weekStart: string; ryan: number; leif: number };

function fmt(secs: number) {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function fmtDecimal(secs: number) { return (secs / 3600).toFixed(1) + "h"; }

function isRyan(name: string) { return name.toLowerCase().includes("ryan"); }

function getWeekStart(d: Date) {
  const w = new Date(d);
  w.setDate(w.getDate() - w.getDay());
  w.setHours(0, 0, 0, 0);
  return w;
}

function wkLabel(d: Date) {
  const end = new Date(d); end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function SplitBar({ a, b }: { a: number; b: number }) {
  const total = a + b;
  if (!total) return <div className="w-full h-1.5 bg-[#222]" />;
  return (
    <div className="w-full h-1.5 flex overflow-hidden gap-px">
      <div style={{ width: `${(a / total) * 100}%`, backgroundColor: "#4ade80" }} />
      <div style={{ width: `${(b / total) * 100}%`, backgroundColor: "#60a5fa" }} />
    </div>
  );
}

export default function TeamPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
    });

    Promise.all([
      createClient().from("contacts").select("id,name,email,phone,brokerage").eq("type", "employee").neq("stage", "deleted"),
      fetch("/api/admin/time-entries?mode=all").then(r => r.json()),
    ]).then(([{ data: m }, timeData]) => {
      setMembers(m || []);
      setEntries(timeData?.allEntries || []);
      setLoading(false);
    });
  }, [router]);

  const now = Date.now();
  const weekMap = new Map<string, WeekSummary>();
  entries.forEach(e => {
    const secs = e.stopped_at ? (e.duration_seconds || 0) : Math.floor((now - new Date(e.started_at).getTime()) / 1000);
    const ws = getWeekStart(new Date(e.started_at));
    const wsStr = ws.toISOString().split("T")[0];
    if (!weekMap.has(wsStr)) weekMap.set(wsStr, { weekLabel: wkLabel(ws), weekStart: wsStr, ryan: 0, leif: 0 });
    const week = weekMap.get(wsStr)!;
    if (isRyan(e.user_name)) week.ryan += secs; else week.leif += secs;
  });
  const weeks = Array.from(weekMap.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  const allRyan = weeks.reduce((s, w) => s + w.ryan, 0);
  const allLeif = weeks.reduce((s, w) => s + w.leif, 0);
  const currentWeek = weeks[0];
  const maxWeekSecs = Math.max(...weeks.map(w => w.ryan + w.leif), 1);

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">


      <div className="max-w-4xl mx-auto px-6 md:px-8 py-8 space-y-12">
        <div>
          <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">Luck Images</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">Team</h1>
        </div>

        {/* Team member cards */}
        <section>
          <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Members</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map(m => (
              <a key={m.id} href={`/admin/contacts/${m.id}`} className="bg-[#111] border border-white/10 p-6 flex items-center gap-5 hover:bg-white/[0.04] transition-colors group">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 shrink-0 relative">
                  {!avatarErrors.has(m.id) ? (
                    <img
                      src={`${SUPABASE_URL}/storage/v1/object/public/avatars/${m.id}`}
                      alt={m.name}
                      className="w-full h-full object-cover"
                      onError={() => setAvatarErrors(prev => new Set([...prev, m.id]))}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-black text-white/30">
                      {m.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-black tracking-tight uppercase group-hover:text-white transition-colors">{m.name}</p>
                  <p className="text-sm text-[#555] mb-2">{m.brokerage || "Team Member"}</p>
                  {m.email && <p className="text-xs text-[#444] truncate">{m.email}</p>}
                  {m.phone && <p className="text-xs text-[#444]">{m.phone}</p>}
                </div>
                <span className="text-[#333] group-hover:text-white transition-colors text-sm">→</span>
              </a>
            ))}
          </div>
        </section>

        {/* Time Tracker */}
        {!loading && (
          <>
            {/* All-time totals */}
            <section>
              <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Time Logged — All Time</p>
              <div className="bg-[#111] border border-white/10 p-6">
                <div className="space-y-4">
                  {[{ name: "Ryan", secs: allRyan, color: "#4ade80" }, { name: "Leif", secs: allLeif, color: "#60a5fa" }].map(({ name, secs, color }) => (
                    <div key={name}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-[#888]">{name}</span>
                        </div>
                        <span className="font-bold tabular-nums">{fmtDecimal(secs)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#222] overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${allRyan + allLeif ? (secs / (allRyan + allLeif)) * 100 : 0}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-white/10 flex justify-between text-xs">
                    <span className="text-[#555]">Combined</span>
                    <span className="font-semibold">{fmtDecimal(allRyan + allLeif)}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* This week */}
            {currentWeek && (
              <section>
                <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  This Week — {currentWeek.weekLabel}
                </p>
                <div className="bg-[#111] border border-white/10 p-6 flex items-center gap-8">
                  <div className="flex-1 space-y-3">
                    {[{ name: "Ryan", secs: currentWeek.ryan, color: "#4ade80" }, { name: "Leif", secs: currentWeek.leif, color: "#60a5fa" }].map(({ name, secs, color }) => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-xs text-[#555] w-8">{name}</span>
                        <div className="flex-1 h-2 bg-[#222] overflow-hidden">
                          <div className="h-full" style={{ width: `${currentWeek.ryan + currentWeek.leif ? (secs / (currentWeek.ryan + currentWeek.leif)) * 100 : 0}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-sm font-bold tabular-nums w-14 text-right" style={{ color }}>{fmt(secs)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Week by week */}
            <section>
              <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Week by Week</p>

              {/* Mini bar chart */}
              <div className="bg-[#111] border border-white/10 p-6 mb-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-[#888]"><span className="w-2 h-2 bg-[#4ade80]" />Ryan</div>
                  <div className="flex items-center gap-1.5 text-xs text-[#888]"><span className="w-2 h-2 bg-[#60a5fa]" />Leif</div>
                </div>
                <div className="flex items-end gap-1.5 h-20">
                  {weeks.slice(0, 8).reverse().map(w => {
                    const totalH = ((w.ryan + w.leif) / maxWeekSecs);
                    const ryanPct = w.ryan / (w.ryan + w.leif || 1);
                    return (
                      <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="w-full flex flex-col justify-end overflow-hidden" style={{ height: `${Math.round(totalH * 72)}px`, minHeight: 2 }}>
                          <div style={{ height: `${ryanPct * 100}%`, backgroundColor: "#4ade80", minHeight: 2 }} />
                          <div style={{ height: `${(1 - ryanPct) * 100}%`, backgroundColor: "#60a5fa", minHeight: w.leif ? 2 : 0 }} />
                        </div>
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 px-2 py-1.5 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                          <p className="text-[#555] mb-0.5">{w.weekLabel}</p>
                          <p className="text-[#4ade80]">Ryan {fmt(w.ryan)}</p>
                          <p className="text-[#60a5fa]">Leif {fmt(w.leif)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                {weeks.map((week, i) => {
                  const isOpen = selectedWeek === week.weekStart || (i === 0 && selectedWeek === null);
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
                    </div>
                  );
                })}
                {weeks.length === 0 && <p className="text-xs text-[#444] italic">No time entries yet.</p>}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
