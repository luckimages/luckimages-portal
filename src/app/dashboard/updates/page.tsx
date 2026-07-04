"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

type UpdateItem = {
  id: string;
  type: string;
  category: string;
  message: string;
  created_at: string;
  by?: string;
  link?: string;
};

const CATS = [
  { key: "alerts",    label: "Alerts",    dot: "bg-red-500",    text: "text-red-400",    ring: "border-red-500/30" },
  { key: "shoots",    label: "Shoots",    dot: "bg-[#60a5fa]",  text: "text-[#60a5fa]",  ring: "border-[#60a5fa]/30" },
  { key: "clients",   label: "Clients",   dot: "bg-[#fbbf24]",  text: "text-[#fbbf24]",  ring: "border-[#fbbf24]/30" },
  { key: "marketing", label: "Marketing", dot: "bg-[#f472b6]",  text: "text-[#f472b6]",  ring: "border-[#f472b6]/30" },
  { key: "finance",   label: "Finance",   dot: "bg-[#4ade80]",  text: "text-[#4ade80]",  ring: "border-[#4ade80]/30" },
  { key: "team",      label: "Team",      dot: "bg-[#fb923c]",  text: "text-[#fb923c]",  ring: "border-[#fb923c]/30" },
  { key: "nocturne",  label: "Nocturne",  dot: "bg-[#a78bfa]",  text: "text-[#a78bfa]",  ring: "border-[#a78bfa]/30" },
];

const CAT_MAP = Object.fromEntries(CATS.map(c => [c.key, c]));
const ALL_KEYS = new Set(CATS.map(c => c.key));
const READ_KEY = "notif_read_ids";

function getReadIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); }
  catch { return new Set(); }
}
function markRead(id: string) {
  const ids = getReadIds();
  ids.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}
function markAllReadLocal(ids: string[]) {
  localStorage.setItem(READ_KEY, JSON.stringify(ids));
}

