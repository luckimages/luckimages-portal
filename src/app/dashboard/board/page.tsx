"use client";

import { useEffect, useState, useCallback } from "react";
import ContactChip from "@/components/ContactChip";

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  checked_in_at: string | null;
  delivered_at: string | null;
  paid_at: string | null;
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
  { key: "delivered", label: "Delivered", color: "text-[#34d399]", dim: "border-[#34d399]/20 bg-[#34d399]/5",  dbStatuses: ["delivered", "completed"] },
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
type AlertStatus = "no-show" | "late" | "on-time" | "editing-due" | "paid" | null;

function getAlertStatus(shoot: Shoot): AlertStatus {
  const now = Date.now();
  const scheduledMs = shoot.scheduled_at ? new Date(shoot.scheduled_at).getTime() : null;

  // Paid: green
  if (shoot.paid_at) return "paid";

  // Payment overdue: delivered 24h+ ago and not paid
  if ((shoot.status === "delivered" || shoot.status === "completed") && shoot.delivered_at) {
    if (now > new Date(shoot.delivered_at).getTime() + 24 * 3600000) return "no-show";
    return null;
  }

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
  "paid":        { border: "border-green-400/40",  bg: "bg-green-400/5",  dot: "bg-green-400",  text: "text-green-400",  label: "Paid" },
  "editing-due": { border: "border-red-500/40",    bg: "bg-red-500/5",    dot: "bg-red-500",    text: "text-red-400",    label: "Delivery overdue" },
};

function ShootCard({ shoot, onClick }: { shoot: Shoot; onClick: () => void }) {
  const alert = getAlertStatus(shoot);
  const style = alert ? ALERT_STYLES[alert] : null;
  const stage = STAGES.find(s => s.dbStatuses.includes(shoot.status));
  const mins = alert === "no-show" ? minutesBehind(shoot) : 0;

  return (
    <div
      className={`border rounded-sm p-3 flex flex-col gap-1.5 cursor-pointer hover:brightness-110 transition-all ${style ? `${style.border} ${style.bg}` : "border-white/8 bg-white/[0.02]"}`}
      onClick={onClick}
    >
      {/* Alert badge */}
      {style && (
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot} ${alert === "no-show" || alert === "editing-due" ? "animate-pulse" : ""}`} />
          <span className={`text-[10px] font-semibold tracking-wide ${style.text}`}>
            {alert === "no-show" && ["delivered", "completed"].includes(shoot.status)
              ? "Invoice unpaid"
              : alert === "no-show"
              ? `${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`} — no check-in`
              : style.label}
          </span>
        </div>
      )}

      {/* Client + time */}
      <div>
        <ContactChip contactId={shoot.contact_id} name={shoot.client_name || shoot.client_email || "Client"} size="sm" />
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

      {/* Expand hint */}
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[9px] text-[#333] tracking-wide">click to expand</span>
        {["delivered", "completed"].includes(shoot.status) && !shoot.paid_at && (
          <span className="text-[9px] text-[#4ade80] tracking-wide">unpaid</span>
        )}
      </div>
    </div>
  );
}

