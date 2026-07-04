"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

type Snapshot = {
  rev_ytd: number;
  rev_month: number;
  expenses_ytd: number;
  net_income: number;
  ytd_invoices: number;
  unpaid_count: number;
  monthly_breakdown: Record<string, number>;
  recent_invoices: { num: string; date: string; paid: boolean; amount: string; client: string }[];
  synced_at: string;
};

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(a: number, b: number) {
  if (!b) return null;
  const diff = ((a - b) / b) * 100;
  return diff;
}

export default function RevenuePage() {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
    });
    fetch("/api/admin/sync-qb", { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSnap(d); });
  }, [router]);

  async function syncNow() {
    setSyncing(true);
    const r = await fetch("/api/admin/sync-qb", { method: "POST" });
    if (r.ok) setSnap(await r.json());
    setSyncing(false);
  }

  if (!snap) return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center">
      <p className="text-xs text-[#555] tracking-[3px] uppercase">Loading...</p>
    </div>
  );

  const months = Object.entries(snap.monthly_breakdown).sort(([a], [b]) => a.localeCompare(b));
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  const lastYearMonthKey = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const thisMonth = snap.monthly_breakdown[thisMonthKey] || 0;
  const lastMonth = snap.monthly_breakdown[lastMonthKey] || 0;
  const sameMonthLastYear = snap.monthly_breakdown[lastYearMonthKey] || 0;
  const avgPerShoot = snap.ytd_invoices > 0 ? Math.round(snap.rev_ytd / snap.ytd_invoices) : 0;

  const momPct = pct(thisMonth, lastMonth);
  const yoyPct = pct(thisMonth, sameMonthLastYear);
  const maxMonth = Math.max(...Object.values(snap.monthly_breakdown), 1);

  const monthNames: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
    "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
    "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
  };

  function DeltaBadge({ val }: { val: number | null }) {
    if (val === null) return <span className="text-[#444] text-xs">—</span>;
    const positive = val >= 0;
    return (
      <span className={`text-xs font-semibold ${positive ? "text-[#4ade80]" : "text-[#f87171]"}`}>
        {positive ? "▲" : "▼"} {Math.abs(val).toFixed(1)}%
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 space-y-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">QuickBooks</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">Revenue</h1>
          </div>
          <div className="flex items-center gap-4">
            {snap.synced_at && (
              <span className="text-[10px] text-[#444] hidden md:block">
                Synced {new Date(snap.synced_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={syncNow}
              disabled={syncing}
              className="text-[10px] tracking-[2px] uppercase border border-white/20 px-3 py-1.5 text-[#666] hover:text-white hover:border-white/50 transition-all disabled:opacity-40"
            >
              {syncing ? "Syncing..." : "↻ Sync QB"}
            </button>
          </div>
        </div>

        {/* Top KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5">
          {[
            { label: "YTD Revenue", value: fmt(snap.rev_ytd) },
            { label: "Net Income YTD", value: fmt(snap.net_income) },
            { label: "YTD Invoices", value: snap.ytd_invoices.toString() },
            { label: "Avg Per Shoot", value: fmt(avgPerShoot) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#0c0c0c] px-5 py-5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">{label}</p>
              <p className="text-2xl font-black tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* This month comparisons */}
        <section>
          <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            {monthNames[thisMonthKey.split("-")[1]]} {now.getFullYear()}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border border-white/5">
            <div className="bg-[#0c0c0c] px-5 py-5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">This Month</p>
              <p className="text-3xl font-black tabular-nums">{fmt(thisMonth)}</p>
            </div>
            <div className="bg-[#0c0c0c] px-5 py-5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-2">vs Last Month ({fmt(lastMonth)})</p>
              <DeltaBadge val={momPct} />
            </div>
            <div className="bg-[#0c0c0c] px-5 py-5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-2">vs Same Month Last Year {sameMonthLastYear ? `(${fmt(sameMonthLastYear)})` : ""}</p>
              {sameMonthLastYear ? <DeltaBadge val={yoyPct} /> : <span className="text-xs text-[#444]">No data</span>}
            </div>
          </div>
        </section>

        {/* Monthly bar chart */}
        <section>
          <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Monthly Breakdown
          </p>
          <div className="bg-[#111] border border-white/5 p-6">
            <div className="flex items-end gap-2 h-40">
              {months.map(([key, val]) => {
                const [, mo] = key.split("-");
                const isThisMonth = key === thisMonthKey;
                const barH = Math.round((val / maxMonth) * 140);
                return (
                  <div key={key} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className={`w-full transition-colors ${isThisMonth ? "bg-white" : "bg-white/20 group-hover:bg-white/40"}`}
                      style={{ height: `${Math.max(barH, 2)}px` }}
                    />
                    {/* tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                      <p className="text-white font-semibold">{fmt(val)}</p>
                      <p className="text-[#555]">{monthNames[mo]} {key.split("-")[0]}</p>
                    </div>
                    <p className={`text-[9px] tracking-wide ${isThisMonth ? "text-white" : "text-[#444]"}`}>{monthNames[mo]}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Expenses */}
        <section>
          <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Expenses YTD
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/5 border border-white/5">
            <div className="bg-[#0c0c0c] px-5 py-5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Total Expenses</p>
              <p className="text-2xl font-black tabular-nums text-[#f87171]">{fmt(snap.expenses_ytd)}</p>
            </div>
            <div className="bg-[#0c0c0c] px-5 py-5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Net Income</p>
              <p className="text-2xl font-black tabular-nums text-[#4ade80]">{fmt(snap.net_income)}</p>
            </div>
            <div className="bg-[#0c0c0c] px-5 py-5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Unpaid Invoices</p>
              <p className="text-2xl font-black tabular-nums text-[#fbbf24]">{snap.unpaid_count}</p>
            </div>
          </div>
        </section>

        {/* Recent invoices */}
        {snap.recent_invoices?.length > 0 && (
          <section>
            <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
              Recent Invoices
            </p>
            <div className="border border-white/5">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-5 py-3 border-b border-white/5">
                <span className="text-[10px] tracking-[1.5px] uppercase text-[#333]">#</span>
                <span className="text-[10px] tracking-[1.5px] uppercase text-[#333]">Client</span>
                <span className="text-[10px] tracking-[1.5px] uppercase text-[#333]">Date</span>
                <span className="text-[10px] tracking-[1.5px] uppercase text-[#333] text-right">Amount</span>
              </div>
              {snap.recent_invoices.map(inv => (
                <div key={inv.num} className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] items-center">
                  <span className="text-xs text-[#555] font-mono">{inv.num}</span>
                  <span className="text-sm text-white truncate">{inv.client}</span>
                  <span className="text-xs text-[#555]">{inv.date}</span>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-sm font-semibold tabular-nums">{inv.amount}</span>
                    <span className={`text-[9px] tracking-[1px] uppercase font-semibold px-1.5 py-0.5 ${inv.paid ? "text-[#4ade80] bg-[#4ade80]/10" : "text-[#fbbf24] bg-[#fbbf24]/10"}`}>
                      {inv.paid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
