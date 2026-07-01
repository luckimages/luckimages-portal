"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];
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
      if (e.key === "ArrowLeft") setMiddleView(v => MIDDLE_VIEWS[(MIDDLE_VIEWS.indexOf(v) - 1 + MIDDLE_VIEWS.length) % MIDDLE_VIEWS.length]);
      if (e.key === "ArrowRight") setMiddleView(v => MIDDLE_VIEWS[(MIDDLE_VIEWS.indexOf(v) + 1) % MIDDLE_VIEWS.length]);
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
    <main className="relative h-screen bg-black text-white flex flex-col overflow-hidden">
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

        {/* Middle ~2/3: Schedule / Shoot Board toggle */}
        <div className="flex-[2] min-h-0 pb-4 flex flex-col">
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
            <div className="flex-1 min-h-0 grid grid-cols-7 divide-x-[3px] divide-white">
              {days.map((d, i) => {
                const isToday = d.toDateString() === today.toDateString();
                const dayShoots = shootsOnDay(d);
                return (
                  <div key={i} className="flex flex-col min-h-0 px-3">
                    <div className="flex items-center justify-between pb-2 mb-2 shrink-0">
                      <span className="text-xs tracking-[2px] uppercase text-white/60">{DAY_NAMES[i]}</span>
                      <span className={`text-sm font-bold ${isToday ? "text-white" : "text-white/50"}`}>{d.getDate()}</span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
                      {dayShoots.map(s => (
                        <a
                          key={s.id}
                          href="/dashboard/board"
                          className="block hover:bg-white/10 transition-colors border-l-2 pl-2 py-1"
                          style={{ borderLeftColor: STATUS_COLOR[s.status] || "#888" }}
                        >
                          <p className="text-xs font-semibold text-white truncate">{s.client_name || "Client"}</p>
                          <p className="text-[10px] text-white/60 truncate mt-0.5">{s.address}</p>
                          {s.scheduled_at && (
                            <p className="text-[10px] text-white/40 mt-0.5">
                              {new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </p>
                          )}
                          <p className="text-[9px] tracking-[1px] uppercase text-white/30 mt-1">View ↗</p>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Dot + line tracker, centered on each column */}
              <div className="grid relative mb-3 shrink-0" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
                <div className="absolute top-[5px] h-px bg-white/15" style={{ left: `calc(100% / 12)`, right: `calc(100% / 12)` }} />
                {BOARD_STAGES.map(stage => {
                  const stageShoots = boardShoots.filter(sh => stage.dbStatuses.includes(sh.status));
                  const hasRed = stageShoots.some(isRed);
                  return (
                    <div key={stage.key} className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full border-2 relative z-10 transition-colors"
                        style={{
                          background: hasRed ? "#f87171" : stageShoots.length > 0 ? "#fff" : "#000",
                          borderColor: hasRed ? "#f87171" : stageShoots.length > 0 ? "#fff" : "rgba(255,255,255,0.2)",
                        }}
                      />
                      <span className={`text-[9px] tracking-[1.5px] uppercase font-semibold ${stageShoots.length > 0 ? "text-white" : "text-white/30"}`}>{stage.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-6 divide-x-[3px] divide-white">
                {BOARD_STAGES.map(stage => {
                  const stageShoots = boardShoots.filter(sh => stage.dbStatuses.includes(sh.status));
                  return (
                    <div key={stage.key} className="flex flex-col min-h-0 px-3">
                      <div className="flex items-center justify-end pb-2 mb-2 shrink-0">
                        <span className={`text-sm font-bold ${stageShoots.length > 0 ? "text-white" : "text-white/30"}`}>{stageShoots.length}</span>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
                        {stageShoots.map(sh => {
                          const red = isRed(sh);
                          return (
                            <a
                              key={sh.id}
                              href="/dashboard/board"
                              className={`block hover:bg-white/10 transition-colors border-l-2 pl-2 py-1 ${red ? "animate-pulse" : ""}`}
                              style={{ borderLeftColor: red ? "#f87171" : stage.color }}
                            >
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
          )}
        </div>

        {/* Bottom third: To Do + Notifications side by side */}
        <div className="flex-[1] min-h-0 pb-4 md:pb-6 grid grid-cols-2 gap-4">
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
  );
}