function ShootModal({ shoot, onClose, onMarkPaid }: { shoot: Shoot; onClose: () => void; onMarkPaid: (id: string) => void }) {
  const alert = getAlertStatus(shoot);
  const style = alert ? ALERT_STYLES[alert] : null;
  const stage = STAGES.find(s => s.dbStatuses.includes(shoot.status));
  const mins = alert === "no-show" ? minutesBehind(shoot) : 0;
  const [markingPaid, setMarkingPaid] = useState(false);

  async function handleMarkPaid() {
    setMarkingPaid(true);
    await fetch("/api/admin/shoots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: shoot.id, status: "paid" }) });
    onMarkPaid(shoot.id);
    setMarkingPaid(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75" />
      <div
        className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#141414] border ${style ? style.border : "border-white/15"} p-6 space-y-5`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            {style && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${alert === "no-show" || alert === "editing-due" ? "animate-pulse" : ""}`} />
                <span className={`text-[10px] font-semibold tracking-[2px] uppercase ${style.text}`}>
                  {alert === "no-show" && ["delivered", "completed"].includes(shoot.status)
                    ? "Invoice unpaid"
                    : alert === "no-show"
                    ? `${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`} — no check-in`
                    : style.label}
                </span>
              </div>
            )}
            <p className="text-base font-bold leading-snug">{shoot.address}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] tracking-[2px] uppercase font-semibold px-2 py-0.5 border ${stage ? `${stage.color} border-current/20` : "text-[#555] border-white/10"}`}>
                {stage?.label || shoot.status}
              </span>
              {shoot.property_type && (
                <span className="text-[10px] text-[#444] uppercase tracking-wide">{shoot.property_type}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors text-xl leading-none shrink-0">✕</button>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* Client */}
          <div>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Client</p>
            {shoot.contact_id ? (
              <a href={`/admin/contacts/${shoot.contact_id}`} className="font-medium hover:text-[#a78bfa] transition-colors" onClick={e => e.stopPropagation()}>
                {shoot.client_name || "View Profile →"}
              </a>
            ) : (
              <p className="font-medium">{shoot.client_name || "—"}</p>
            )}
            {shoot.client_email && <p className="text-xs text-[#555] mt-0.5">{shoot.client_email}</p>}
          </div>

          {/* Date / time */}
          <div>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Scheduled</p>
            <p className="font-medium">
              {shoot.scheduled_at
                ? new Date(shoot.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                : "No date"}
            </p>
            {shoot.scheduled_at && (
              <p className="text-xs text-[#555] mt-0.5">
                {new Date(shoot.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            )}
          </div>

          {/* Price */}
          {shoot.price != null && (
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Price</p>
              <p className={`text-xl font-black ${stage?.color || "text-white"}`}>${shoot.price.toLocaleString()}</p>
            </div>
          )}

          {/* Sq ft */}
          {shoot.square_footage && (
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Sq Ft</p>
              <p className="font-medium">{shoot.square_footage.toLocaleString()}</p>
            </div>
          )}

          {/* Check-in */}
          {shoot.checked_in_at && (
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Checked In</p>
              <p className="text-sm">
                {new Date(shoot.checked_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          )}

          {/* Delivered */}
          {shoot.delivered_at && (
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Delivered</p>
              <p className="text-sm">
                {new Date(shoot.delivered_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" · "}
                {new Date(shoot.delivered_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          )}

          {/* Paid */}
          {shoot.paid_at && (
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Paid</p>
              <p className="text-sm text-[#4ade80]">
                {new Date(shoot.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          )}
        </div>

        {/* Services */}
        {(shoot.package_name || shoot.services?.length > 0) && (
          <div>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Services</p>
            {shoot.package_name && (
              <p className="text-xs text-[#888] mb-1.5">{shoot.package_name}</p>
            )}
            {shoot.services?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {shoot.services.map((svc: string) => (
                  <span key={svc} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-white/5 border border-white/10 text-[#888]">{svc}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {shoot.notes && (
          <div>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Notes</p>
            <p className="text-xs text-[#888] leading-relaxed">{shoot.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-white/10">
          {shoot.contact_id && (
            <a
              href={`/admin/contacts/${shoot.contact_id}`}
              onClick={e => e.stopPropagation()}
              className="text-xs tracking-[1px] uppercase px-4 py-2 border border-white/20 text-white hover:bg-white/5 transition-colors"
            >
              View Profile →
            </a>
          )}
          {["delivered", "completed"].includes(shoot.status) && !shoot.paid_at && !shoot.id.startsWith("demo-") && (
            <button
              onClick={handleMarkPaid}
              disabled={markingPaid}
              className="text-xs tracking-[1px] uppercase px-4 py-2 border border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/10 transition-colors disabled:opacity-40"
            >
              {markingPaid ? "Marking..." : "Mark Paid ✓"}
            </button>
          )}
          <a
            href="/admin/shoots"
            onClick={e => e.stopPropagation()}
            className="text-xs tracking-[1px] uppercase px-4 py-2 border border-white/10 text-[#555] hover:text-white transition-colors"
          >
            All Shoots
          </a>
        </div>
      </div>
    </div>
  );
}

export default function BoardPage() {
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedShoot, setSelectedShoot] = useState<Shoot | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/shoots?full=1");
    if (res.ok) {
      const data: Shoot[] = await res.json();
      setShoots(data.filter(s => s.status !== "cancelled"));
      setLastRefresh(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const activeStages = STAGES;

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
                          const priority = { "no-show": 0, "editing-due": 0, "late": 1, "on-time": 2, null: 3, "paid": 4 } as Record<string, number>;
                          const ap = priority[getAlertStatus(a) ?? "null"] ?? 3;
                          const bp = priority[getAlertStatus(b) ?? "null"] ?? 3;
                          if (ap !== bp) return ap - bp;
                          return (a.scheduled_at || "").localeCompare(b.scheduled_at || "");
                        })
                        .map(shoot => <ShootCard key={shoot.id} shoot={shoot} onClick={() => setSelectedShoot(shoot)} />)
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>


        </div>
      )}

      {selectedShoot && (
        <ShootModal
          shoot={selectedShoot}
          onClose={() => setSelectedShoot(null)}
          onMarkPaid={id => setShoots(prev => prev.map(s => s.id === id ? { ...s, paid_at: new Date().toISOString(), status: "paid" } : s))}
        />
      )}
    </main>
  );
}
