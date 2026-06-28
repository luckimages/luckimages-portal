"use client";

import { useEffect, useState, useCallback } from "react";

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  checked_in_at: string | null;
  status: string;
  client_name: string;
  client_email: string;
  package_name: string | null;
  services: string[];
  price: number | null;
  photographer_ids: string[];
  notes: string | null;
  property_type: string | null;
  square_footage: number | null;
  contact_id: string | null;
};

const STAGES: { key: string; label: string; color: string; dim: string; dbStatuses: string[] }[] = [
  { key: "pending",   label: "Pending",   color: "text-[#fbbf24]", dim: "border-[#fbbf24]/20 bg-[#fbbf24]/5",  dbStatuses: ["pending"] },
  { key: "scheduled", label: "Scheduled", color: "text-[#60a5fa]", dim: "border-[#60a5fa]/20 bg-[#60a5fa]/5",  dbStatuses: ["scheduled"] },
  { key: "active",    label: "Active",    color: "text-[#f472b6]", dim: "border-[#f472b6]/20 bg-[#f472b6]/5",  dbStatuses: ["en_route", "on_site", "wrapping"] },
  { key: "editing",   label: "Editing",   color: "text-[#facc15]", dim: "border-[#facc15]/20 bg-[#facc15]/5",  dbStatuses: ["editing"] },
  { key: "delivered", label: "Delivered", color: "text-[#34d399]", dim: "border-[#34d399]/20 bg-[#34d399]/5",  dbStatuses: ["delivered"] },
  { key: "paid",      label: "Paid",      color: "text-[#4ade80]", dim: "border-[#4ade80]/20 bg-[#4ade80]/5",  dbStatuses: ["completed"] },
];

function stageKey(shoot: Shoot): string {
  for (const s of STAGES) {
    if (s.dbStatuses.includes(shoot.status)) return s.key;
  }
  return "pending";
}

// "no-show"     → scheduled but no check-in 5+ min after shoot time → RED
// "late"        → checked in late (>5 min past scheduled_at) → YELLOW, persists
// "on-time"     → checked in within 5 min → GREEN, persists
// "editing-due" → in editing past 4pm the day after shoot → RED
// null          → no special state (pending/scheduled before time)
type AlertStatus = "no-show" | "late" | "on-time" | "editing-due" | null;

function getAlertStatus(shoot: Shoot): AlertStatus {
  const now = Date.now();
  const scheduledMs = shoot.scheduled_at ? new Date(shoot.scheduled_at).getTime() : null;

  // Editing overdue: not delivered by 4pm day after shoot
  if (shoot.status === "editing" && scheduledMs) {
    const dayAfter = new Date(scheduledMs);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(16, 0, 0, 0);
    if (now > dayAfter.getTime()) return "editing-due";
  }

  // Check-in states
  if (shoot.checked_in_at && scheduledMs) {
    const lateMs = new Date(shoot.checked_in_at).getTime() - scheduledMs;
    return lateMs > 5 * 60 * 1000 ? "late" : "on-time";
  }

  // No check-in yet — are they 5+ min overdue?
  if (!shoot.checked_in_at && shoot.status === "scheduled" && scheduledMs) {
    if (now > scheduledMs + 5 * 60 * 1000) return "no-show";
  }

  return null;
}

function isBehindSchedule(shoot: Shoot): boolean {
  return getAlertStatus(shoot) === "no-show";
}

function minutesBehind(shoot: Shoot): number {
  if (!shoot.scheduled_at) return 0;
  return Math.floor((Date.now() - new Date(shoot.scheduled_at).getTime()) / 60000);
}

