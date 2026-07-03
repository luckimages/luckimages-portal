"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

const APPS = [
  { label: "Contacts",     icon: "👥", href: "/admin/contacts",        color: "#60a5fa" },
  { label: "Shoots",       icon: "📸", href: "/admin/shoots",           color: "#fbbf24" },
  { label: "Calendar",     icon: "📅", href: "/dashboard/calendar",     color: "#4ade80" },
  { label: "Shoot Board",  icon: "🗂️", href: "/dashboard/board",        color: "#a78bfa" },
  { label: "Todos",        icon: "✅", href: "/admin/todos",            color: "#f472b6" },
  { label: "Marketing",    icon: "📈", href: "/dashboard/marketing",    color: "#fb923c" },
  { label: "Outreach",     icon: "✉️", href: "/dashboard/outreach",     color: "#34d399" },
  { label: "Analytics",    icon: "📊", href: "/dashboard/analytics",    color: "#60a5fa" },
  { label: "Quotes",       icon: "💬", href: "/dashboard/quotes",       color: "#fbbf24" },
  { label: "Time Tracker", icon: "⏱️", href: "/admin/time-tracker",    color: "#a78bfa" },
  { label: "Cold Calls",   icon: "📞", href: "/admin/cold-calls",       color: "#f87171" },
  { label: "Updates",      icon: "📣", href: "/admin/updates",          color: "#4ade80" },
];

function APP_ICON({ name, color }: { name: string; color: string }) {
  const s = { stroke: color, fill: "none", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<string, React.ReactNode> = {
    "Contacts":     <><circle cx="9" cy="7" r="4" {...s}/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" {...s}/><path d="M16 3.13a4 4 0 0 1 0 7.75" {...s}/><path d="M21 21v-2a4 4 0 0 0-3-3.87" {...s}/></>,
    "Shoots":       <><path d="M23 7l-7 5 7 5V7z" {...s}/><rect x="1" y="5" width="15" height="14" rx="2" ry="2" {...s}/></>,
    "Calendar":     <><rect x="3" y="4" width="18" height="18" rx="2" {...s}/><line x1="16" y1="2" x2="16" y2="6" {...s}/><line x1="8" y1="2" x2="8" y2="6" {...s}/><line x1="3" y1="10" x2="21" y2="10" {...s}/></>,
    "Shoot Board":  <><rect x="3" y="3" width="7" height="18" rx="1" {...s}/><rect x="14" y="3" width="7" height="10" rx="1" {...s}/><rect x="14" y="17" width="7" height="4" rx="1" {...s}/></>,
    "Todos":        <><path d="M9 11l3 3L22 4" {...s}/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" {...s}/></>,
    "Marketing":    <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" {...s}/><polyline points="16 7 22 7 22 13" {...s}/></>,
    "Outreach":     <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" {...s}/><polyline points="22,6 12,13 2,6" {...s}/></>,
    "Analytics":    <><line x1="18" y1="20" x2="18" y2="10" {...s}/><line x1="12" y1="20" x2="12" y2="4" {...s}/><line x1="6" y1="20" x2="6" y2="14" {...s}/></>,
    "Quotes":       <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...s}/></>,
    "Time Tracker": <><circle cx="12" cy="12" r="10" {...s}/><polyline points="12 6 12 12 16 14" {...s}/></>,
    "Cold Calls":   <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.8a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.08 6.08l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" {...s}/></>,
    "Updates":      <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...s}/><path d="M13.73 21a2 2 0 0 1-3.46 0" {...s}/></>,
  };
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" className="md:w-9 md:h-9">
      {icons[name] ?? <circle cx="12" cy="12" r="9" stroke={color} fill="none" strokeWidth={1.5}/>}
    </svg>
  );
}

const MIDDLE_VIEWS = ["schedule", "board"] as const;
type MiddleView = (typeof MIDDLE_VIEWS)[number];
const MIDDLE_VIEW_LABEL: Record<MiddleView, string> = { schedule: "Weekly Schedule", board: "Shoot Board" };

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  status: string;
  client_name: string;
  checked_in_at?: string | null;
  delivered_at?: string | null;
  paid_at?: string | null;
};