function toDateStr(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(ALL_KEYS));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [updateInput, setUpdateInput] = useState("");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calFilter, setCalFilter] = useState<string | null>(null);

  useEffect(() => {
    setReadIds(getReadIds());
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/company-updates?history=1");
    if (res.ok) {
      const { posts, auto } = await res.json();
      const all: UpdateItem[] = [...posts, ...auto].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setUpdates(all);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleCat(key: string) {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.size === CATS.length) return new Set([key]);
      if (next.has(key) && next.size === 1) return new Set(ALL_KEYS);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleExpand(id: string) {
    setExpandedId(prev => {
      const next = prev === id ? null : id;
      if (next) {
        markRead(id);
        setReadIds(getReadIds());
      }
      return next;
    });
  }

  function handleMarkAllRead() {
    const ids = updates.map(u => u.id);
    markAllReadLocal(ids);
    setReadIds(new Set(ids));
  }

  async function postUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!updateInput.trim()) return;
    await fetch("/api/admin/company-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: updateInput.trim() }),
    });
    setUpdateInput("");
    load();
  }

  // Calendar helpers
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateStr(new Date().toISOString());

  // Build a map of date → notifications for the calendar
  const dateDotMap: Record<string, { dot: string }[]> = {};
  for (const u of updates) {
    const d = toDateStr(u.created_at);
    if (!dateDotMap[d]) dateDotMap[d] = [];
    const cat = CAT_MAP[u.category || "nocturne"];
    if (cat && !dateDotMap[d].find(x => x.dot === cat.dot)) {
      dateDotMap[d].push({ dot: cat.dot });
    }
  }

  const filtered = updates.filter(u => {
    if (!activeCategories.has(u.category || "nocturne")) return false;
    if (calFilter && toDateStr(u.created_at) !== calFilter) return false;
    return true;
  });

  const unreadCount = updates.filter(u => !readIds.has(u.id)).length;

  const monthLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">


      <div className="flex-1 px-4 md:px-8 py-8 max-w-7xl mx-auto w-full">
        {/* Page header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-1">Command Center</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">Notification Center</h1>
          </div>
          <div className="flex items-center gap-4">
            {unreadCount > 0 && (
              <>
                <span className="text-sm font-bold px-2 py-1 bg-red-500 text-white">{unreadCount} unread</span>
                <button onClick={handleMarkAllRead} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-3 py-1.5">
                  Mark all read
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-8 items-start">

          {/* ── LEFT: Calendar ── */}
          <div className="w-64 shrink-0 sticky top-8">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} className="text-[#555] hover:text-white transition-colors px-1">‹</button>
              <span className="text-xs tracking-[2px] uppercase text-[#888]">{monthLabel}</span>
              <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} className="text-[#555] hover:text-white transition-colors px-1">›</button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map(d => (
                <div key={d} className="text-[9px] tracking-[1px] uppercase text-[#333] text-center py-1">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dots = dateDotMap[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isSelected = calFilter === dateStr;
                const hasEvents = dots.length > 0;
                return (
                  <button
                    key={day}
                    onClick={() => setCalFilter(isSelected ? null : dateStr)}
                    className={`flex flex-col items-center py-1.5 rounded-sm transition-colors ${
                      isSelected ? "bg-white/10" : hasEvents ? "hover:bg-white/5" : "cursor-default"
                    }`}
                  >
                    <span className={`text-xs leading-none mb-1 ${
                      isToday ? "text-white font-bold" : isSelected ? "text-white" : hasEvents ? "text-[#888]" : "text-[#2a2a2a]"
                    }`}>{day}</span>
                    {dots.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap justify-center max-w-[20px]">
                        {dots.slice(0, 3).map((d, idx) => (
                          <span key={idx} className={`w-1 h-1 rounded-full ${d.dot}`} />
                        ))}
                      </div>
                    )}
                    {dots.length === 0 && <span className="w-1 h-1" />}
                  </button>
                );
              })}
            </div>

            {/* Active date label */}
            {calFilter && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] tracking-[1px] uppercase text-[#555]">
                  {new Date(calFilter + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <button onClick={() => setCalFilter(null)} className="text-[9px] tracking-[1px] uppercase text-[#444] hover:text-white transition-colors">Clear</button>
              </div>
            )}

            {/* Category filters */}
            <div className="mt-6 space-y-1">
              <p className="text-[9px] tracking-[2px] uppercase text-[#333] mb-2">Filter</p>
              <button
                onClick={() => setActiveCategories(new Set(ALL_KEYS))}
                className={`w-full text-left text-xs px-2 py-1.5 flex items-center gap-2 transition-colors ${activeCategories.size === CATS.length ? "text-white" : "text-[#444] hover:text-[#666]"}`}
              >
                <span className="w-2 h-2 rounded-full bg-white/20" />
                All
              </button>
              {CATS.map(cat => {
                const isActive = activeCategories.has(cat.key);
                const count = updates.filter(u => (u.category || "nocturne") === cat.key).length;
                if (count === 0) return null;
                return (
                  <button key={cat.key} onClick={() => toggleCat(cat.key)}
                    className={`w-full text-left text-xs px-2 py-1.5 flex items-center justify-between gap-2 transition-colors ${isActive ? "text-[#888]" : "text-[#333] hover:text-[#555]"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isActive ? cat.dot : "bg-white/10"}`} />
                      {cat.label}
                    </div>
                    <span className="text-[10px] text-[#333]">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT: Feed ── */}
          <div className="flex-1 min-w-0">
            {/* Feed */}
            <div className="bg-[#111] border border-white/10 divide-y divide-white/5">
              {loading && (
                <div className="py-20 text-center">
                  <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-xs text-[#333]">
                    {calFilter ? "No notifications on this date." : "No notifications in this category."}
                  </p>
                </div>
              )}
              {!loading && filtered.map(u => {
                const isUnread = !readIds.has(u.id);
                const cat = CAT_MAP[u.category || "nocturne"] || CAT_MAP.nocturne;
                const isAlert = u.category === "alerts";
                const parts = u.message.split("\n---\n");
                const headline = parts[0].trim();
                const details = parts[1];
                const isExpanded = expandedId === u.id;
                const timeStr = new Date(u.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                  + " · " + new Date(u.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

                // Parse a Go-to link from details if present
                const goLinks: Record<string, string> = {
                  "Email Outreach Center": "/dashboard/outreach",
                  "Shoot Board": "/dashboard/board",
                  "Command Center": "/dashboard",
                };
                const goLink = u.link || Object.entries(goLinks).find(([k]) => headline.includes(k))?.[1];

                return (
                  <div key={u.id} className={`${isAlert ? "bg-red-500/5" : ""}`}>
                    {/* Row — always visible */}
                    <button
                      className={`w-full text-left px-5 py-4 flex gap-3 items-start transition-colors hover:bg-white/[0.02] ${details ? "cursor-pointer" : "cursor-default"}`}
                      onClick={() => details && handleExpand(u.id)}
                    >
                      <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                        <span className={`w-2 h-2 rounded-full ${cat.dot} ${isAlert ? "animate-pulse" : ""}`} />
                        {isUnread && <span className="w-1 h-1 rounded-full bg-[#a78bfa]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <p className={`text-sm leading-snug font-medium ${isUnread ? "text-white" : "text-[#555]"}`}>{headline}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] px-1.5 py-0.5 border border-white/5 ${cat.text} whitespace-nowrap`}>{cat.label}</span>
                            {details && <span className="text-[10px] text-[#333]">{isExpanded ? "▲" : "▼"}</span>}
                          </div>
                        </div>
                        <p className="text-[11px] text-[#333] mt-0.5">
                          {timeStr}
                          {u.by ? ` · ${u.by}` : ""}
                        </p>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {details && isExpanded && (
                      <div className={`px-8 pb-5 pt-3 border-t border-white/5 bg-white/[0.015] space-y-2`}>
                        {details.split("\n").filter(Boolean).map((line, i) => (
                          <p key={i} className="text-xs text-[#777] leading-relaxed">{line}</p>
                        ))}
                        {goLink && (
                          <a href={goLink}
                            className={`inline-flex items-center gap-1.5 mt-3 text-xs tracking-[1px] uppercase px-4 py-2 border ${cat.ring} ${cat.text} hover:bg-white/5 transition-colors`}>
                            View {headline.split(" —")[0].split(" ").slice(0, 3).join(" ")} →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Post update */}
            <form onSubmit={postUpdate} className="border border-t-0 border-white/10 flex">
              <input
                value={updateInput}
                onChange={e => setUpdateInput(e.target.value)}
                placeholder="Post an update for the team..."
                className="flex-1 bg-[#111] text-sm px-5 py-3 outline-none placeholder:text-[#333] text-white"
              />
              <button type="submit" className="px-5 py-3 text-[#555] hover:text-white transition-colors border-l border-white/10 bg-[#111]">→</button>
            </form>
          </div>

        </div>
      </div>
    </main>
  );
}
