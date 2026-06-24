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
  status: string;
  photographer_ids: string[];
  price: number | null;
  package_name: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-[#4ade80] bg-[#4ade80]/10",
  scheduled: "text-[#60a5fa] bg-[#60a5fa]/10",
  pending: "text-[#fbbf24] bg-[#fbbf24]/10",
  cancelled: "text-[#555] bg-white/5",
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

export default function MasterShootListPage() {
  const router = useRouter();
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [editShoot, setEditShoot] = useState<Shoot | null>(null);
  const [editForm, setEditForm] = useState({ price: "", package_name: "", notes: "", status: "" });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const loadShoots = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/shoots?full=1");
    if (res.ok) setShoots(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
      else loadShoots();
    });
  }, [router, loadShoots]);

  const filtered = shoots.filter(s => {
    const matchSearch = !search ||
      s.address.toLowerCase().includes(search.toLowerCase()) ||
      s.client_name.toLowerCase().includes(search.toLowerCase()) ||
      s.client_email.toLowerCase().includes(search.toLowerCase()) ||
      (s.package_name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    const matchMonth = !filterMonth || (s.scheduled_at || "").startsWith(filterMonth);
    return matchSearch && matchStatus && matchMonth;
  }).sort((a, b) => new Date(b.scheduled_at || 0).getTime() - new Date(a.scheduled_at || 0).getTime());

  // Stats
  const totalRevenue = shoots.filter(s => s.status === "completed" && s.price).reduce((sum, s) => sum + (s.price || 0), 0);
  const completedCount = shoots.filter(s => s.status === "completed").length;
  const avgPrice = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthRevenue = shoots.filter(s => s.scheduled_at?.startsWith(thisMonth) && s.price).reduce((sum, s) => sum + (s.price || 0), 0);

  // Month list for calendar view
  const allMonths = [...new Set(shoots.map(s => s.scheduled_at?.slice(0, 7)).filter(Boolean) as string[])].sort().reverse();

  const months = filterMonth ? [filterMonth] : allMonths;

  // Available months for filter
  const availableMonths = [...new Set(shoots.map(s => s.scheduled_at?.slice(0, 7)).filter(Boolean) as string[])].sort().reverse();

  function openEdit(shoot: Shoot) {
    setEditShoot(shoot);
    setEditForm({
      price: shoot.price != null ? String(shoot.price) : "",
      package_name: shoot.package_name || "",
      notes: shoot.notes || "",
      status: shoot.status,
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editShoot) return;
    setSaving(true);
    await fetch("/api/admin/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editShoot.id,
        status: editForm.status,
        price: editForm.price ? Number(editForm.price) : null,
        package_name: editForm.package_name || null,
      }),
    });
    // Update notes directly via supabase
    if (editForm.notes !== editShoot.notes) {
      const supabase = createClient();
      await supabase.from("shoots").update({ notes: editForm.notes || null }).eq("id", editShoot.id);
    }
    setSaving(false);
    setEditShoot(null);
    await loadShoots();
  }

  async function syncSheet() {
    setSyncing(true);
    setSyncMsg("");
    const res = await fetch("/api/admin/sync-shoots-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "manual" }),
    });
    const data = await res.json();
    if (data.ok) setSyncMsg(`✓ Synced ${data.rows} rows at ${data.syncedAt}`);
    else setSyncMsg(`✗ ${data.error}`);
    setSyncing(false);
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function formatMonthHeading(ym: string) {
    const [y, m] = ym.split("-");
    const date = new Date(Number(y), Number(m) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  const shootsByMonth = (monthKey: string) =>
    filtered.filter(s => (s.scheduled_at || "").startsWith(monthKey))
      .sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime());

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">

      {/* Header */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-[#555] text-sm hover:text-white transition-colors">← Dashboard</button>
          <h1 className="text-sm font-bold tracking-[3px] uppercase">Master Shoot List</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={syncSheet}
            disabled={syncing}
            className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all disabled:opacity-40"
          >
            {syncing ? "Syncing..." : "↑ Sync to Google Sheet"}
          </button>
          <div className="flex border border-white/10 overflow-hidden">
            <button onClick={() => setViewMode("list")}
              className={`text-xs tracking-[1px] uppercase px-4 py-2 transition-colors ${viewMode === "list" ? "bg-white text-black font-bold" : "text-[#555] hover:text-white"}`}>
              List
            </button>
            <button onClick={() => setViewMode("calendar")}
              className={`text-xs tracking-[1px] uppercase px-4 py-2 transition-colors ${viewMode === "calendar" ? "bg-white text-black font-bold" : "text-[#555] hover:text-white"}`}>
              By Month
            </button>
          </div>
        </div>
      </div>

      {syncMsg && (
        <div className={`px-4 md:px-8 py-2 text-xs font-medium ${syncMsg.startsWith("✓") ? "bg-[#4ade80]/10 text-[#4ade80]" : "bg-red-900/20 text-red-400"}`}>
          {syncMsg}
        </div>
      )}

      {/* Stats bar */}
      <div className="border-b border-white/10 bg-[#0e0e0e] px-4 md:px-8 py-3 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums">{shoots.length}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">total shoots</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#4ade80]">{completedCount}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">completed</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#4ade80]">${totalRevenue.toLocaleString()}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">total revenue</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#fbbf24]">${thisMonthRevenue.toLocaleString()}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">this month</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums">${avgPrice.toLocaleString()}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">avg / shoot</span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 md:px-8 py-4 flex items-center gap-3 flex-wrap border-b border-white/5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search address, client, package..."
          className="flex-1 min-w-[200px] bg-[#111] border border-white/10 text-white text-xs px-4 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#111] border border-white/10 text-xs text-[#888] px-3 py-2.5 outline-none focus:border-white/30">
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="scheduled">Scheduled</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="bg-[#111] border border-white/10 text-xs text-[#888] px-3 py-2.5 outline-none focus:border-white/30">
          <option value="">All months</option>
          {availableMonths.map(m => (
            <option key={m} value={m}>{formatMonthHeading(m)}</option>
          ))}
        </select>
        {(search || filterStatus !== "all" || filterMonth) && (
          <button onClick={() => { setSearch(""); setFilterStatus("all"); setFilterMonth(""); }}
            className="text-xs text-[#555] hover:text-white transition-colors">Clear</button>
        )}
        <span className="text-xs text-[#444] ml-auto">{filtered.length} shoots</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-xs text-[#444] tracking-[3px] uppercase">Loading...</div>
      ) : viewMode === "list" ? (

        /* ══ LIST VIEW ══ */
        <div className="px-4 md:px-8 py-4">
          <div className="border border-white/10 overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-white/10 text-[#444] tracking-[1px] uppercase">
                  <th className="text-left px-4 py-3 font-normal">Date</th>
                  <th className="text-left px-4 py-3 font-normal">Address</th>
                  <th className="text-left px-4 py-3 font-normal">Client</th>
                  <th className="text-left px-4 py-3 font-normal">Package</th>
                  <th className="text-left px-4 py-3 font-normal">Services</th>
                  <th className="text-left px-4 py-3 font-normal">Price</th>
                  <th className="text-left px-4 py-3 font-normal">Status</th>
                  <th className="text-left px-4 py-3 font-normal w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-[#333] italic">No shoots found</td></tr>
                ) : filtered.map(shoot => (
                  <tr key={shoot.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3 text-[#666] whitespace-nowrap">
                      {shoot.scheduled_at
                        ? new Date(shoot.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="font-medium truncate">{shoot.address}</p>
                      {shoot.notes && <p className="text-[#444] truncate mt-0.5">{shoot.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-[#666] whitespace-nowrap">{shoot.client_name || shoot.client_email || "—"}</td>
                    <td className="px-4 py-3 text-[#888]">{shoot.package_name || "—"}</td>
                    <td className="px-4 py-3 text-[#555] max-w-[160px]">
                      <p className="truncate">{shoot.services?.join(", ") || "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#4ade80]">
                      {shoot.price != null ? `$${shoot.price.toLocaleString()}` : <span className="text-[#333]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase ${STATUS_COLORS[shoot.status] || "text-[#555] bg-white/5"}`}>
                        {shoot.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(shoot)}
                        className="text-[10px] text-[#444] hover:text-white transition-colors uppercase tracking-[1px] opacity-0 group-hover:opacity-100">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      ) : (

        /* ══ CALENDAR / BY MONTH VIEW ══ */
        <div className="px-4 md:px-8 py-6 space-y-8">
          {months.length === 0 && (
            <p className="text-xs text-[#333] italic text-center py-12">No shoots found.</p>
          )}
          {months.map(monthKey => {
            const monthShoots = shootsByMonth(monthKey);
            if (monthShoots.length === 0) return null;
            const monthRevenue = monthShoots.filter(s => s.price).reduce((sum, s) => sum + (s.price || 0), 0);
            const completedInMonth = monthShoots.filter(s => s.status === "completed").length;
            return (
              <div key={monthKey}>
                {/* Month header */}
                <div className="flex items-baseline justify-between gap-4 mb-4">
                  <div className="flex items-baseline gap-4">
                    <h2 className="font-bold tracking-tight">{formatMonthHeading(monthKey)}</h2>
                    <span className="text-xs text-[#555]">{monthShoots.length} shoot{monthShoots.length !== 1 ? "s" : ""}</span>
                    <span className="text-xs text-[#555]">{completedInMonth} completed</span>
                  </div>
                  {monthRevenue > 0 && (
                    <span className="text-sm font-bold text-[#4ade80]">${monthRevenue.toLocaleString()}</span>
                  )}
                </div>

                {/* Days */}
                <div className="space-y-0 border border-white/10">
                  {monthShoots.map((shoot, i) => {
                    const d = shoot.scheduled_at ? new Date(shoot.scheduled_at) : null;
                    return (
                      <div key={shoot.id}
                        className={`flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02] cursor-pointer transition-colors ${i < monthShoots.length - 1 ? "border-b border-white/5" : ""}`}
                        onClick={() => openEdit(shoot)}
                      >
                        {/* Day number */}
                        <div className="shrink-0 w-10 text-center">
                          {d ? (
                            <>
                              <p className="text-2xl font-black tabular-nums leading-none">{d.getDate()}</p>
                              <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">
                                {d.toLocaleDateString("en-US", { weekday: "short" })}
                              </p>
                            </>
                          ) : (
                            <p className="text-[#333] text-xs">TBD</p>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="font-medium text-sm truncate">{shoot.address}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold tracking-wide uppercase shrink-0 ${STATUS_COLORS[shoot.status] || "text-[#555] bg-white/5"}`}>
                              {shoot.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {shoot.client_name && <span className="text-xs text-[#555]">{shoot.client_name}</span>}
                            {shoot.package_name && <span className="text-xs text-[#444]">{shoot.package_name}</span>}
                            {!shoot.package_name && shoot.services?.length > 0 && (
                              <span className="text-xs text-[#444]">{shoot.services.join(", ")}</span>
                            )}
                            {shoot.notes && <span className="text-xs text-[#333] italic">"{shoot.notes}"</span>}
                          </div>
                        </div>

                        {/* Price */}
                        <div className="shrink-0 text-right">
                          {shoot.price != null
                            ? <p className="font-bold text-[#4ade80]">${shoot.price.toLocaleString()}</p>
                            : <p className="text-[#333] text-xs">No price</p>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editShoot && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => setEditShoot(null)}>
          <div className="bg-[#111] border border-white/15 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-xs font-bold tracking-[3px] uppercase">Edit Shoot</p>
                <p className="text-sm mt-1 text-[#888] truncate max-w-[280px]">{editShoot.address}</p>
                <p className="text-xs text-[#444] mt-0.5">{formatDate(editShoot.scheduled_at)}</p>
              </div>
              <button onClick={() => setEditShoot(null)} className="text-[#555] hover:text-white text-lg leading-none">✕</button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Package</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PACKAGES.map(pkg => (
                    <button
                      key={pkg.label}
                      type="button"
                      onClick={() => {
                        setEditForm(f => ({
                          ...f,
                          package_name: pkg.label === f.package_name ? "" : pkg.label,
                          price: pkg.price && pkg.label !== f.package_name ? String(pkg.price) : f.price,
                        }));
                      }}
                      className={`text-xs px-3 py-1.5 border transition-all ${editForm.package_name === pkg.label ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white"}`}
                    >
                      {pkg.label}{pkg.price ? ` · $${pkg.price}` : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Price (Official / QuickBooks)</p>
                <div className="flex items-center bg-[#181818] border border-white/10">
                  <span className="text-xs text-[#555] px-3">$</span>
                  <input
                    type="number"
                    value={editForm.price}
                    onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0"
                    className="flex-1 bg-transparent text-white text-sm px-2 py-2.5 outline-none"
                  />
                </div>
                <p className="text-[10px] text-[#444] mt-1">This is the amount that appears in QuickBooks</p>
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
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Notes</p>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 resize-none placeholder:text-[#333]"
                />
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
