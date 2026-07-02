"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ADMIN_EMAILS } from "@/lib/constants";

type Update = { id: string; type: string; message: string; created_at: string; by?: string };

export default function UpdatesHistoryPage() {
  const router = useRouter();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) {
        router.replace("/dashboard");
        return;
      }
      fetch("/api/admin/company-updates?history=1")
        .then(r => r.json())
        .then(json => {
          const posts = (json.posts || []).map((p: { id: string; message: string; created_at: string; created_by?: string }) => ({
            id: p.id, type: "post", message: p.message, created_at: p.created_at, by: p.created_by,
          }));
          const all: Update[] = [...posts, ...(json.auto || [])].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setUpdates(all);
          setLoading(false);
          // default select today if it has activity
          const today = new Date().getDate();
          const todayKey = today;
          const [y, m] = month.split("-").map(Number);
          const hasToday = all.some(u => {
            const d = new Date(u.created_at);
            return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === todayKey;
          });
          if (hasToday) setSelectedDay(todayKey);
        });
    });
  }, [router]);

  const [year, mon] = month.split("-").map(Number);
  const firstDow = new Date(year, mon - 1, 1).getDay();
  const daysInMonth = new Date(year, mon, 0).getDate();

  const byDay: Record<number, Update[]> = {};
  for (const u of updates) {
    const d = new Date(u.created_at);
    if (d.getFullYear() === year && d.getMonth() === mon - 1) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(u);
    }
  }

  const availableMonths = Array.from(
    new Set(updates.map(u => {
      const d = new Date(u.created_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }))
  ).sort().reverse();

  const dayItems = selectedDay ? (byDay[selectedDay] || []) : [];
  const selectedLabel = selectedDay
    ? new Date(year, mon - 1, selectedDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10 flex-shrink-0">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Dashboard</a>
        </div>
      </header>

      <div className="flex-1 flex flex-col px-8 py-8 max-w-5xl w-full mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase mb-1">Update History</h1>
            <p className="text-xs text-[#444] tracking-wide">All activity — calls, contacts, shoots, and manual posts</p>
          </div>
          <select
            value={month}
            onChange={e => { setMonth(e.target.value); setSelectedDay(null); }}
            className="bg-[#1a1a1a] border border-white/10 text-xs text-[#888] px-3 py-2 outline-none"
          >
            {(availableMonths.length ? availableMonths : [month]).map(m => {
              const [y, mo] = m.split("-").map(Number);
              return <option key={m} value={m}>{new Date(y, mo - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</option>;
            })}
          </select>
        </div>

        {loading ? (
          <p className="text-xs text-[#444] italic">Loading...</p>
        ) : (
          <div className="flex gap-6 flex-1">
            {/* Calendar */}
            <div className="w-72 flex-shrink-0">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                  <div key={d} className="text-[10px] text-[#444] text-center py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const hasActivity = !!byDay[day]?.length;
                  const isSelected = selectedDay === day;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={`aspect-square flex flex-col items-center justify-center text-xs transition-colors rounded ${
                        isSelected
                          ? "bg-white text-black font-bold"
                          : hasActivity
                          ? "text-white hover:bg-white/10"
                          : "text-[#333] hover:bg-white/5 cursor-default"
                      }`}
                    >
                      {day}
                      {hasActivity && !isSelected && (
                        <span className="w-1 h-1 rounded-full bg-[#4ade80] mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day detail — fixed large height always */}
            <div className="flex-1 bg-[#111] border border-white/10 flex flex-col" style={{ minHeight: "520px" }}>
              <div className="px-5 py-3 border-b border-white/10 flex-shrink-0">
                <p className="text-[10px] tracking-[3px] uppercase text-[#555]">
                  {selectedLabel ?? "Select a day"}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {!selectedDay ? (
                  <p className="text-xs text-[#333] italic p-5">Click a day on the calendar to view its activity.</p>
                ) : dayItems.length === 0 ? (
                  <p className="text-xs text-[#333] italic p-5">No activity recorded on this day.</p>
                ) : (
                  dayItems.map(u => {
                    const icon = u.type === "call" ? "📞" : u.type === "contact" ? "👤" : u.type === "shoot" ? "📷" : "💬";
                    return (
                      <div key={u.id} className="flex gap-3 px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <span className="text-sm flex-shrink-0 mt-0.5">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs leading-relaxed">{u.message}</p>
                          <p className="text-[10px] text-[#444] mt-0.5">
                            {new Date(u.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            {u.by ? ` · ${u.by}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
