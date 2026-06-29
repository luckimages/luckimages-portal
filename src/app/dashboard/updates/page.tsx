"use client";

import { useEffect, useState } from "react";
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
  { key: "alerts",    label: "Alerts",    dot: "bg-red-500",    text: "text-red-400" },
  { key: "shoots",    label: "Shoots",    dot: "bg-[#60a5fa]",  text: "text-[#60a5fa]" },
  { key: "clients",   label: "Clients",   dot: "bg-[#fbbf24]",  text: "text-[#fbbf24]" },
  { key: "marketing", label: "Marketing", dot: "bg-[#f472b6]",  text: "text-[#f472b6]" },
  { key: "finance",   label: "Finance",   dot: "bg-[#4ade80]",  text: "text-[#4ade80]" },
  { key: "team",      label: "Team",      dot: "bg-[#fb923c]",  text: "text-[#fb923c]" },
  { key: "nocturne",  label: "Nocturne",  dot: "bg-[#a78bfa]",  text: "text-[#a78bfa]" },
];

const CAT_MAP = Object.fromEntries(CATS.map(c => [c.key, c]));
const ALL_KEYS = new Set(CATS.map(c => c.key));

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(ALL_KEYS));
  const [notifReadAt, setNotifReadAt] = useState<Date | null>(null);
  const [updateInput, setUpdateInput] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.notif_read_at) {
        setNotifReadAt(new Date(user.user_metadata.notif_read_at));
      }
      const res = await fetch("/api/admin/company-updates?history=1");
      if (res.ok) {
        const { posts, auto } = await res.json();
        const all: UpdateItem[] = [...posts, ...auto].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setUpdates(all);
      }
      setLoading(false);
    }
    load();
  }, []);

  function toggleCat(key: string) {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.size === CATS.length) return new Set([key]);
      if (next.has(key) && next.size === 1) return new Set(ALL_KEYS);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    await supabase.auth.updateUser({ data: { notif_read_at: now } });
    setNotifReadAt(new Date(now));
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
    const res = await fetch("/api/admin/company-updates?history=1");
    if (res.ok) {
      const { posts, auto } = await res.json();
      const all = [...posts, ...auto].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setUpdates(all);
    }
  }

  const filtered = updates.filter(u => activeCategories.has(u.category || "nocturne"));
  const unreadCount = notifReadAt
    ? updates.filter(u => new Date(u.created_at) > notifReadAt).length
    : updates.length;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10 gap-4">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Dashboard</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 py-8 md:py-12 max-w-4xl mx-auto w-full">
        {/* Page header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-1">Command Center</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">Notification Center</h1>
          </div>
          <div className="flex items-center gap-4">
            {unreadCount > 0 && (
              <>
                <span className="text-sm font-bold px-2 py-1 rounded-full bg-red-500 text-white">{unreadCount} unread</span>
                <button onClick={markAllRead} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-3 py-1.5">
                  Mark all read
                </button>
              </>
            )}
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveCategories(new Set(ALL_KEYS))}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold tracking-wide transition-all ${
              activeCategories.size === CATS.length
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/10 bg-transparent text-[#444] hover:text-[#666]"
            }`}
          >
            All
          </button>
          {CATS.map(cat => {
            const isActive = activeCategories.has(cat.key);
            const count = updates.filter(u => (u.category || "nocturne") === cat.key).length;
            return (
              <button
                key={cat.key}
                onClick={() => toggleCat(cat.key)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/5 bg-transparent text-[#444] hover:text-[#666]"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? cat.dot : "bg-[#333]"}`} />
                {cat.label}
                {count > 0 && (
                  <span className={`text-[10px] ${isActive ? "text-white/60" : "text-[#333]"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feed */}
        <div className="bg-[#111] border border-white/10 divide-y divide-white/5">
          {loading && (
            <div className="py-20 text-center">
              <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-xs text-[#333]">No notifications in this category.</p>
            </div>
          )}
          {!loading && filtered.map(u => {
            const isUnread = notifReadAt ? new Date(u.created_at) > notifReadAt : true;
            const cat = CAT_MAP[u.category || "nocturne"] || CAT_MAP.nocturne;
            const isAlert = u.category === "alerts";
            const content = (
              <div className={`px-5 py-4 hover:bg-white/[0.02] transition-colors flex gap-3 items-start ${isAlert ? "bg-red-500/5" : ""} ${isUnread ? "" : "opacity-45"}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${cat.dot} ${isAlert ? "animate-pulse" : ""}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <p className={`text-sm leading-snug ${isUnread ? "text-white" : "text-[#666]"}`}>{u.message}</p>
                    <span className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded border border-white/5 ${cat.text} whitespace-nowrap`}>{cat.label}</span>
                  </div>
                  <p className="text-[11px] text-[#444] mt-1">
                    {new Date(u.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    {" · "}
                    {new Date(u.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {u.by ? ` · ${u.by}` : ""}
                    {isUnread && <span className="ml-2 text-[#a78bfa]">● new</span>}
                  </p>
                </div>
                {u.link && <span className={`text-xs shrink-0 mt-1 ${cat.text}`}>→</span>}
              </div>
            );
            return u.link
              ? <a key={u.id} href={u.link}>{content}</a>
              : <div key={u.id}>{content}</div>;
          })}
        </div>

        {/* Post update */}
        <form onSubmit={postUpdate} className="border border-t-0 border-white/10 flex">
          <input
            value={updateInput}
            onChange={e => setUpdateInput(e.target.value)}
            placeholder="Post an update for Leif..."
            className="flex-1 bg-[#111] text-sm px-5 py-3 outline-none placeholder:text-[#333] text-white"
          />
          <button type="submit" className="px-5 py-3 text-[#555] hover:text-white transition-colors border-l border-white/10 bg-[#111]">→</button>
        </form>
      </div>
    </main>
  );
}
