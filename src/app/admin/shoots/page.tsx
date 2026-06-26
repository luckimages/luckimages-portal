"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  services: string[];
  notes: string | null;
  square_footage: number | null;
  client_id: string | null;
  client_name: string;
  client_email: string;
  contact_id: string | null;
  contact_name: string | null;
  status: string;
  photographer_ids: string[];
  price: number | null;
  package_name: string | null;
};

type Contact = { id: string; name: string; brokerage: string | null };

const TRACKER_STAGES = [
  { key: "scheduled", label: "Scheduled" },
  { key: "en_route",  label: "En Route" },
  { key: "on_site",   label: "On Site" },
  { key: "wrapping",  label: "Wrapped Up" },
  { key: "delivered", label: "Delivered" },
];
const TRACKER_ORDER = ["pending", "scheduled", "en_route", "on_site", "wrapping", "editing", "delivered", "completed"];

function ShootTracker({ status }: { status: string }) {
  const cur = TRACKER_ORDER.indexOf(status);
  return (
    <div className="flex items-start gap-0 mt-2">
      {TRACKER_STAGES.map((stage, i) => {
        const idx = TRACKER_ORDER.indexOf(stage.key);
        const effectiveIdx = status === "editing" ? TRACKER_ORDER.indexOf("editing") : cur;
        const isDone = effectiveIdx > idx || status === "completed";
        const isActive = !isDone && (effectiveIdx === idx || (stage.key === "wrapping" && status === "editing"));
        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isDone ? "bg-[#4ade80]" : isActive ? "bg-white" : "bg-white/15"}`} />
              <span className={`text-[8px] tracking-[1px] uppercase whitespace-nowrap ${isActive ? "text-white" : isDone ? "text-[#4ade80]/70" : "text-[#333]"}`}>{stage.label}</span>
            </div>
            {i < TRACKER_STAGES.length - 1 && (
              <div className={`w-8 h-px mb-3.5 ${isDone ? "bg-[#4ade80]/30" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-[#4ade80] bg-[#4ade80]/10",
  scheduled: "text-[#60a5fa] bg-[#60a5fa]/10",
  pending: "text-[#fbbf24] bg-[#fbbf24]/10",
  cancelled: "text-[#555] bg-white/5",
  en_route: "text-[#a78bfa] bg-[#a78bfa]/10",
  on_site: "text-[#f472b6] bg-[#f472b6]/10",
  wrapping: "text-[#fb923c] bg-[#fb923c]/10",
  editing: "text-[#fb923c] bg-[#fb923c]/10",
  delivered: "text-[#4ade80] bg-[#4ade80]/5",
};

const PACKAGES = [
  { label: "Photos Only", price: 175 },
  { label: "Drone Only", price: 200 },
  { label: "Photo + Drone", price: 325 },
  { label: "Video", price: 250 },
  { label: "Matterport", price: 225 },
  { label: "Twilight", price: 250 },
  { label: "Full Package", price: 750 },
  { label: "Custom", price: 0 },
];

const SERVICE_BUCKETS = [
  { label: "Listing Photos", match: (p: string) => /photo/i.test(p) },
  { label: "Drone", match: (p: string) => /drone/i.test(p) },
  { label: "Matterport", match: (p: string) => /matterport/i.test(p) },
  { label: "Video", match: (p: string) => /video/i.test(p) },
  { label: "Twilight", match: (p: string) => /twilight/i.test(p) },
  { label: "Full Package", match: (p: string) => /full/i.test(p) },
  { label: "Custom", match: (p: string) => /custom/i.test(p) },
];

export default function ShootsPage() {
  const router = useRouter();
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "month">("cards");
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Edit modal
  const [editShoot, setEditShoot] = useState<Shoot | null>(null);
  const [editForm, setEditForm] = useState({ price: "", package_name: "", notes: "", status: "" });
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState<Record<string, string>>({});

  const loadShoots = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const res = await fetch("/api/admin/shoots?full=1");
    if (res.ok) {
      const raw = await res.json();
      const contactIds = [...new Set(raw.map((s: Shoot) => s.contact_id).filter(Boolean))] as string[];
      let contactMap: Record<string, string> = {};
      if (contactIds.length > 0) {
        const { data } = await supabase.from("contacts").select("id, name").in("id", contactIds);
        for (const c of data || []) contactMap[c.id] = c.name;
      }
      setShoots(raw.map((s: Shoot) => ({ ...s, contact_name: s.contact_id ? contactMap[s.contact_id] || null : null })));
    }
    const { data: c } = await supabase.from("contacts").select("id, name, brokerage").order("name");
    setContacts(c || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
      else loadShoots();
    });
  }, [router, loadShoots]);

  // Stats
  const thisYear = new Date().getFullYear().toString();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const completedShoots = shoots.filter(s => s.status === "completed");
  const totalRevenue = completedShoots.filter(s => s.price).reduce((sum, s) => sum + (s.price || 0), 0);
  const avgPrice = completedShoots.length > 0 ? Math.round(totalRevenue / completedShoots.length) : 0;
  const thisMonthRevenue = shoots.filter(s => s.scheduled_at?.startsWith(thisMonth) && s.price).reduce((sum, s) => sum + (s.price || 0), 0);
  const thisMonthCount = shoots.filter(s => s.scheduled_at?.startsWith(thisMonth) && s.status !== "cancelled").length;
  const ytdShoots = completedShoots.filter(s => (s.scheduled_at || "").startsWith(thisYear));
  const serviceCounts = SERVICE_BUCKETS.map(b => ({
    label: b.label,
    count: ytdShoots.filter(s => {
      const pkg = s.package_name || s.services?.join(" ") || "";
      return b.match(pkg);
    }).length,
  }));

  // Filtering
  const filtered = shoots.filter(s => {
    const name = s.contact_name || s.client_name || s.client_email || "";
    const matchSearch = !search ||
      s.address.toLowerCase().includes(search.toLowerCase()) ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      (s.package_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.services || []).some(sv => sv.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    const matchMonth = !filterMonth || (s.scheduled_at || "").startsWith(filterMonth);
    return matchSearch && matchStatus && matchMonth;
  }).sort((a, b) => new Date(b.scheduled_at || 0).getTime() - new Date(a.scheduled_at || 0).getTime());

  const availableMonths = [...new Set(shoots.map(s => s.scheduled_at?.slice(0, 7)).filter(Boolean) as string[])].sort().reverse();

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
      " · " + new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function formatMonthHeading(ym: string) {
    const [y, m] = ym.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function openEdit(shoot: Shoot) {
    setEditShoot(shoot);
    setEditForm({ price: shoot.price != null ? String(shoot.price) : "", package_name: shoot.package_name || "", notes: shoot.notes || "", status: shoot.status });
    setEditContactId(shoot.contact_id || null);
    setEditContactName(shoot.contact_name || shoot.client_name || "");
    setContactSearch("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editShoot) return;
    setSaving(true);
    const supabase = createClient();
    await fetch("/api/admin/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editShoot.id,
        status: editForm.status,
        price: editForm.price ? Number(editForm.price) : null,
        package_name: editForm.package_name || null,
        contact_id: editContactId,
        notes: editForm.notes || null,
      }),
    });
    setSaving(false);
    setEditShoot(null);
    await loadShoots();
  }

  async function quickStatus(id: string, status: string) {
    setStatusError(e => ({ ...e, [id]: "" }));
    const res = await fetch("/api/admin/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      const d = await res.json();
      setStatusError(e => ({ ...e, [id]: d.error || "Failed" }));
      return;
    }
    setShoots(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }

  async function syncSheet() {
    setSyncing(true); setSyncMsg("");
    const res = await fetch("/api/admin/sync-shoots-sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger: "manual" }) });
    const data = await res.json();
    setSyncMsg(data.ok ? `✓ Synced ${data.rows} rows at ${data.syncedAt}` : `✗ ${data.error}`);
    setSyncing(false);
  }

  // Card component
  function ShootCard({ shoot }: { shoot: Shoot }) {
    const [expanded, setExpanded] = useState(false);
    const clientDisplay = shoot.contact_name || shoot.client_name || shoot.client_email || null;
    const err = statusError[shoot.id];
    return (
      <div className={`bg-[#111] border border-white/10 hover:border-white/20 transition-colors ${shoot.status === "pending" ? "border-l-2 border-l-[#fbbf24]/50" : ""}`}>
        <div className="flex items-start justify-between gap-4 p-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{shoot.address}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {shoot.scheduled_at && (
                <span className="text-xs text-[#888]">{formatDate(shoot.scheduled_at)}</span>
              )}
              {clientDisplay && <span className="text-xs text-[#666]">{clientDisplay}</span>}
              {shoot.price != null && (
                <span className="text-xs font-bold text-[#4ade80]">${shoot.price.toLocaleString()}</span>
              )}
            </div>
            {(shoot.package_name || (shoot.services?.length > 0)) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(shoot.package_name ? [shoot.package_name] : shoot.services).map(svc => (
                  <span key={svc} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-white/5 border border-white/10 text-[#888]">{svc}</span>
                ))}
              </div>
            )}
            {!["pending", "cancelled"].includes(shoot.status) && (
              <ShootTracker status={shoot.status} />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] tracking-[2px] uppercase px-2 py-1 ${STATUS_COLORS[shoot.status] || "text-[#555] bg-white/5"}`}>{shoot.status}</span>
            <button onClick={() => openEdit(shoot)} className="text-[10px] uppercase tracking-[1px] text-[#444] hover:text-white transition-colors px-2">Edit</button>
            <button onClick={() => setExpanded(e => !e)} className="text-[#555] hover:text-white text-xs transition-colors px-1">{expanded ? "▲" : "▼"}</button>
          </div>
        </div>
        {expanded && (
          <div className="px-4 pb-4 pt-0 border-t border-white/5 space-y-3 mt-0">
            {shoot.notes && <p className="text-xs text-[#888] mt-3">{shoot.notes}</p>}
            {shoot.square_footage && <p className="text-xs text-[#555]">{shoot.square_footage.toLocaleString()} sq ft</p>}
            <div className="flex gap-2 flex-wrap mt-3">
              {shoot.status === "pending" && (
                <button onClick={() => quickStatus(shoot.id, "scheduled")}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 bg-[#4ade80]/10 border border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/20 transition-colors">
                  Confirm
                </button>
              )}
              {(shoot.status === "pending" || shoot.status === "scheduled") && (
                <>
                  <button onClick={() => quickStatus(shoot.id, "completed")}
                    className="text-xs tracking-[1px] uppercase px-4 py-2 bg-white/5 border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">
                    Mark Complete
                  </button>
                  <button onClick={() => quickStatus(shoot.id, "cancelled")}
                    className="text-xs tracking-[1px] uppercase px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
                    Cancel
                  </button>
                </>
              )}
              {shoot.status === "completed" && (
                <button onClick={() => quickStatus(shoot.id, "scheduled")}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/20 transition-colors">
                  ↩ Undo Complete
                </button>
              )}
              {shoot.status === "cancelled" && (
                <button onClick={() => quickStatus(shoot.id, "scheduled")}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 bg-white/5 border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">
                  ↩ Reopen
                </button>
              )}
            </div>
            {err && <p className="text-xs text-red-400">{err}</p>}
          </div>
        )}
      </div>
    );
  }


  const allMonths = [...new Set(filtered.map(s => s.scheduled_at?.slice(0, 7)).filter(Boolean) as string[])].sort().reverse();

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">

      {/* Header */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center gap-4 flex-wrap">
        <button onClick={() => router.push("/dashboard")} className="text-[#555] text-sm hover:text-white transition-colors">← Dashboard</button>
        <h1 className="text-sm font-bold tracking-[3px] uppercase">Shoots</h1>
        <div className="flex-1" />
        <button onClick={syncSheet} disabled={syncing}
          className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all disabled:opacity-40">
          {syncing ? "Syncing..." : "↑ Sync to Google Sheet"}
        </button>
        <div className="flex border border-white/10 overflow-hidden">
          <button onClick={() => setViewMode("cards")}
            className={`text-xs tracking-[1px] uppercase px-4 py-2 transition-colors ${viewMode === "cards" ? "bg-white text-black font-bold" : "text-[#555] hover:text-white"}`}>
            List
          </button>
          <button onClick={() => setViewMode("month")}
            className={`text-xs tracking-[1px] uppercase px-4 py-2 transition-colors ${viewMode === "month" ? "bg-white text-black font-bold" : "text-[#555] hover:text-white"}`}>
            By Month
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`px-4 md:px-8 py-2 text-xs font-medium ${syncMsg.startsWith("✓") ? "bg-[#4ade80]/10 text-[#4ade80]" : "bg-red-900/20 text-red-400"}`}>
          {syncMsg}
        </div>
      )}

      {/* Stats bar */}
      <div className="border-b border-white/10 bg-[#0e0e0e] px-4 md:px-8 py-3 flex items-center justify-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums">{shoots.length}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">total shoots</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#4ade80]">{completedShoots.length}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">completed</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#4ade80]">${totalRevenue.toLocaleString()}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">total revenue</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#fbbf24]">{thisMonthCount}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">this month</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#fbbf24]">${thisMonthRevenue.toLocaleString()}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">revenue this month</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums">${avgPrice.toLocaleString()}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">avg / shoot</span>
        </div>
      </div>

      {/* Services YTD */}
      <div className="border-b border-white/10 bg-[#0e0e0e] px-4 md:px-8 py-3 flex items-center justify-center gap-1 flex-wrap">
        <span className="text-[10px] tracking-[2px] uppercase text-[#444] mr-3">Services YTD</span>
        {serviceCounts.map((b, i) => (
          <span key={b.label} className="flex items-center gap-1">
            {i > 0 && <span className="w-px h-3 bg-white/10 mx-1" />}
            <span className="text-sm font-bold tabular-nums">{b.count}</span>
            <span className="text-[10px] tracking-[1px] uppercase text-[#555]">{b.label}</span>
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="px-4 md:px-8 py-4 flex items-center gap-3 flex-wrap border-b border-white/5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search address, client, package..."
          className="flex-1 min-w-[200px] bg-[#111] border border-white/10 text-white text-xs px-4 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#111] border border-white/10 text-xs text-[#888] px-3 py-2.5 outline-none focus:border-white/30">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="scheduled">Scheduled</option>
          <option value="en_route">En Route</option>
          <option value="on_site">On Site</option>
          <option value="wrapping">Wrapped Up</option>
          <option value="editing">Editing</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="bg-[#111] border border-white/10 text-xs text-[#888] px-3 py-2.5 outline-none focus:border-white/30">
          <option value="">All months</option>
          {availableMonths.map(m => <option key={m} value={m}>{formatMonthHeading(m)}</option>)}
        </select>
        {(search || filterStatus !== "all" || filterMonth) && (
          <button onClick={() => { setSearch(""); setFilterStatus("all"); setFilterMonth(""); }}
            className="text-xs text-[#555] hover:text-white transition-colors">Clear</button>
        )}
        <span className="text-xs text-[#444] ml-auto">{filtered.length} shoots</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-xs text-[#444] tracking-[3px] uppercase">Loading...</div>
      ) : viewMode === "cards" ? (

        /* ══ LIST VIEW — chronological ══ */
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xs text-[#444] tracking-[3px] uppercase">No shoots found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...filtered]
                .sort((a, b) => {
                  if (!a.scheduled_at && !b.scheduled_at) return 0;
                  if (!a.scheduled_at) return 1;
                  if (!b.scheduled_at) return -1;
                  return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
                })
                .map(s => <ShootCard key={s.id} shoot={s} />)}
            </div>
          )}
        </div>

      ) : (() => {
        /* ══ CALENDAR VIEW ══ */
        const { year, month } = calMonth;
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        // Monday-based grid
        const startOffset = (firstDay.getDay() + 6) % 7;
        const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
        const cells = Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          return dayNum >= 1 && dayNum <= lastDay.getDate() ? dayNum : null;
        });
        const today = new Date();
        const monthLabel = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
        const monthShoots = shoots.filter(s => s.scheduled_at?.startsWith(monthStr));
        const monthRevenue = monthShoots.reduce((sum, s) => sum + (s.price || 0), 0);
        const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

        function prevMonth() {
          setCalMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
        }
        function nextMonth() {
          setCalMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
        }

        return (
          <div className="px-4 md:px-8 py-6">
            {/* Calendar nav */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button onClick={prevMonth} className="text-[#555] hover:text-white transition-colors text-lg px-1">‹</button>
                <h2 className="text-sm font-bold tracking-[3px] uppercase">{monthLabel}</h2>
                <button onClick={nextMonth} className="text-[#555] hover:text-white transition-colors text-lg px-1">›</button>
                {(year !== today.getFullYear() || month !== today.getMonth()) && (
                  <button onClick={() => setCalMonth({ year: today.getFullYear(), month: today.getMonth() })}
                    className="text-xs tracking-[1px] uppercase text-[#444] hover:text-white transition-colors">Today</button>
                )}
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-xs text-[#555]">{monthShoots.length} shoot{monthShoots.length !== 1 ? "s" : ""}</p>
                  {monthRevenue > 0 && <p className="text-sm font-bold text-[#4ade80]">${monthRevenue.toLocaleString()}</p>}
                </div>
              </div>
            </div>

            {/* Day header */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-[10px] tracking-[2px] uppercase text-[#444] py-2">{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-px bg-white/5">
              {cells.map((dayNum, i) => {
                if (dayNum === null) {
                  return <div key={i} className="bg-[#0c0c0c] min-h-[110px]" />;
                }
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === dayNum;
                const dayEvents = shoots.filter(s => {
                  if (!s.scheduled_at) return false;
                  return new Date(s.scheduled_at).toISOString().split("T")[0] === dateStr;
                });
                return (
                  <div key={i} className={`bg-[#0e0e0e] min-h-[110px] p-2 flex flex-col gap-1 ${isToday ? "ring-1 ring-inset ring-white/20" : ""}`}>
                    <p className={`text-xs font-bold mb-1 ${isToday ? "text-white" : "text-[#444]"}`}>{dayNum}</p>
                    {dayEvents.map(shoot => {
                      const time = new Date(shoot.scheduled_at!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                      const clientDisplay = shoot.contact_name || shoot.client_name || null;
                      return (
                        <button key={shoot.id} onClick={() => openEdit(shoot)}
                          className={`w-full text-left px-1.5 py-1 text-[10px] leading-tight rounded-sm border transition-colors hover:brightness-125 ${
                            shoot.status === "pending"    ? "bg-[#fbbf24]/10 border-[#fbbf24]/20 text-[#fbbf24]" :
                            shoot.status === "completed"  ? "bg-[#4ade80]/10 border-[#4ade80]/20 text-[#4ade80]" :
                            shoot.status === "cancelled"  ? "bg-white/[0.03] border-white/5 text-[#444]" :
                                                           "bg-[#4ade80]/5 border-[#4ade80]/15 text-[#aaa]"
                          }`}>
                          <p className="font-semibold truncate">{clientDisplay || shoot.address.split(",")[0]}</p>
                          <p className="opacity-60 truncate mt-0.5">{time}</p>
                          <p className={`text-[9px] tracking-[1px] uppercase opacity-50 mt-0.5 ${STATUS_COLORS[shoot.status]?.split(" ")[0] || ""}`}>
                            {shoot.status.replace(/_/g, " ")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* TBD shoots this month */}
            {monthShoots.filter(s => !s.scheduled_at).length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-2">No date scheduled</p>
                <div className="flex flex-wrap gap-2">
                  {monthShoots.filter(s => !s.scheduled_at).map(s => (
                    <button key={s.id} onClick={() => openEdit(s)}
                      className="text-xs px-3 py-1.5 bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/20 transition-colors">
                      {s.address.split(",")[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Edit Modal */}
      {editShoot && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => setEditShoot(null)}>
          <div className="bg-[#111] border border-white/15 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-xs font-bold tracking-[3px] uppercase">Edit Shoot</p>
                <p className="text-sm mt-1 text-[#888] truncate max-w-[280px]">{editShoot.address}</p>
                <p className="text-xs text-[#444] mt-0.5">{editShoot.scheduled_at ? formatDate(editShoot.scheduled_at) : "—"}</p>
              </div>
              <button onClick={() => setEditShoot(null)} className="text-[#555] hover:text-white text-lg leading-none">✕</button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Package</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PACKAGES.map(pkg => (
                    <button key={pkg.label} type="button"
                      onClick={() => setEditForm(f => ({ ...f, package_name: pkg.label === f.package_name ? "" : pkg.label, price: pkg.price && pkg.label !== f.package_name ? String(pkg.price) : f.price }))}
                      className={`text-xs px-3 py-1.5 border transition-all ${editForm.package_name === pkg.label ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white"}`}>
                      {pkg.label}{pkg.price ? ` · $${pkg.price}` : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Price</p>
                <div className="flex items-center bg-[#181818] border border-white/10">
                  <span className="text-xs text-[#555] px-3">$</span>
                  <input type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0" className="flex-1 bg-transparent text-white text-sm px-2 py-2.5 outline-none" />
                </div>
              </div>
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Status</p>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30">
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Contact / Client</p>
                {editContactId ? (
                  <div className="flex items-center justify-between bg-[#181818] border border-white/10 px-4 py-2.5">
                    <span className="text-sm text-white">{editContactName}</span>
                    <button type="button" onClick={() => { setEditContactId(null); setEditContactName(""); }}
                      className="text-[#444] hover:text-white text-xs transition-colors">✕ Remove</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Search contacts..."
                      className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    {contactSearch && (
                      <div className="absolute top-full left-0 right-0 bg-[#181818] border border-white/10 border-t-0 max-h-40 overflow-y-auto z-10 divide-y divide-white/5">
                        {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || (c.brokerage || "").toLowerCase().includes(contactSearch.toLowerCase())).slice(0, 6).map(c => (
                          <button key={c.id} type="button"
                            onClick={() => { setEditContactId(c.id); setEditContactName(c.name); setContactSearch(""); }}
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors">
                            <span className="font-medium">{c.name}</span>
                            {c.brokerage && <span className="text-[#555] ml-2">{c.brokerage}</span>}
                          </button>
                        ))}
                        {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).length === 0 && (
                          <p className="px-4 py-2.5 text-xs text-[#444]">No contacts found</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Notes</p>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 resize-none placeholder:text-[#333]" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditShoot(null)}
                  className="flex-1 py-3 text-xs tracking-[1px] uppercase border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 text-xs tracking-[1px] uppercase bg-white text-black font-bold hover:bg-[#ddd] transition-colors disabled:opacity-40">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
