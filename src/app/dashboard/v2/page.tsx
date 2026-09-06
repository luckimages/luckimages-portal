"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

const APPS = [
  { label: "Contacts",    href: "/admin/contacts",        color: "#888" },
  { label: "Phone",       href: "/dashboard/phone",       color: "#888" },
  { label: "Shoot Log",   href: "/admin/shoots",           color: "#888" },
  { label: "Calendar",    href: "/dashboard/calendar",     color: "#888" },
  { label: "Todos",       href: "/admin/todos",            color: "#888" },
  { label: "Marketing",   href: "/dashboard/marketing",    color: "#888" },
  { label: "Traffic",      href: "/dashboard/analytics",    color: "#888" },
  { label: "Revenue",     href: "/dashboard/revenue",      color: "#888" },

  { label: "Updates",     href: "/dashboard/updates",      color: "#888" },
];

function APP_ICON({ name, color }: { name: string; color: string }) {
  const s = { stroke: color, fill: "none", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<string, React.ReactNode> = {
    "Contacts":     <><circle cx="9" cy="7" r="4" {...s}/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" {...s}/><path d="M16 3.13a4 4 0 0 1 0 7.75" {...s}/><path d="M21 21v-2a4 4 0 0 0-3-3.87" {...s}/></>,
    "Calendar":     <><rect x="3" y="4" width="18" height="18" rx="2" {...s}/><line x1="16" y1="2" x2="16" y2="6" {...s}/><line x1="8" y1="2" x2="8" y2="6" {...s}/><line x1="3" y1="10" x2="21" y2="10" {...s}/></>,
    "Todos":        <><path d="M9 11l3 3L22 4" {...s}/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" {...s}/></>,
    "Marketing":    <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" {...s}/><polyline points="16 7 22 7 22 13" {...s}/></>,
    "Traffic":      <><line x1="18" y1="20" x2="18" y2="10" {...s}/><line x1="12" y1="20" x2="12" y2="4" {...s}/><line x1="6" y1="20" x2="6" y2="14" {...s}/></>,
    "Updates":      <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...s}/><path d="M13.73 21a2 2 0 0 1-3.46 0" {...s}/></>,
    "Revenue":      <><line x1="12" y1="1" x2="12" y2="23" {...s}/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" {...s}/></>,
    "Shoot Log":    <><rect x="3" y="3" width="18" height="18" rx="2" {...s}/><path d="M3 9h18" {...s}/><path d="M9 21V9" {...s}/></>,
    "Team":         <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...s}/><circle cx="9" cy="7" r="4" {...s}/><path d="M23 21v-2a4 4 0 0 0-3-3.87" {...s}/><path d="M16 3.13a4 4 0 0 1 0 7.75" {...s}/></>,
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

type PendingShootPreview = {
  id: string;
  address: string;
  client_name: string;
  scheduled_at: string | null;
  drive_minutes: number | null;
  price: number | null;
};

type RegistrationPreview = {
  id: string;
  name: string;
  email: string | null;
  registered_at: string;
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

function DashboardV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userName, setUserName] = useState("");
  const [checked, setChecked] = useState(false);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [middleView, setMiddleView] = useState<MiddleView>("schedule");

  const [todoLists, setTodoLists] = useState<TodoList[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoTab, setTodoTab] = useState("asap");

  const [pendingShoots, setPendingShoots] = useState<PendingShootPreview[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationPreview[]>([]);
  const [pendingAcked, setPendingAcked] = useState<Set<string>>(new Set());
  const [regAcked, setRegAcked] = useState<Set<string>>(new Set());
  const [confirmingShoot, setConfirmingShoot] = useState<string | null>(null);
  const [swipePage, setSwipePage] = useState(() => searchParams.get("page") === "apps" ? 1 : 0);
  const [headerFlip, setHeaderFlip] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const DEFAULT_ORDER = APPS.map(a => a.label);
  const [appOrder, setAppOrder] = useState<string[]>(DEFAULT_ORDER);
  const [hiddenApps, setHiddenApps] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [editOrder, setEditOrder] = useState<string[]>(DEFAULT_ORDER);
  const [editHidden, setEditHidden] = useState<Set<string>>(new Set());
  const dragIndex = useRef<number | null>(null);
  const [selectedAppLabel, setSelectedAppLabel] = useState<string | null>(() => searchParams.get("app"));
  const [deepLinkShootId] = useState<string | null>(() => searchParams.get("shoot"));

  // If the v2 dashboard ever ends up inside an iframe, bust out immediately.
  // This prevents the nested-window problem when an app navigates to /dashboard.
  useEffect(() => {
    if (typeof window !== "undefined" && window.self !== window.top) {
      window.top!.location.href = window.location.href;
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) {
        router.replace("/choose-portal");
        return;
      }
      setUserName(data.user.user_metadata?.full_name?.split(" ")[0] || "");
      const meta = data.user.user_metadata || {};
      if (meta.app_order) {
        // Merge: keep saved order but append any new apps not yet in it
        const saved: string[] = meta.app_order;
        const allLabels = APPS.map(a => a.label);
        const merged = [...saved.filter(l => allLabels.includes(l)), ...allLabels.filter(l => !saved.includes(l))];
        setAppOrder(merged);
      }
      if (meta.hidden_apps) setHiddenApps(new Set(meta.hidden_apps));
      setChecked(true);
    });
  }, [router]);

  function openEditMode() {
    setEditOrder([...appOrder]);
    setEditHidden(new Set(hiddenApps));
    setEditMode(true);
  }

  async function saveLayout() {
    setAppOrder(editOrder);
    setHiddenApps(new Set(editHidden));
    setEditMode(false);
    await createClient().auth.updateUser({ data: { app_order: editOrder, hidden_apps: [...editHidden] } });
  }

  function onDragStart(i: number) { dragIndex.current = i; }
  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === i) return;
    const next = [...editOrder];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(i, 0, moved);
    dragIndex.current = i;
    setEditOrder(next);
  }
  function onDragEnd() { dragIndex.current = null; }

  function toggleHide(label: string) {
    setEditHidden(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

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
    fetch("/api/admin/shoots").then(r => r.ok ? r.json() : []).then(setPendingShoots);
    fetch("/api/admin/registrations").then(r => r.ok ? r.json() : { registrations: [] }).then(d => setRegistrations(d.registrations || []));
    fetch("/api/admin/notification-acks?source_type=pending_shoot").then(r => r.ok ? r.json() : { ackedIds: [] }).then(d => setPendingAcked(new Set(d.ackedIds || [])));
    fetch("/api/admin/notification-acks?source_type=new_registration").then(r => r.ok ? r.json() : { ackedIds: [] }).then(d => setRegAcked(new Set(d.ackedIds || [])));
  }, [checked, loadTodos, loadShoots]);

  async function ackPendingShoot(id: string) {
    setPendingAcked(prev => new Set(prev).add(id));
    await fetch("/api/admin/notification-acks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType: "pending_shoot", sourceId: id }),
    });
  }
  async function ackRegistration(id: string) {
    setRegAcked(prev => new Set(prev).add(id));
    await fetch("/api/admin/notification-acks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType: "new_registration", sourceId: id }),
    });
  }
  async function quickConfirmShoot(id: string) {
    setConfirmingShoot(id);
    const res = await fetch("/api/admin/confirm-booking", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shootId: id }),
    });
    setConfirmingShoot(null);
    if (res.ok) {
      await ackPendingShoot(id);
      setPendingShoots(prev => prev.filter(s => s.id !== id));
    }
  }

  // Auto-refresh the shoot board every 30s while it's the active view, matching the live board page
  useEffect(() => {
    if (!checked || middleView !== "board") return;
    const id = setInterval(loadShoots, 30000);
    return () => clearInterval(id);
  }, [checked, middleView, loadShoots]);

  // Header fade cycle every 15s
  useEffect(() => {
    const id = setInterval(() => setHeaderFlip(f => !f), 15000);
    return () => clearInterval(id);
  }, []);

  // Arrow keys: left/right = swipe pages; up/down = context-aware
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setSwipePage(0);
      if (e.key === "ArrowRight") setSwipePage(1);
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        setSwipePage(page => {
          if (page === 0) {
            setMiddleView(v => v === "schedule" ? "board" : "schedule");
          } else {
            // cycle selected app on apps page
            setSelectedAppLabel(cur => {
              const visible = appOrder.map(l => APPS.find(a => a.label === l)).filter((a): a is typeof APPS[0] => !!a && !hiddenApps.has(a.label));
              if (visible.length === 0) return cur;
              const idx = visible.findIndex(a => a.label === (cur ?? visible[0].label));
              const next = e.key === "ArrowDown"
                ? visible[Math.min(visible.length - 1, idx + 1)].label
                : visible[Math.max(0, idx - 1)].label;
              return next;
            });
          }
          return page;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hiddenApps, appOrder]);

  async function completeTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
    await fetch("/api/admin/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", id }),
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
  const nowMs = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
  const boardShoots = shoots.filter(s => {
    if (s.status === "cancelled") return false;
    // Paid shoots fall off the board after 7 days
    if (s.status === "completed") {
      return !!s.paid_at && nowMs - new Date(s.paid_at).getTime() < SEVEN_DAYS_MS;
    }
    return true;
  });
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
      className="fixed inset-0 overflow-hidden bg-black flex flex-col"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; }}
      onTouchEnd={e => {
        const dx = touchStartX.current !== null ? e.changedTouches[0].clientX - touchStartX.current : 0;
        const dy = touchStartY.current !== null ? e.changedTouches[0].clientY - touchStartY.current : 0;
        touchStartX.current = null;
        touchStartY.current = null;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
          setSwipePage(dx < 0 ? 1 : 0);
        } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50 && swipePage === 0) {
          setMiddleView(v => v === "schedule" ? "board" : "schedule");
        }
      }}
    >
      {/* Shared header — stays fixed while pages slide */}
      <header className="relative z-10 flex items-center justify-between px-4 md:px-8 py-4 md:py-5 shrink-0">
        <a href="/" className="text-[clamp(24px,4vw,40px)] font-black tracking-tight uppercase hover:opacity-70 transition-opacity whitespace-nowrap leading-none">Luck Images</a>
        <div className="flex items-center gap-3">
          {swipePage === 1 && (
            editMode ? (
              <>
                <button onClick={() => setEditMode(false)} className="text-xs tracking-[3px] uppercase text-white/40 hover:text-white transition-colors border border-white/20 px-4 py-2 hover:border-white/50">Cancel</button>
                <button onClick={saveLayout} className="text-xs tracking-[3px] uppercase text-black bg-white px-4 py-2 hover:bg-white/90 transition-colors font-semibold">Save</button>
              </>
            ) : (
              <button onClick={openEditMode} className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors border border-white/20 px-4 py-2 hover:border-white/50">Edit</button>
            )
          )}
          <a href="/choose-portal" className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors border border-white/20 px-4 py-2 hover:border-white/50">Portals</a>
          <button
            onClick={() => {
              const form = document.createElement("form");
              form.method = "post"; form.action = "/api/auth/signout";
              document.body.appendChild(form); form.submit();
            }}
            className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors border border-white/20 px-4 py-2 hover:border-white/50">
            Log Out
          </button>
        </div>
      </header>

      {/* Dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-50">
        {[0, 1].map(i => (
          <button key={i} onClick={() => setSwipePage(i)} className={`w-2 h-2 rounded-full transition-all duration-300 ${swipePage === i ? "bg-white scale-125" : "bg-white/25 hover:bg-white/50"}`} />
        ))}
      </div>

      {/* Sliding track — two pages side by side */}
      <div
        className="flex flex-1 min-h-0 transition-transform duration-300 ease-out"
        style={{ width: "200vw", transform: `translateX(${swipePage === 0 ? 0 : -50}%)` }}
      >

      {/* PAGE 1 — Dashboard */}
      <div className="w-screen h-full flex-shrink-0">
    <main className="relative h-full bg-black text-white flex flex-col overflow-hidden">

      {/* Centered content column — matches the classic dashboard's max-w container */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col max-w-7xl mx-auto w-full px-4 md:px-8">

        {/* Fading header — alternates between "Luck Images" and "Welcome Ryan" */}
        <div className="pb-4 shrink-0 relative" style={{ height: "clamp(32px,5vw,52px)" }}>
          <h1 className="absolute inset-0 text-[clamp(24px,4vw,40px)] font-black tracking-tight uppercase leading-none transition-opacity duration-[2000ms]"
            style={{ opacity: headerFlip ? 0 : 1 }}>
            Luck Images
          </h1>
          <h1 className="absolute inset-0 text-[clamp(24px,4vw,40px)] font-black tracking-tight uppercase leading-none transition-opacity duration-[2000ms]"
            style={{ opacity: headerFlip ? 1 : 0 }}>
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
                    <div key={i} className={`flex-1 flex gap-4 px-1 min-h-0 ${isToday ? "bg-white/[0.02]" : ""}`}>
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

        {/* Bottom third: Pending Shoots + New Registrations, side by side */}
        <div className="flex-[1] min-h-0 pb-8 md:pb-10 flex gap-4">
          {/* Pending Shoots */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 border-2 border-white px-4 pt-3">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/20 shrink-0">
              <span className="text-xs tracking-[2px] uppercase text-white/70">📅 Pending Shoots</span>
              <div className="flex items-center gap-2">
                {pendingShoots.filter(s => !pendingAcked.has(s.id)).length > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#fbbf24] text-black rounded-full">
                    {pendingShoots.filter(s => !pendingAcked.has(s.id)).length}
                  </span>
                )}
                <a href="/dashboard/updates" className="text-[10px] text-white/40 hover:text-white/70 transition-colors">View all →</a>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pb-3">
              {pendingShoots.length === 0 ? (
                <p className="text-xs text-white/30 italic py-4">No pending booking requests.</p>
              ) : (
                <div className="flex flex-col divide-y divide-white/10">
                  {pendingShoots.map(s => {
                    const isUnacked = !pendingAcked.has(s.id);
                    return (
                      <div key={s.id} className={`py-2.5 -mx-1 px-1 ${isUnacked ? "bg-[#fbbf24]/[0.06]" : ""}`}>
                        <div className="flex gap-2.5 items-start">
                          {isUnacked && <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 bg-[#fbbf24]" />}
                          <div className="min-w-0 flex-1">
                            <a href={`/dashboard/v2?page=apps&app=Updates&shoot=${s.id}`} className="block hover:opacity-80 transition-opacity">
                              <p className="text-sm text-white/90 truncate">{s.address}</p>
                              <p className="text-[10px] text-white/40 mt-0.5">
                                {s.client_name || "Unknown"}
                                {s.scheduled_at ? ` · ${new Date(s.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                                {s.drive_minutes != null ? ` · 🚗 ${s.drive_minutes}m` : ""}
                              </p>
                            </a>
                            <div className="flex items-center gap-3 mt-1.5">
                              <button onClick={() => quickConfirmShoot(s.id)} disabled={confirmingShoot === s.id}
                                className="text-[10px] tracking-[1px] uppercase font-bold text-black bg-[#4ade80] hover:bg-[#34d399] px-2.5 py-1 transition-colors disabled:opacity-40">
                                {confirmingShoot === s.id ? "Confirming…" : "Confirm & Notify"}
                              </button>
                              {isUnacked && (
                                <button onClick={() => ackPendingShoot(s.id)} className="text-[10px] text-white/40 hover:text-white/70 transition-colors">
                                  Acknowledge
                                </button>
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

          {/* New Registrations */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 border-2 border-white px-4 pt-3">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/20 shrink-0">
              <span className="text-xs tracking-[2px] uppercase text-white/70">👤 New Registrations</span>
              <div className="flex items-center gap-2">
                {registrations.filter(r => !regAcked.has(r.id)).length > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#34d399] text-black rounded-full">
                    {registrations.filter(r => !regAcked.has(r.id)).length}
                  </span>
                )}
                <a href="/dashboard/updates" className="text-[10px] text-white/40 hover:text-white/70 transition-colors">View all →</a>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pb-3">
              {registrations.length === 0 ? (
                <p className="text-xs text-white/30 italic py-4">No portal registrations yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-white/10">
                  {registrations.slice(0, 20).map(r => {
                    const isUnacked = !regAcked.has(r.id);
                    return (
                      <a key={r.id} href={`/admin/contacts/${r.id}`} onClick={() => isUnacked && ackRegistration(r.id)}
                        className={`flex gap-2.5 items-start py-2.5 hover:bg-white/5 transition-colors -mx-1 px-1 ${isUnacked ? "bg-[#34d399]/[0.06]" : ""}`}>
                        {isUnacked && <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 bg-[#34d399]" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white/90 truncate">{r.name}</p>
                          <p className="text-[10px] text-white/40 mt-0.5">
                            {r.email} · {new Date(r.registered_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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

      {/* PAGE 2 — Apps */}
      <div className="w-screen h-full flex-shrink-0 bg-black flex flex-col overflow-hidden">
        {editMode && (
          <p className="text-center text-[10px] tracking-[2px] uppercase text-white/30 pb-2 shrink-0">Drag to reorder · tap eye to hide</p>
        )}

        {/* MOBILE: 4×2 grid (or edit mode on any screen) */}
        <div className={`${editMode ? "flex" : "flex md:hidden"} flex-1 items-center justify-center p-4 min-h-0`}>
          <div className="w-full border border-white/20 gap-px bg-white/10 grid grid-cols-2">
            {(editMode ? editOrder : appOrder).map((label, i) => {
              const app = APPS.find(a => a.label === label);
              if (!app) return null;
              const isHidden = editMode ? editHidden.has(label) : hiddenApps.has(label);
              if (!editMode && isHidden) return null;
              return editMode ? (
                <div key={label} draggable onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)} onDragEnd={onDragEnd}
                  className={`bg-black flex flex-col items-center justify-center gap-3 p-5 cursor-grab active:cursor-grabbing relative transition-opacity ${isHidden ? "opacity-30" : "opacity-100"}`}>
                  <APP_ICON name={app.label} color={app.color} />
                  <span className="text-[9px] tracking-[2px] uppercase text-white/50 text-center leading-tight">{app.label}</span>
                  <button onClick={() => toggleHide(label)} className="absolute top-2 right-2 text-white/30 hover:text-white transition-colors">
                    {isHidden
                      ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={1.5}/></svg>
                      : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              ) : (
                <a key={label} href={app.href} className="bg-black flex flex-col items-center justify-center gap-3 p-5 hover:bg-white/5 active:bg-white/10 transition-colors group">
                  <APP_ICON name={app.label} color={app.color} />
                  <span className="text-[9px] tracking-[2px] uppercase text-white/50 group-hover:text-white transition-colors text-center leading-tight">{app.label}</span>
                </a>
              );
            })}
          </div>
        </div>

        {/* DESKTOP: sidebar + iframe */}
        {!editMode && (() => {
          const visibleApps = appOrder.map(l => APPS.find(a => a.label === l)).filter((a): a is typeof APPS[0] => !!a && !hiddenApps.has(a.label));
          const activeLabel = selectedAppLabel && visibleApps.find(a => a.label === selectedAppLabel) ? selectedAppLabel : visibleApps[0]?.label ?? null;
          const activeApp = visibleApps.find(a => a.label === activeLabel) ?? null;
          return (
            <div className="hidden md:flex flex-1 min-h-0">
              {/* Sidebar */}
              <div className="w-20 flex flex-col justify-center border-r border-white/10 overflow-y-auto shrink-0">
                {visibleApps.map(app => {
                  const isActive = app.label === activeLabel;
                  return (
                    <button key={app.label} onClick={() => setSelectedAppLabel(app.label)}
                      className={`flex flex-col items-center justify-center gap-1.5 py-4 px-1 transition-all border-l-2 ${isActive ? "border-white bg-white/5" : "border-transparent hover:bg-white/[0.03] hover:border-white/20"}`}>
                      <APP_ICON name={app.label} color={isActive ? "#fff" : "#555"} />
                      <span className={`text-[7px] tracking-[1.5px] uppercase text-center leading-tight transition-colors ${isActive ? "text-white" : "text-white/30"}`}>{app.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* App panel */}
              <div className="flex-1 min-w-0 relative">
                {activeApp ? (
                  <iframe
                    key={activeApp.href}
                    src={activeApp.label === "Updates" && deepLinkShootId ? `${activeApp.href}?shoot=${deepLinkShootId}` : activeApp.href}
                    className="w-full h-full border-0 bg-[#0c0c0c]"
                    title={activeApp.label}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs tracking-[3px] uppercase text-white/20">Select an app</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>{/* end page 2 */}

      </div>{/* end sliding track */}
    </div>
  );
}

export default function DashboardV2PageWrapper() {
  return (
    <Suspense>
      <DashboardV2Page />
    </Suspense>
  );
}