function fmtScheduled(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const ALERT_STYLES: Record<string, { border: string; bg: string; dot: string; text: string; label: string }> = {
  "no-show":     { border: "border-red-500/40",    bg: "bg-red-500/5",    dot: "bg-red-500",    text: "text-red-400",    label: "No check-in" },
  "late":        { border: "border-yellow-400/40", bg: "bg-yellow-400/5", dot: "bg-yellow-400", text: "text-yellow-400", label: "Checked in late" },
  "on-time":     { border: "border-green-400/40",  bg: "bg-green-400/5",  dot: "bg-green-400",  text: "text-green-400",  label: "On time" },
  "editing-due": { border: "border-red-500/40",    bg: "bg-red-500/5",    dot: "bg-red-500",    text: "text-red-400",    label: "Delivery overdue" },
};

function ShootCard({ shoot }: { shoot: Shoot }) {
  const alert = getAlertStatus(shoot);
  const style = alert ? ALERT_STYLES[alert] : null;
  const stage = STAGES.find(s => s.dbStatuses.includes(shoot.status));
  const mins = alert === "no-show" ? minutesBehind(shoot) : 0;

  return (
    <div className={`border rounded-sm p-3 flex flex-col gap-1.5 ${style ? `${style.border} ${style.bg}` : "border-white/8 bg-white/[0.02]"}`}>
      {/* Alert badge */}
      {style && (
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot} ${alert === "no-show" || alert === "editing-due" ? "animate-pulse" : ""}`} />
          <span className={`text-[10px] font-semibold tracking-wide ${style.text}`}>
            {alert === "no-show"
              ? `${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`} — no check-in`
              : style.label}
          </span>
        </div>
      )}

      {/* Client + time */}
      <div>
        <p className="text-xs font-semibold text-white truncate">{shoot.client_name || shoot.client_email || "Client"}</p>
        {shoot.scheduled_at && (
          <p className={`text-[10px] mt-0.5 ${alert === "no-show" ? "text-red-400" : "text-[#555]"}`}>{fmtScheduled(shoot.scheduled_at)}</p>
        )}
      </div>

      {/* Address */}
      <p className="text-[10px] text-[#666] truncate leading-snug">{shoot.address}</p>

      {/* Services / package */}
      {(shoot.package_name || shoot.services?.length > 0) && (
        <p className="text-[10px] text-[#444] truncate">
          {shoot.package_name || shoot.services?.slice(0, 2).join(", ")}
          {!shoot.package_name && shoot.services?.length > 2 ? ` +${shoot.services.length - 2}` : ""}
        </p>
      )}

      {/* Price */}
      {shoot.price != null && (
        <p className={`text-xs font-bold mt-0.5 ${stage?.color || "text-white"}`}>${shoot.price.toLocaleString()}</p>
      )}

      {/* View link */}
      <a
        href={`/admin/contacts/${shoot.contact_id}`}
        className="text-[10px] text-[#333] hover:text-white transition-colors mt-0.5 self-start"
        onClick={e => e.stopPropagation()}
      >
        View profile →
      </a>
    </div>
  );
}

// ─── DEMO ONLY — remove this block when done previewing ───────────────────────
const now = new Date();
const minsAgo = (n: number) => new Date(now.getTime() - n * 60000).toISOString();
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000).toISOString();
const yesterday4pm = (() => { const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(10, 0, 0, 0); return d.toISOString(); })();

