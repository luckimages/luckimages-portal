"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";
import BlockTimeModal, { type Block } from "@/components/BlockTimeModal";

type Person = "ryan" | "leif";

type MeData = {
  person: Person;
  person_name: string;
  month: string;
  commission_cents: number | null;
  commission_shoots: { shoot_id: string; date: string; address: string; client: string; revenue_cents: number; profit_cents: number; revenue_paid: boolean }[];
  shoots: { id: string; address: string; scheduled_at: string; status: string; price: number | null; package_name: string | null }[];
  mileage: { days: { day: string; effective_miles: number; gas_cost_cents: number; deduction_cents: number }[]; total_miles: number; total_gas_cents: number; total_deduction_cents: number };
  cold_calling: { total_calls: number; by_outcome: Record<string, number>; recent: { id: string; outcome: string; called_at: string }[] };
  sourced_leads_count: number;
  availability: Block[];
  hours: {
    active: { id: string; started_at: string } | null;
    month_seconds: number;
    week_seconds: number;
    entries: { id: string; started_at: string; stopped_at: string | null; duration_seconds: number | null }[];
  };
  wage_floor_cents: number | null;
  payout_cents: number | null;
  pay_period: {
    key: string;
    label: string;
    start: string;
    end: string;
    prev_key: string;
    next_key: string;
    is_current: boolean;
    weeks: { week_start: string; label: string; seconds: number }[];
    total_seconds: number;
    wage_floor_cents: number | null;
    commission_cents: number | null;
    payout_cents: number | null;
  };
  is_leif: boolean;
};

