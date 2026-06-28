"use client";

import { useEffect, useState, useCallback } from "react";

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
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

const STAGES: { key: string; label: string; color: string; dim: string }[] = [
  { key: "pending",   label: "Pending",   color: "text-[#fbbf24]", dim: "border-[#fbbf24]/20 bg-[#fbbf24]/5"  },
  { key: "scheduled", label: "Scheduled", color: "text-[#60a5fa]", dim: "border-[#60a5fa]/20 bg-[#60a5fa]/5"  },
  { key: "en_route",  label: "En Route",  color: "text-[#a78bfa]", dim: "border-[#a78bfa]/20 bg-[#a78bfa]/5"  },
  { key: "on_site",   label: "On Site",   color: "text-[#f472b6]", dim: "border-[#f472b6]/20 bg-[#f472b6]/5"  },
  { key: "wrapping",  label: "Wrapping",  color: "text-[#fb923c]", dim: "border-[#fb923c]/20 bg-[#fb923c]/5"  },
  { key: "editing",   label: "Editing",   color: "text-[#facc15]", dim: "border-[#facc15]/20 bg-[#facc15]/5"  },
  { key: "delivered", label: "Delivered", color: "text-[#34d399]", dim: "border-[#34d399]/20 bg-[#34d399]/5"  },
  { key: "completed", label: "Completed", color: "text-[#4ade80]", dim: "border-[#4ade80]/20 bg-[#4ade80]/5"  },
];

function isBehindSchedule(shoot: Shoot): boolean {
  if (!shoot.scheduled_at) return false;
  const earlyStages = ["pending", "scheduled"];
  if (!earlyStages.includes(shoot.status)) return false;
  return new Date(shoot.scheduled_at) < new Date();
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

function ShootCard({ shoot }: { shoot: Shoot }) {
  const behind = isBehindSchedule(shoot);
  const mins = behind ? minutesBehind(shoot) : 0;
  const stage = STAGES.find(s => s.key === shoot.status);

  return (
    <div className={`border rounded-sm p-3 flex flex-col gap-1.5 ${behind ? "border-red-500/40 bg-red-500/5" : "border-white/8 bg-white/[0.02]"}`}>
      {/* Behind schedule warning */}
      {behind && (
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-[10px] text-red-400 font-semibold tracking-wide">
            {mins < 60 ? `${mins}m behind` : `${Math.floor(mins / 60)}h ${mins % 60}m behind`}
          </span>
        </div>
      )}

      {/* Client + time */}
      <div>
        <p className="text-xs font-semibold text-white truncate">{shoot.client_name || shoot.client_email || "Client"}</p>
        {shoot.scheduled_at && (
          <p className={`text-[10px] mt-0.5 ${behind ? "text-red-400" : "text-[#555]"}`}>{fmtScheduled(shoot.scheduled_at)}</p>
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

export default function BoardPage() {
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);

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

  function toggleCol(key: string) {
    setExpandedCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const activeStages = STAGES.filter(s => s.key !== "completed");
  const completedStage = STAGES.find(s => s.key === "completed")!;

  const behindCount = shoots.filter(isBehindSchedule).length;
  const activeCount = shoots.filter(s => s.status !== "completed").length;

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

          {/* Active stages board */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${activeStages.length}, minmax(0, 1fr))` }}>

            {activeStages.map(stage => {
              const stageShots = shoots.filter(s => s.status === stage.key);
              const behindInStage = stageShots.filter(isBehindSchedule);
              const isExpanded = expandedCols.has(stage.key);

              return (
                <div key={stage.key} className="flex flex-col gap-2">

                  {/* Column header */}
                  <div className={`border rounded-sm px-3 py-2.5 ${stageShots.length > 0 ? stage.dim : "border-white/5 bg-transparent"}`}>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[10px] tracking-[2px] uppercase font-semibold ${stageShots.length > 0 ? stage.color : "text-[#333]"}`}>
                        {stage.label}
                      </span>
                      {behindInStage.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                      )}
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <p className={`text-3xl font-black tabular-nums leading-none ${stageShots.length > 0 ? stage.color : "text-[#222]"}`}>
                        {stageShots.length}
                      </p>
                      {stageShots.length > 0 && (
                        <button
                          onClick={() => toggleCol(stage.key)}
                          className="text-[10px] text-[#555] hover:text-white transition-colors whitespace-nowrap pb-0.5"
                        >
                          {isExpanded ? "Hide ▲" : "View all ▼"}
                        </button>
                      )}
                    </div>
                    {behindInStage.length > 0 && (
                      <p className="text-[10px] text-red-400 mt-1">{behindInStage.length} behind</p>
                    )}
                  </div>

                  {/* Expanded cards */}
                  {isExpanded && stageShots.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {/* Sort: behind schedule first, then by time */}
                      {[...stageShots]
                        .sort((a, b) => {
                          const aBehind = isBehindSchedule(a) ? 0 : 1;
                          const bBehind = isBehindSchedule(b) ? 0 : 1;
                          if (aBehind !== bBehind) return aBehind - bBehind;
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

          {/* Completed — collapsible row at the bottom */}
          <div className="mt-6 border-t border-white/5 pt-4">
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-3 text-xs text-[#444] hover:text-[#888] transition-colors"
            >
              <span>{showCompleted ? "▾" : "▸"}</span>
              <span className="tracking-[2px] uppercase">Completed</span>
              <span className={`text-2xl font-black tabular-nums ${completedStage.color}`}>
                {shoots.filter(s => s.status === "completed").length}
              </span>
            </button>

            {showCompleted && (
              <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                {shoots
                  .filter(s => s.status === "completed")
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