const DEMO_SHOOTS: Shoot[] = [
  // Scheduled — no-show (RED): scheduled 12 min ago, no check-in
  { id: "demo-1", client_name: "Sarah Mitchell", client_email: "", address: "4210 Maple Grove Dr, Tampa", scheduled_at: minsAgo(12), checked_in_at: null, status: "scheduled", package_name: "Listing Photos + Drone", services: [], price: 275, photographer_ids: [], notes: null, property_type: "Single Family", square_footage: 2400, contact_id: null },
  // Active — late check-in (YELLOW): shoot was 30 min ago, checked in 22 min late
  { id: "demo-2", client_name: "James Kowalski", client_email: "", address: "817 Bayside Blvd, St. Pete", scheduled_at: minsAgo(30), checked_in_at: minsAgo(8), status: "on_site", package_name: "Listing Photos", services: [], price: 195, photographer_ids: [], notes: null, property_type: "Condo", square_footage: 1100, contact_id: null },
  // Active — on-time check-in (GREEN): shoot was 20 min ago, checked in 2 min after
  { id: "demo-3", client_name: "Priya Nair", client_email: "", address: "1502 Osprey Ave, Sarasota", scheduled_at: minsAgo(20), checked_in_at: minsAgo(18), status: "en_route", package_name: "Listing Photos + Matterport", services: [], price: 350, photographer_ids: [], notes: null, property_type: "Single Family", square_footage: 3100, contact_id: null },
  // Editing — overdue (RED): shoot was yesterday, still editing past 4pm
  { id: "demo-4", client_name: "Derek Haines", client_email: "", address: "330 Palm Harbor Pkwy, Clearwater", scheduled_at: yesterday4pm, checked_in_at: hoursAgo(26), status: "editing", package_name: "Listing Photos + Video", services: [], price: 495, photographer_ids: [], notes: null, property_type: "Townhome", square_footage: 1800, contact_id: null },
  // Delivered — late carry (YELLOW): checked in late, now delivered
  { id: "demo-5", client_name: "Tanya Cruz", client_email: "", address: "908 Harbour Island Dr, Tampa", scheduled_at: hoursAgo(48), checked_in_at: hoursAgo(47), status: "delivered", package_name: "Drone Photos", services: [], price: 149, photographer_ids: [], notes: null, property_type: "Waterfront", square_footage: 4200, contact_id: null },
  // Delivered — on-time carry (GREEN)
  { id: "demo-6", client_name: "Marcus Webb", client_email: "", address: "2201 Bayshore Blvd, Tampa", scheduled_at: hoursAgo(36), checked_in_at: new Date(new Date(hoursAgo(36)).getTime() + 3 * 60000).toISOString(), status: "delivered", package_name: "Full Package", services: [], price: 695, photographer_ids: [], notes: null, property_type: "Luxury", square_footage: 5800, contact_id: null },
];
// ──────────────────────────────────────────────────────────────────────────────

