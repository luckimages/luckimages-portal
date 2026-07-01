"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];
const HERO_SRC = "/hero-1.jpg";

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  status: string;
  client_name: string;
};

type Todo = {
  id: string;
  text: string;
  title?: string;
  is_urgent: boolean;
  assigned_to?: string;
  completed_at: string | null;
};

type UpdateItem = {
  id: string;
  type: string;
  category: string;
  message: string;
  created_at: string;
  by?: string;
  link?: string;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "#888",
  scheduled: "#60a5fa",
  en_route: "#60a5fa",
  on_site: "#fbbf24",
  wrapping: "#fbbf24",
  editing: "#a78bfa",
  delivered: "#4ade80",
  completed: "#4ade80",
  cancelled: "#f87171",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardV2Page() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [checked, setChecked] = useState(false);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [updates, setUpdates] = useState<UpdateItem[]>([]);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) {
        router.replace("/dashboard");
        return;
      }
      setUserName(data.user.user_metadata?.full_name?.split(" ")[0] || "");
      setChecked(true);
    });
  }, [router]);

  const loadTodos = useCallback(async () => {
    const res = await fetch("/api/admin/todos");
    if (res.ok) {
      const d = await res.json();
      setTodos(d.active || []);
    }
  }, []);

  useEffect(() => {
    if (!checked) return;
    fetch("/api/admin/shoots?all=1").then(r => r.ok ? r.json() : []).then(setShoots);
    loadTodos();
    fetch("/api/admin/company-updates").then(r => r.ok ? r.json() : { posts: [], auto: [] }).then(d => {
      const all = [...(d.posts || []), ...(d.auto || [])].sort(
        (a: UpdateItem, b: UpdateItem) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setUpdates(all.slice(0, 12));
    });
  }, [checked, loadTodos]);

  async function completeTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
    await fetch("/api/admin/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", id }),
    });
  }

  if (!checked) return null;

  // Build the visible week (Mon–Sun)
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekLabel = `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  function shootsOnDay(d: Date) {
    const ds = d.toDateString();
    return shoots
      .filter(s => s.scheduled_at && new Date(s.scheduled_at).toDateString() === ds)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  }

  return (
    <main className="relative h-screen bg-[#0c0c0c] text-white flex flex-col overflow-hidden">
      {/* Full-page hero background */}
      <div className="absolute inset-0">
        <img src={HERO_SRC} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/90" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 md:px-8 py-4 md:py-5 shrink-0">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <span className="text-[10px] tracking-[3px] uppercase text-[#a78bfa]">V2 Beta</span>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-white/60 hover:text-white transition-colors">Classic Dashboard</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      {/* Centered content column — matches the classic dashboard's max-w container */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col max-w-7xl mx-auto w-full px-4 md:px-8">

        {/* Welcome — big, top left */}
        <div className="pb-4 shrink-0">
          <h1 className="text-[clamp(32px,5vw,56px)] font-black tracking-tight uppercase leading-none">
            Welcome {userName}
          </h1>
        </div>

        {/* Middle ~2/3: Schedule, full width */}
        <div className="flex-[2] min-h-0 pb-4 flex flex-col">
          <div className="flex items-center justify-end gap-3 mb-3 shrink-0">
            <button onClick={() => setWeekOffset(o => o - 1)} className="text-white/50 hover:text-white transition-colors px-2 text-sm">←</button>
            <span className="text-xs tracking-[2px] uppercase text-white/70">{weekLabel}</span>
            <button onClick={() => setWeekOffset(o => o + 1)} className="text-white/50 hover:text-white transition-colors px-2 text-sm">→</button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-xs tracking-[1px] uppercase text-white/50 hover:text-white transition-colors">Today</button>
            )}
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-7 gap-2">
            {days.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              const dayShoots = shootsOnDay(d);
              return (
                <div
                  key={i}
                  className={`flex flex-col min-h-0 bg-transparent border ${isToday ? "border-white" : "border-white/40"} overflow-hidden`}
                >
                  <div className={`px-3 py-2 border-b ${isToday ? "border-white" : "border-white/40"} shrink-0`}>
                    <p className="text-[10px] tracking-[2px] uppercase text-white/60">{DAY_NAMES[i]}</p>
                    <p className={`text-lg font-bold ${isToday ? "text-white" : "text-white/80"}`}>{d.getDate()}</p>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-1.5 flex flex-col gap-1.5">
                    {dayShoots.map(s => (
                      <a
                        key={s.id}
                        href="/dashboard/board"
                        className="block bg-transparent hover:bg-white/10 transition-colors border border-white/20 border-l-2 px-2 py-1.5"
                        style={{ borderLeftColor: STATUS_COLOR[s.status] || "#888" }}
                      >
                        <p className="text-[11px] font-semibold text-white truncate">{s.client_name || s.address}</p>
                        <p className="text-[10px] text-white/50 truncate">
                          {new Date(s.scheduled_at!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom third: To Do + Notifications side by side */}
        <div className="flex-[1] min-h-0 pb-4 md:pb-6 grid grid-cols-2 gap-4">
          {/* To Do */}
          <div className="flex flex-col min-h-0 bg-transparent border border-white/40">
            <p className="text-xs tracking-[3px] uppercase text-white/70 px-4 py-3 border-b border-white/40 shrink-0">To Do</p>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
              {todos.length === 0 ? (
                <p className="text-xs text-white/30 italic py-4">Nothing on the list.</p>
              ) : (
                <div className="flex flex-col divide-y divide-white/5">
                  {todos.map(t => (
                    <div key={t.id} className="flex items-center gap-3 py-2.5">
                      <button
                        onClick={() => completeTodo(t.id)}
                        className="w-4 h-4 rounded-full border border-white/30 hover:border-[#4ade80] hover:bg-[#4ade80]/20 transition-colors shrink-0"
                      />
                      <span className="text-sm text-white/90 truncate flex-1">{t.title || t.text}</span>
                      {t.is_urgent && <span className="text-[9px] tracking-[1px] uppercase text-[#f87171] shrink-0">ASAP</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="flex flex-col min-h-0 bg-transparent border border-white/40">
            <p className="text-xs tracking-[3px] uppercase text-white/70 px-4 py-3 border-b border-white/40 shrink-0">Notifications</p>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
              {updates.length === 0 ? (
                <p className="text-xs text-white/30 italic py-4">Nothing yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-white/5">
                  {updates.map(u => (
                    <a key={u.id} href={u.link || "#"} className="block py-2.5 hover:bg-white/5 transition-colors -mx-1 px-1">
                      <p className="text-sm text-white/90 truncate">{u.message}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{timeAgo(u.created_at)}{u.by ? ` · ${u.by}` : ""}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