function money(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtHrs(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#fbbf24", scheduled: "#60a5fa", en_route: "#f472b6", on_site: "#f472b6",
  wrapping: "#facc15", editing: "#facc15", delivered: "#34d399", completed: "#4ade80",
};

export default function MyNocturnePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [selfPerson, setSelfPerson] = useState<Person | null>(null);
  const [viewing, setViewing] = useState<Person>("ryan");
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month] = useState(new Date().toISOString().slice(0, 7));
  const [blurred, setBlurred] = useState(true);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [viewBlock, setViewBlock] = useState<Block | null>(null);
  const [clocking, setClocking] = useState(false);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [period, setPeriod] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const email = (data.user?.email || "").toLowerCase();
      if (!data.user || !ADMIN_EMAILS.includes(email)) { router.replace("/dashboard"); return; }
      const self: Person = email === "leif@luckimages.com" ? "leif" : "ryan";
      setSelfPerson(self);
      setViewing(self);
      setChecked(true);
    });
  }, [router]);

  const load = useCallback((person: Person, periodKey?: string | null) => {
    setLoading(true);
    const q = new URLSearchParams({ person, month });
    if (periodKey) q.set("period", periodKey);
    fetch(`/api/me?${q.toString()}`)
      .then(r => r.json())
      .then(d => { setData(d); setPeriod(d.pay_period?.key ?? null); })
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { if (checked) load(viewing, period); }, [checked, viewing, load]); // eslint-disable-line react-hooks/exhaustive-deps

  function goToPeriod(key: string) {
    load(viewing, key);
  }

  useEffect(() => {
    const active = data?.hours.active;
    if (!active) return;
    const startedMs = new Date(active.started_at).getTime();
    const tick = () => setLiveElapsed(Math.floor((Date.now() - startedMs) / 1000));
    const id = setInterval(tick, 1000);
    const t = setTimeout(tick, 0);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [data?.hours.active]);

  async function toggleClock() {
    if (!selfPerson || !data) return;
    setClocking(true);
    if (data.hours.active) {
      const elapsed = Math.floor((Date.now() - new Date(data.hours.active.started_at).getTime()) / 1000);
      await fetch("/api/admin/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", entryId: data.hours.active.id, elapsed }),
      });
    } else {
      await fetch("/api/admin/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", userName: data.person_name }),
      });
    }
    setClocking(false);
    load(viewing, period);
  }

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="text-[10px] tracking-[3px] uppercase text-[#555]">My Nocturne</div>
            <div className="text-2xl font-bold mt-1">{data?.person_name ?? "..."}'s Dashboard</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-white/10">
              {(["ryan", "leif"] as Person[]).map(p => (
                <button
                  key={p}
                  onClick={() => setViewing(p)}
                  className={`px-4 py-2 text-xs tracking-[1px] uppercase transition-colors ${
                    viewing === p ? "bg-white text-black font-bold" : "text-[#555] hover:text-white"
                  }`}
                >
                  {p === "ryan" ? "Ryan" : "Leif"}{selfPerson === p ? " (Me)" : ""}
                </button>
              ))}
            </div>
            <button
              onClick={() => setBlurred(b => !b)}
              className="p-1.5 text-[#555] hover:text-white transition-colors border border-white/10"
              title={blurred ? "Show numbers" : "Hide numbers"}
            >
              {blurred ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {loading && !data && (
          <div className="border border-white/5 px-5 py-10 text-center text-[#444] text-xs tracking-widest uppercase">Loading...</div>
        )}

        {data && (() => { const blur = blurred ? "blur-sm select-none" : ""; return (
          <div className="flex flex-col gap-6">
            {/* Time Clock */}
            <Section title="Time Clock">
              <div className="border border-white/[0.07] px-5 py-5 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-3xl font-bold tabular-nums">
                    {data.hours.active ? fmtHrs(liveElapsed) : fmtHrs(data.hours.week_seconds)}
                  </div>
                  <div className="text-xs text-[#666] mt-1">
                    {data.hours.active ? "Clocked in — running" : "This week"}
                    {" · "}{fmtHrs(data.hours.month_seconds)} this month
                  </div>
                </div>
                {selfPerson === viewing ? (
                  <button
                    onClick={toggleClock}
                    disabled={clocking}
                    className={`px-6 py-3 text-xs tracking-[2px] uppercase font-bold transition-colors disabled:opacity-40 ${
                      data.hours.active ? "bg-[#f87171] text-black hover:bg-[#f87171]/90" : "bg-white text-black hover:bg-white/90"
                    }`}
                  >
                    {clocking ? "..." : data.hours.active ? "Clock Out" : "Clock In"}
                  </button>
                ) : (
                  <span className="text-xs text-[#555] uppercase tracking-wider">{data.hours.active ? "Currently clocked in" : "Not clocked in"}</span>
                )}
              </div>
            </Section>

            {/* Pay period — hours per week, batched for semi-monthly payroll (1st & 15th) */}
            <Section
              title="Pay Period"
              action={
                <div className="flex items-center gap-2">
                  <button onClick={() => goToPeriod(data.pay_period.prev_key)} className="text-[#555] hover:text-white transition-colors px-1" title="Previous period">‹</button>
                  <span className="text-xs text-white min-w-[140px] text-center">{data.pay_period.label}{data.pay_period.is_current ? " · Current" : ""}</span>
                  <button onClick={() => goToPeriod(data.pay_period.next_key)} className="text-[#555] hover:text-white transition-colors px-1" title="Next period">›</button>
                </div>
              }
            >
              <div className="border border-white/[0.07]">
                {data.pay_period.weeks.length === 0 ? (
                  <Empty text="No hours logged this period" />
                ) : (
                  data.pay_period.weeks.map(w => (
                    <div key={w.week_start} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 text-sm">
                      <span className="text-[#888]">{w.label}</span>
                      <span className="tabular-nums font-medium">{fmtHrs(w.seconds)}</span>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03]">
                  <span className="text-xs tracking-[2px] uppercase text-[#555]">Period Total</span>
                  <span className="tabular-nums font-bold">{fmtHrs(data.pay_period.total_seconds)}</span>
                </div>
              </div>

              {data.is_leif && (
                <div className="mt-3 border border-white/[0.07]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/[0.07]">
                    <Stat label="Wage Floor ($7.25/hr)" value={money(data.pay_period.wage_floor_cents)} blur={blur} />
                    <Stat label="Commission Earned" value={money(data.pay_period.commission_cents)} blur={blur} />
                  </div>
                  <div className="px-5 py-4 flex items-center justify-between border-t border-white/[0.07]">
                    <span className="text-xs text-[#666]">Payout — greater of wage floor or commission</span>
                    <span className={`text-xl font-bold text-[#4ade80] transition-all ${blur}`}>{money(data.pay_period.payout_cents)}</span>
                  </div>
                </div>
              )}
            </Section>

            {/* Earnings */}
            <Section title={data.is_leif ? "Commission — This Month" : "Business Profit — This Month"}>
              <div className={`text-4xl font-bold text-[#4ade80] transition-all ${blur}`}>
                {data.is_leif ? money(data.commission_cents) : "—"}
              </div>
              {data.is_leif && (
                <div className="text-xs text-[#666] mt-1">50% of profit on {data.commission_shoots.length} sourced shoot{data.commission_shoots.length === 1 ? "" : "s"} · {data.sourced_leads_count} total leads sourced</div>
              )}
              {!data.is_leif && (
                <div className="text-xs text-[#666] mt-1">Company owner — see <a href="/dashboard/revenue" className="underline hover:text-white">Revenue</a> for full P&L</div>
              )}
              {data.commission_shoots.length > 0 && (
                <div className="mt-4 border border-white/[0.07]">
                  {data.commission_shoots.map(s => (
                    <div key={s.shoot_id} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 text-sm">
                      <div>
                        <span className="text-[#555] mr-3 text-xs">{dateStr(s.date)}</span>
                        {s.address}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`transition-all ${blur} ${s.revenue_paid ? "text-[#4ade80]" : "text-[#fbbf24]"}`}>{money(s.profit_cents / 2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Shoots */}
            <Section title={`My Shoots — ${data.shoots.length} This Month`}>
              {data.shoots.length === 0 ? (
                <Empty text="No shoots this month" />
              ) : (
                <div className="border border-white/[0.07]">
                  {data.shoots.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 text-sm">
                      <div>
                        <span className="text-[#555] mr-3 text-xs">{dateStr(s.scheduled_at)}</span>
                        {s.address}
                      </div>
                      <div className="flex items-center gap-3">
                        {s.price != null && <span className={`text-[#888] transition-all ${blur}`}>{money(s.price * 100)}</span>}
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded" style={{ color: STATUS_COLOR[s.status] || "#888", background: `${STATUS_COLOR[s.status] || "#888"}1a` }}>
                          {s.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Mileage */}
            <Section title="Mileage — This Month">
              <div className="grid grid-cols-3 gap-px bg-white/[0.07] border border-white/[0.07]">
                <Stat label="Miles" value={data.mileage.total_miles.toLocaleString()} />
                <Stat label="Gas Cost" value={money(data.mileage.total_gas_cents)} blur={blur} />
                <Stat label="IRS Deduction" value={money(data.mileage.total_deduction_cents)} blur={blur} />
              </div>
            </Section>

            {/* Cold Calling */}
            <Section title="Cold Calling — This Month">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.07] border border-white/[0.07] mb-3">
                <Stat label="Total Calls" value={String(data.cold_calling.total_calls)} />
                {Object.entries(data.cold_calling.by_outcome).slice(0, 3).map(([k, v]) => (
                  <Stat key={k} label={k.replace(/_/g, " ")} value={String(v)} />
                ))}
              </div>
              {data.cold_calling.total_calls === 0 && <Empty text="No calls logged this month" />}
            </Section>

            {/* Availability */}
            <Section
              title="Upcoming Availability Blocks"
              action={
                selfPerson === viewing ? (
                  <button
                    onClick={() => setShowBlockModal(true)}
                    className="text-[10px] tracking-[1.5px] uppercase px-3 py-1.5 border border-white/20 text-[#555] hover:text-white hover:border-white/40 transition-all"
                  >
                    Block Availability
                  </button>
                ) : null
              }
            >
              {data.availability.length === 0 ? (
                <Empty text="No upcoming blocks — fully available" />
              ) : (
                <div className="border border-white/[0.07]">
                  {data.availability.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setViewBlock(b)}
                      className="w-full flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 text-sm text-left hover:bg-white/[0.02] cursor-pointer"
                    >
                      <div>
                        {b.all_day ? dateStr(b.start_at) : `${dateStr(b.start_at)} ${new Date(b.start_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                        {" – "}
                        {b.all_day ? dateStr(b.end_at) : new Date(b.end_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </div>
                      {b.note && <span className="text-[#666] text-xs">{b.note}</span>}
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </div>
        ); })()}

        {showBlockModal && (
          <BlockTimeModal onClose={() => setShowBlockModal(false)} onSaved={() => { setShowBlockModal(false); load(viewing); }} />
        )}
        {viewBlock && (
          <BlockTimeModal block={viewBlock} onClose={() => setViewBlock(null)} onSaved={() => { setViewBlock(null); load(viewing); }} />
        )}
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] tracking-[2px] uppercase text-[#555]">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, blur }: { label: string; value: string; blur?: string }) {
  return (
    <div className="bg-[#0c0c0c] px-4 py-4">
      <div className={`text-lg font-bold transition-all ${blur ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[#555] mt-0.5">{label}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="border border-white/5 px-5 py-6 text-center text-[#444] text-xs tracking-widest uppercase">{text}</div>;
}