export default function BoardPage() {
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showCompleted, setShowCompleted] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/shoots?full=1");
    if (res.ok) {
      const data: Shoot[] = await res.json();
      setShoots([...DEMO_SHOOTS, ...data.filter(s => s.status !== "cancelled")]);
      setLastRefresh(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const paidStage = STAGES.find(s => s.key === "paid")!;
  const activeStages = STAGES.filter(s => s.key !== "paid");

  const behindCount = shoots.filter(s => ["no-show", "editing-due"].includes(getAlertStatus(s) ?? "")).length;
  const activeCount = shoots.filter(s => stageKey(s) !== "paid").length;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 gap-4 shrink-0">
        <div className="flex items-center gap-6">
          <a href="/" className="text-lg font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">← Dashboard</a>
        </div>
        <div className="flex items-center gap-4">
          {behindCount > 0 && (
            <div className="flex items-center gap-2 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold">{behindCount} behind schedule</span>
            </div>
          )}
          <span className="text-[10px] text-[#333]">
            Updated {lastRefresh.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </span>
          <button onClick={load} className="text-xs text-[#444] hover:text-white transition-colors">↻ Refresh</button>
        </div>
      </header>

      {/* Demo banner */}
      <div className="bg-[#fbbf24]/10 border-b border-[#fbbf24]/30 px-6 py-2 flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-black tracking-[2px] uppercase text-[#fbbf24]">Demo Mode</span>
        <span className="text-[10px] text-[#fbbf24]/60">— fake shoot cards are injected for preview only, not in your database</span>
      </div>

      {/* Page title */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">Live</p>
            <h1 className="text-2xl font-black tracking-tight uppercase">Shoot Board</h1>
          </div>
          <span className="text-xs text-[#444]">{activeCount} active shoot{activeCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-6 pb-8">

          {/* Step tracker — dots centered over each column */}
          <div className="grid mb-4 relative" style={{ gridTemplateColumns: `repeat(${activeStages.length}, minmax(0, 1fr))` }}>
            {/* Connecting line behind dots */}
            <div className="absolute top-[5px] left-[calc(100%/(${activeStages.length}*2))] right-[calc(100%/(${activeStages.length}*2))] h-px bg-white/10" style={{ left: `calc(100% / ${activeStages.length * 2})`, right: `calc(100% / ${activeStages.length * 2})` }} />
            {activeStages.map((stage) => {
              const count = shoots.filter(s => stageKey(s) === stage.key).length;
              const hasAlert = shoots.filter(s => stageKey(s) === stage.key).some(s => ["no-show", "editing-due"].includes(getAlertStatus(s) ?? ""));
              return (
                <div key={stage.key} className="flex flex-col items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full border-2 relative z-10 transition-colors ${hasAlert ? "bg-red-500 border-red-500" : count > 0 ? "bg-white border-white" : "bg-[#0c0c0c] border-white/20"}`} />
                  <span className={`text-[9px] tracking-[1.5px] uppercase font-semibold ${count > 0 ? "text-white" : "text-[#333]"}`}>{stage.label}</span>
                </div>
              );
            })}
          </div>

          {/* Active stages board */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${activeStages.length}, minmax(0, 1fr))` }}>

            {activeStages.map(stage => {
              const stageShots = shoots.filter(s => stageKey(s) === stage.key);
              const behindInStage = stageShots.filter(s => ["no-show", "editing-due"].includes(getAlertStatus(s) ?? ""));

              return (
                <div key={stage.key} className="flex flex-col gap-2">

                  {/* Column header — fixed height so all columns align */}
                  <div className="border border-white/8 bg-white/[0.02] rounded-sm px-3 py-3 h-20 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] tracking-[2px] uppercase font-semibold text-[#444]">
                        {stage.label}
                      </span>
                      {behindInStage.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                      )}
                    </div>
                    <div>
                      <p className="text-3xl font-black tabular-nums leading-none text-white">{stageShots.length}</p>
                      {behindInStage.length > 0 && (
                        <p className="text-[10px] text-red-400 mt-0.5">{behindInStage.length} behind</p>
                      )}
                    </div>
                  </div>

                  {/* Cards — always visible on full board */}
                  {stageShots.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {/* Sort: behind schedule first, then by time */}
                      {[...stageShots]
                        .sort((a, b) => {
                          const priority = { "no-show": 0, "editing-due": 0, "late": 1, "on-time": 2, null: 3 } as Record<string, number>;
                          const ap = priority[getAlertStatus(a) ?? "null"] ?? 3;
                          const bp = priority[getAlertStatus(b) ?? "null"] ?? 3;
                          if (ap !== bp) return ap - bp;
                          return (a.scheduled_at || "").localeCompare(b.scheduled_at || "");
                        })
                        .map(shoot => <ShootCard key={shoot.id} shoot={shoot} />)
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Paid — collapsible row at the bottom */}
          <div className="mt-6 border-t border-white/5 pt-4">
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-3 text-xs text-[#444] hover:text-[#888] transition-colors"
            >
              <span>{showCompleted ? "▾" : "▸"}</span>
              <span className="tracking-[2px] uppercase">Paid</span>
              <span className={`text-2xl font-black tabular-nums ${paidStage.color}`}>
                {shoots.filter(s => stageKey(s) === "paid").length}
              </span>
            </button>

            {showCompleted && (
              <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                {shoots
                  .filter(s => stageKey(s) === "paid")
                  .sort((a, b) => (b.scheduled_at || "").localeCompare(a.scheduled_at || ""))
                  .map(shoot => <ShootCard key={shoot.id} shoot={shoot} />)
                }
              </div>
            )}
          </div>

        </div>
      )}
    </main>
  );
}