type TodoList = { id: string; name: string };
type Todo = {
  id: string;
  text: string;
  title?: string;
  is_urgent: boolean;
  assigned_to?: string;
  list_id?: string | null;
  due_date?: string | null;
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

const BOARD_STAGES: { key: string; label: string; color: string; dbStatuses: string[] }[] = [
  { key: "pending",   label: "Pending",   color: "#fbbf24", dbStatuses: ["pending"] },
  { key: "scheduled", label: "Scheduled", color: "#60a5fa", dbStatuses: ["scheduled"] },
  { key: "active",    label: "Active",    color: "#f472b6", dbStatuses: ["en_route", "on_site", "wrapping"] },
  { key: "editing",   label: "Editing",   color: "#facc15", dbStatuses: ["editing"] },
  { key: "delivered", label: "Delivered", color: "#34d399", dbStatuses: ["delivered"] },
  { key: "paid",      label: "Paid",      color: "#4ade80", dbStatuses: ["completed"] },
];

const TODO_TABS: { key: string; label: string; color: string }[] = [
  { key: "asap", label: "ASAP", color: "text-[#fbbf24]" },
  { key: "general", label: "General", color: "text-white/70" },
  { key: "ryan", label: "Ryan", color: "text-[#4ade80]" },
  { key: "leif", label: "Leif", color: "text-[#60a5fa]" },
];

const NOTIF_CATS: { key: string; label: string; dot: string }[] = [
  { key: "alerts", label: "Alerts", dot: "bg-red-500" },
  { key: "shoots", label: "Shoots", dot: "bg-[#60a5fa]" },
  { key: "clients", label: "Clients", dot: "bg-[#fbbf24]" },
  { key: "marketing", label: "Marketing", dot: "bg-[#f472b6]" },
  { key: "finance", label: "Finance", dot: "bg-[#4ade80]" },
  { key: "team", label: "Team", dot: "bg-[#fb923c]" },
  { key: "nocturne", label: "Nocturne", dot: "bg-[#a78bfa]" },
];

export default function DashboardV2Page() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [checked, setChecked] = useState(false);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [middleView, setMiddleView] = useState<MiddleView>("schedule");

  const [todoLists, setTodoLists] = useState<TodoList[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoTab, setTodoTab] = useState("asap");

  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(NOTIF_CATS.map(c => c.key)));
  const [swipePage, setSwipePage] = useState(0);
  const touchStartX = useRef<number | null>(null);

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
      setTodoLists(d.lists || []);
      setTodos(d.active || []);
    }
  }, []);

  const loadShoots = useCallback(async () => {
    const res = await fetch("/api/admin/shoots?full=1");
    if (res.ok) setShoots(await res.json());
  }, []);

  useEffect(() => {
    if (!checked) return;
    loadShoots();
    loadTodos();
    fetch("/api/admin/company-updates").then(r => r.ok ? r.json() : { posts: [], auto: [] }).then(d => {
      const all = [...(d.posts || []), ...(d.auto || [])].sort(
        (a: UpdateItem, b: UpdateItem) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setUpdates(all);
    });
  }, [checked, loadTodos, loadShoots]);

  // Auto-refresh the shoot board every 30s while it's the active view, matching the live board page
  useEffect(() => {
    if (!checked || middleView !== "board") return;
    const id = setInterval(loadShoots, 30000);
    return () => clearInterval(id);
  }, [checked, middleView, loadShoots]);

  // Arrow keys flip between Weekly Schedule / Shoot Board
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setSwipePage(0);
      if (e.key === "ArrowRight") setSwipePage(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function completeTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
    await fetch("/api/admin/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", id }),
    });
  }

  function toggleCat(key: string) {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.size === NOTIF_CATS.length) return new Set([key]);
      if (next.has(key) && next.size === 1) return new Set(NOTIF_CATS.map(c => c.key));
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  if (!checked) return null;

  const asapList = todoLists.find(l => l.name.toLowerCase().includes("asap")) || todoLists[0];
  const generalList = todoLists.find(l => l.name.toLowerCase().includes("general"));
  function getTabTasks(tab: string) {
    if (tab === "asap") return asapList ? todos.filter(t => t.list_id === asapList.id) : [];
    if (tab === "general") return generalList ? todos.filter(t => t.list_id === generalList.id) : todos.filter(t => !t.list_id || t.list_id !== asapList?.id);
    return todos.filter(t => t.assigned_to === tab);
  }
  const activeTabDef = TODO_TABS.find(t => t.key === todoTab)!;
  const tabTasks = getTabTasks(todoTab);

  const filteredUpdates = updates.filter(u => activeCategories.has(u.category || "nocturne"));
  const catDot: Record<string, string> = Object.fromEntries(NOTIF_CATS.map(c => [c.key, c.dot]));

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

  // Board view — mirrors the live shoot board's alert detection
  const boardShoots = shoots.filter(s => s.status !== "cancelled");
  const nowMs = Date.now();
  function isRed(sh: Shoot): boolean {
    const scheduledMs = sh.scheduled_at ? new Date(sh.scheduled_at).getTime() : null;
    if (sh.status === "scheduled" && !sh.checked_in_at && scheduledMs && nowMs > scheduledMs + 5 * 60000) return true;
    if (sh.status === "editing" && scheduledMs) {
      const due = new Date(scheduledMs); due.setDate(due.getDate() + 1); due.setHours(16, 0, 0, 0);
      if (nowMs > due.getTime()) return true;
    }
    if ((sh.status === "delivered" || sh.status === "completed") && sh.delivered_at && !sh.paid_at) {
      if (nowMs > new Date(sh.delivered_at).getTime() + 24 * 3600000) return true;
    }
    return false;
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-black"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) setSwipePage(dx < 0 ? 1 : 0);
        touchStartX.current = null;
      }}
    >
      {/* Dot indicators — clickable on all screens */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-50">
        {[0, 1].map(i => (
          <button key={i} onClick={() => setSwipePage(i)} className={`w-2 h-2 rounded-full transition-all duration-300 ${swipePage === i ? "bg-white scale-125" : "bg-white/25 hover:bg-white/50"}`} />
        ))}
      </div>

      {/* Sliding track — two pages side by side */}
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ width: "200vw", transform: `translateX(${swipePage === 0 ? 0 : -50}%)` }}
      >

      {/* PAGE 1 — Dashboard */}
      <div className="w-screen h-full flex-shrink-0">
    <main className="relative h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 md:px-8 py-4 md:py-5 shrink-0">
        <a href="/" className="text-[clamp(24px,4vw,40px)] font-black tracking-tight uppercase hover:opacity-70 transition-opacity whitespace-nowrap leading-none">Luck Images</a>
        <div className="flex items-center gap-3">
          <button onClick={() => setSwipePage(p => p === 0 ? 1 : 0)} className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors border border-white/20 px-4 py-2 hover:border-white/50">
            {swipePage === 0 ? "Apps →" : "← Back"}
          </button>
          <a href="/choose-portal" className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors border border-white/20 px-4 py-2 hover:border-white/50">Portals</a>
        </div>
      </header>

      {/* Centered content column — matches the classic dashboard's max-w container */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col max-w-7xl mx-auto w-full px-4 md:px-8">

        {/* Welcome — big, top left */}
        <div className="pb-4 shrink-0">
          <h1 className="text-[clamp(24px,4vw,40px)] font-black tracking-tight uppercase leading-none">
            Welcome {userName}
          </h1>
        </div>

        {/* Middle ~2/3: Schedule / Shoot Board toggle */}
        <div className="flex-[2] min-h-0 pb-8 flex flex-col">
          <div className="flex items-center justify-between gap-3 pb-3 mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMiddleView(v => MIDDLE_VIEWS[(MIDDLE_VIEWS.indexOf(v) - 1 + MIDDLE_VIEWS.length) % MIDDLE_VIEWS.length])}
                className="text-white/50 hover:text-white transition-colors px-1 text-sm"
              >
                ←
              </button>
              <span className="text-xs tracking-[2px] uppercase text-white whitespace-nowrap">{MIDDLE_VIEW_LABEL[middleView]}</span>
              <button
                onClick={() => setMiddleView(v => MIDDLE_VIEWS[(MIDDLE_VIEWS.indexOf(v) + 1) % MIDDLE_VIEWS.length])}
                className="text-white/50 hover:text-white transition-colors px-1 text-sm"
              >
                →
              </button>
            </div>
            {middleView === "schedule" && (
              <div className="flex items-center gap-3">
                <button onClick={() => setWeekOffset(o => o - 1)} className="text-white/50 hover:text-white transition-colors px-2 text-sm">←</button>
                <span className="text-xs tracking-[2px] uppercase text-white/70">{weekLabel}</span>
                <button onClick={() => setWeekOffset(o => o + 1)} className="text-white/50 hover:text-white transition-colors px-2 text-sm">→</button>
                {weekOffset !== 0 && (
                  <button onClick={() => setWeekOffset(0)} className="text-xs tracking-[1px] uppercase text-white/50 hover:text-white transition-colors">Today</button>
                )}
              </div>
            )}
            {middleView === "board" && (
              <a href="/dashboard/board" className="text-[10px] tracking-[2px] uppercase text-white/40 hover:text-white/70 transition-colors">Full Board →</a>
            )}
          </div>

          {middleView === "schedule" ? (
            /* Mobile: rows. Desktop: 7 columns */
            <div className="flex-1 min-h-0 overflow-auto">
              {/* Mobile rows */}
              <div className="md:hidden flex flex-col divide-y divide-white/10 h-full overflow-y-auto">
                {days.map((d, i) => {
                  const isToday = d.toDateString() === today.toDateString();
                  const dayShoots = shootsOnDay(d);
                  return (
                    <div key={i} className={`flex gap-4 py-3 px-1 ${isToday ? "bg-white/[0.02]" : ""}`}>
                      <div className="w-14 shrink-0 flex flex-col items-start justify-start pt-0.5">
                        <span className={`text-[10px] tracking-[2px] uppercase ${isToday ? "text-white" : "text-white/40"}`}>{DAY_NAMES[i]}</span>
                        <span className={`text-lg font-bold leading-none mt-0.5 ${isToday ? "text-white" : "text-white/30"}`}>{d.getDate()}</span>
                      </div>
                      <div className="flex-1 flex flex-col gap-2 min-w-0">
                        {dayShoots.length === 0 ? (
                          <p className="text-[10px] text-white/20 pt-1">—</p>
                        ) : dayShoots.map(s => (
                          <a key={s.id} href="/dashboard/board" className="flex items-start gap-2 hover:bg-white/5 transition-colors rounded-sm py-1">
                            <div className="w-1 h-full min-h-[32px] rounded-full shrink-0 mt-1" style={{ background: STATUS_COLOR[s.status] || "#888" }} />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{s.client_name || "Client"}</p>
                              <p className="text-[10px] text-white/50 truncate">{s.address}</p>
                              {s.scheduled_at && <p className="text-[10px] text-white/30">{new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop columns */}
              <div className="hidden md:grid h-full" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
                {days.map((d, i) => {
                  const isToday = d.toDateString() === today.toDateString();
                  const dayShoots = shootsOnDay(d);
                  return (
                    <div key={i} className={`flex flex-col min-h-0 border-l border-white/10 px-2 pt-2 ${isToday ? "bg-white/[0.02]" : ""}`}>
                      <div className="shrink-0 mb-2">
                        <span className={`text-[10px] tracking-[2px] uppercase block ${isToday ? "text-white" : "text-white/40"}`}>{DAY_NAMES[i]}</span>
                        <span className={`text-lg font-bold leading-none ${isToday ? "text-white" : "text-white/30"}`}>{d.getDate()}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0">
                        {dayShoots.length === 0 ? (
                          <p className="text-[10px] text-white/20">—</p>
                        ) : dayShoots.map(s => (
                          <a key={s.id} href="/dashboard/board" className="flex items-start gap-1.5 hover:bg-white/5 transition-colors rounded-sm py-1">
                            <div className="w-1 min-h-[28px] rounded-full shrink-0 mt-0.5" style={{ background: STATUS_COLOR[s.status] || "#888" }} />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-white truncate">{s.client_name || "Client"}</p>
                              <p className="text-[10px] text-white/50 truncate">{s.address}</p>
                              {s.scheduled_at && <p className="text-[10px] text-white/30">{new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col overflow-auto">
              {/* Mobile: rows */}
              <div className="md:hidden flex flex-col divide-y divide-white/10 overflow-y-auto">
                {BOARD_STAGES.map(stage => {
                  const stageShoots = boardShoots.filter(sh => stage.dbStatuses.includes(sh.status));
                  const hasRed = stageShoots.some(isRed);
                  return (
                    <div key={stage.key} className="py-3 px-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: hasRed ? "#f87171" : stage.color }} />
                        <span className="text-[10px] tracking-[1.5px] uppercase font-semibold text-white/60">{stage.label}</span>
                        <span className="text-[10px] text-white/30">({stageShoots.length})</span>
                      </div>
                      <div className="flex flex-col gap-2 pl-4">
                        {stageShoots.length === 0 ? <p className="text-[10px] text-white/20">—</p> : stageShoots.map(sh => {
                          const red = isRed(sh);
                          return (
                            <a key={sh.id} href="/dashboard/board" className={`block border-l-2 pl-2 py-1 hover:bg-white/5 ${red ? "animate-pulse" : ""}`} style={{ borderLeftColor: red ? "#f87171" : stage.color }}>
                              <p className="text-xs font-semibold text-white truncate">{sh.client_name || "Client"}</p>
                              <p className="text-[10px] text-white/60 truncate">{sh.address}</p>
                              {red && <p className="text-[10px] text-red-400">Needs attention</p>}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop: columns */}
              <div className="hidden md:flex md:flex-col flex-1 min-h-0">
                <div className="grid relative mb-3 shrink-0" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
                  <div className="absolute top-[5px] h-px bg-white/15" style={{ left: `calc(100% / 12)`, right: `calc(100% / 12)` }} />
                  {BOARD_STAGES.map(stage => {
                    const stageShoots = boardShoots.filter(sh => stage.dbStatuses.includes(sh.status));
                    const hasRed = stageShoots.some(isRed);
                    return (
                      <div key={stage.key} className="flex flex-col items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full border-2 relative z-10 transition-colors" style={{ background: hasRed ? "#f87171" : stageShoots.length > 0 ? "#fff" : "#000", borderColor: hasRed ? "#f87171" : stageShoots.length > 0 ? "#fff" : "rgba(255,255,255,0.2)" }} />
                        <span className={`text-[9px] tracking-[1.5px] uppercase font-semibold ${stageShoots.length > 0 ? "text-white" : "text-white/30"}`}>{stage.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex-1 min-h-0 grid grid-cols-6">
                  {BOARD_STAGES.map(stage => {
                    const stageShoots = boardShoots.filter(sh => stage.dbStatuses.includes(sh.status));
                    return (
                      <div key={stage.key} className="flex flex-col min-h-0 px-5">
                        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
                          {stageShoots.map(sh => {
                            const red = isRed(sh);
                            return (
                              <a key={sh.id} href="/dashboard/board" className={`block hover:bg-white/10 transition-colors border-l-2 pl-2 py-1 ${red ? "animate-pulse" : ""}`} style={{ borderLeftColor: red ? "#f87171" : stage.color }}>
                                <p className="text-xs font-semibold text-white truncate">{sh.client_name || "Client"}</p>
                                <p className="text-[10px] text-white/60 truncate mt-0.5">{sh.address}</p>
                                {red && <p className="text-[10px] text-red-400 mt-0.5">Needs attention</p>}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom third: To Do + Notifications side by side */}
        <div className="flex-[1] min-h-0 pb-8 md:pb-10 grid grid-cols-2 gap-4">
          {/* To Do — tabbed */}
          <div className="flex flex-col min-h-0 border-2 border-white px-4 pt-3">
            <div className="flex items-center gap-1 pb-2 mb-2 border-b border-white/20 shrink-0 overflow-x-auto">
              {TODO_TABS.map((tab, i) => {
                const count = getTabTasks(tab.key).length;
                const isActive = tab.key === todoTab;
                return (
                  <div key={tab.key} className="flex items-center">
                    {i > 0 && <span className="text-white/20 text-[10px] px-1">/</span>}
                    <button
                      onClick={() => setTodoTab(tab.key)}
                      className={`py-1 px-0.5 text-[10px] tracking-[1.5px] uppercase font-semibold transition-colors whitespace-nowrap ${
                        isActive ? tab.color : "text-white/30 hover:text-white/50"
                      }`}
                    >
                      {tab.label}{count > 0 && <span className="opacity-60"> ({count})</span>}
                    </button>
                  </div>
                );
              })}
              <span className="text-white/20 text-[10px] px-1">/</span>
              <a href="/dashboard/todos" className="py-1 px-0.5 text-[10px] text-white/30 hover:text-white/60 transition-colors whitespace-nowrap">all</a>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {tabTasks.length === 0 ? (
                <p className="text-xs text-white/30 italic py-4">Nothing in {activeTabDef.label}.</p>
              ) : (
                <div className="flex flex-col divide-y divide-white/10">
                  {tabTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 py-2.5">
                      <button
                        onClick={() => completeTodo(t.id)}
                        className="w-4 h-4 rounded-full border border-white/30 hover:border-[#4ade80] hover:bg-[#4ade80]/20 transition-colors shrink-0"
                      />
                      <span className="text-sm text-white/90 truncate flex-1">{t.title || t.text}</span>
                      {t.is_urgent && <span className="text-[9px] tracking-[1px] uppercase text-[#fbbf24] shrink-0">ASAP</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <a href="/dashboard/todos" className="border-t border-white/20 py-2 text-xs text-white/40 hover:text-white/70 transition-colors shrink-0">
              + Add task or view all lists →
            </a>
          </div>

          {/* Notifications */}
          <div className="flex flex-col min-h-0 border-2 border-white px-4 pt-3">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/20 shrink-0">
              <span className="text-xs tracking-[2px] uppercase text-white/70">Notifications</span>
              <a href="/dashboard/updates" className="text-[10px] text-white/40 hover:text-white/70 transition-colors">View all →</a>
            </div>
            <div className="flex items-center gap-1.5 pb-2 mb-1 overflow-x-auto shrink-0">
              {NOTIF_CATS.map(cat => {
                const isActive = activeCategories.has(cat.key);
                return (
                  <button
                    key={cat.key}
                    onClick={() => toggleCat(cat.key)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide whitespace-nowrap transition-all shrink-0 ${
                      isActive ? "border-white/25 bg-white/[0.08] text-white/70" : "border-white/10 bg-transparent text-white/30 hover:text-white/50"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? cat.dot : "bg-white/20"}`} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pb-3">
              {filteredUpdates.length === 0 ? (
                <p className="text-xs text-white/30 italic py-4">Nothing in this category.</p>
              ) : (
                <div className="flex flex-col divide-y divide-white/10">
                  {filteredUpdates.slice(0, 40).map(u => {
                    const dot = catDot[u.category || "nocturne"] || "bg-white/40";
                    const headline = u.message.split("\n---\n")[0];
                    return (
                      <a key={u.id} href={u.link || "#"} className="flex gap-2.5 items-start py-2.5 hover:bg-white/5 transition-colors -mx-1 px-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white/90 truncate">{headline}</p>
                          <p className="text-[10px] text-white/40 mt-0.5">
                            {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {" · "}
                            {new Date(u.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            {u.by ? ` · ${u.by}` : ""}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
      </div>{/* end page 1 */}

      {/* PAGE 2 — App Grid */}
      <div className="w-screen h-full flex-shrink-0 bg-black flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 shrink-0">
          <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
          <button onClick={() => setSwipePage(0)} className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors border border-white/20 px-4 py-2 hover:border-white/50">← Back</button>
        </header>

        <div className="flex-1 flex items-center justify-center p-4 md:p-12 min-h-0">
          <div className="w-full md:max-w-3xl border border-white/20 gap-px bg-white/10" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            {APPS.map(app => (
              <a
                key={app.href}
                href={app.href}
                className="bg-black flex flex-col items-center justify-center gap-3 p-5 md:p-8 hover:bg-white/5 active:bg-white/10 transition-colors group"
              >
                <APP_ICON name={app.label} color={app.color} />
                <span className="text-[9px] md:text-[10px] tracking-[2px] uppercase text-white/50 group-hover:text-white transition-colors text-center leading-tight">{app.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>{/* end page 2 */}

      </div>{/* end sliding track */}
    </div>
  );
}
