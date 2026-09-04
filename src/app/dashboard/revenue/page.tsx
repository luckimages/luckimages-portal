"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

// ── Types ──────────────────────────────────────────────────────────────────────

type Snapshot = {
  rev_ytd: number;
  rev_month: number;
  expenses_ytd: number;
  net_income: number;
  ytd_invoices: number;
  unpaid_count: number;
  monthly_breakdown: Record<string, number>;
  synced_at: string;
  connected?: boolean;
};

type Invoice = {
  id: string;
  shoot_id: string | null;
  contact_id: string | null;
  amount_cents: number;
  description: string | null;
  due_date: string | null;
  paid: boolean;
  stripe_payment_intent_id: string | null;
  qbo_invoice_id: string | null;
  created_at: string;
  shoots: { address: string; scheduled_at: string | null; services: string[] } | null;
  contacts: { name: string; email: string } | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(a: number, b: number) {
  if (!b) return null;
  return ((a - b) / b) * 100;
}

const emptySnap: Snapshot = {
  rev_ytd: 0, rev_month: 0, expenses_ytd: 0, net_income: 0,
  ytd_invoices: 0, unpaid_count: 0, monthly_breakdown: {}, synced_at: "",
};

const monthNames: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    const r = await fetch("/api/admin/invoices");
    if (r.ok) {
      const d = await r.json();
      setInvoices(d.invoices ?? []);
    }
    setInvoicesLoading(false);
  }, []);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
    });

    // Load cached snapshot first, then sync
    fetch("/api/admin/sync-qb")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSnap(prev => prev ?? { ...emptySnap, connected: d.connected }); });
    fetch("/api/admin/sync-qb", { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSnap(d); });

    loadInvoices();
  }, [router, loadInvoices]);

  async function syncNow() {
    setSyncing(true);
    const r = await fetch("/api/admin/sync-qb", { method: "POST" });
    if (r.ok) setSnap(await r.json());
    setSyncing(false);
  }

  async function markPaid(invoiceId: string) {
    setMarkingId(invoiceId);
    const r = await fetch("/api/admin/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    });
    if (r.ok) {
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, paid: true } : inv));
    }
    setMarkingId(null);
  }

  if (!snap) return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center">
      <p className="text-xs text-[#555] tracking-[3px] uppercase">Loading...</p>
    </div>
  );

  // ── QBO-derived values ─────────────────────────────────────────────────────
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

  // ── Supabase invoice-derived values ───────────────────────────────────────
  const unpaidInvoices = invoices.filter(i => !i.paid);
  const paidInvoices = invoices.filter(i => i.paid);
  const outstandingCents = unpaidInvoices.reduce((s, i) => s + i.amount_cents, 0);
  const collectedThisMonthCents = paidInvoices
    .filter(i => i.created_at.startsWith(thisMonthKey))
    .reduce((s, i) => s + i.amount_cents, 0);

  const filtered = filter === "unpaid" ? unpaidInvoices
    : filter === "paid" ? paidInvoices
    : invoices;

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

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">Finance</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">Revenue</h1>
          </div>
          <div className="flex items-center gap-4">
            {snap.synced_at && (
              <span className="text-[10px] text-[#444] hidden md:block">
                QB synced {new Date(snap.synced_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            {snap.connected === false ? (
              <a
                href="/api/admin/qbo/connect"
                className="text-[10px] tracking-[2px] uppercase border border-[#fbbf24]/40 px-3 py-1.5 text-[#fbbf24] hover:border-[#fbbf24] transition-all"
              >
                Connect QuickBooks
              </a>
            ) : (
              <button
                onClick={syncNow}
                disabled={syncing}
                className="text-[10px] tracking-[2px] uppercase border border-white/20 px-3 py-1.5 text-[#666] hover:text-white hover:border-white/50 transition-all disabled:opacity-40"
              >
                {syncing ? "Syncing..." : "↻ Sync QB"}
              </button>
            )}
          </div>
        </div>

        {/* ── Invoice KPIs (Nocturne) ────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Invoices · Nocturne
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5">
            {[
              { label: "Outstanding", value: fmt(outstandingCents / 100), accent: outstandingCents > 0 ? "text-[#fbbf24]" : "" },
              { label: "Collected This Month", value: fmt(collectedThisMonthCents / 100), accent: "text-[#4ade80]" },
              { label: "Total Invoices", value: invoices.length.toString(), accent: "" },
              { label: "Unpaid", value: unpaidInvoices.length.toString(), accent: unpaidInvoices.length > 0 ? "text-[#fbbf24]" : "" },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-[#0c0c0c] px-5 py-5">
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">{label}</p>
                <p className={`text-2xl font-black tabular-nums ${accent || "text-white"}`}>{invoicesLoading ? "—" : value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── QBO P&L KPIs ─────────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            P&L · QuickBooks
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5">
            {[
              { label: "YTD Revenue", value: fmt(snap.rev_ytd) },
              { label: "Net Income YTD", value: fmt(snap.net_income) },
              { label: "Expenses YTD", value: fmt(snap.expenses_ytd) },
              { label: "Avg Per Shoot", value: fmt(avgPerShoot) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0c0c0c] px-5 py-5">
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">{label}</p>
                <p className="text-2xl font-black tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* This month comparisons */}
        <section>
          <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            {monthNames[thisMonthKey.split("-")[1]]} {now.getFullYear()}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border border-white/5">
            <div className="bg-[#0c0c0c] px-5 py-5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">This Month (QB)</p>
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

        {/* ── Invoice Table ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] tracking-[3px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
              All Invoices
            </p>
            <div className="flex items-center gap-1 ml-4">
              {(["all", "unpaid", "paid"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[9px] tracking-[1.5px] uppercase px-2.5 py-1 transition-all ${
                    filter === f
                      ? "bg-white text-black font-bold"
                      : "text-[#555] hover:text-white border border-white/10"
                  }`}
                >
                  {f === "all" ? `All (${invoices.length})` : f === "unpaid" ? `Unpaid (${unpaidInvoices.length})` : `Paid (${paidInvoices.length})`}
                </button>
              ))}
            </div>
          </div>

          {invoicesLoading ? (
            <div className="border border-white/5 px-5 py-8 text-center text-[#444] text-xs tracking-widest uppercase">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="border border-white/5 px-5 py-8 text-center text-[#444] text-xs tracking-widest uppercase">No invoices</div>
          ) : (
            <div className="border border-white/5 overflow-x-auto">
              {/* Header */}
              <div className="grid grid-cols-[90px_1fr_140px_80px_80px_100px] gap-x-3 px-4 py-3 border-b border-white/5 min-w-[640px]">
                {["Date", "Property / Description", "Client", "Amount", "Status", ""].map(h => (
                  <span key={h} className="text-[9px] tracking-[1.5px] uppercase text-[#333]">{h}</span>
                ))}
              </div>
              {filtered.map(inv => {
                const address = inv.shoots?.address || inv.description || "—";
                const clientName = inv.contacts?.name || "—";
                const amount = fmt(inv.amount_cents / 100);
                const date = new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
                const via = inv.stripe_payment_intent_id ? " · Stripe" : inv.qbo_invoice_id ? " · QB" : "";
                return (
                  <div
                    key={inv.id}
                    className="grid grid-cols-[90px_1fr_140px_80px_80px_100px] gap-x-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] items-center min-w-[640px]"
                  >
                    <span className="text-xs text-[#555] tabular-nums">{date}</span>
                    <span className="text-sm text-white truncate" title={address}>{address}</span>
                    <span className="text-xs text-[#888] truncate">{clientName}</span>
                    <span className="text-sm font-semibold tabular-nums">{amount}</span>
                    <div>
                      <span className={`text-[9px] tracking-[1px] uppercase font-semibold px-1.5 py-0.5 ${
                        inv.paid
                          ? "text-[#4ade80] bg-[#4ade80]/10"
                          : "text-[#fbbf24] bg-[#fbbf24]/10"
                      }`}>
                        {inv.paid ? `Paid${via}` : "Unpaid"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {!inv.paid && (
                        <button
                          onClick={() => markPaid(inv.id)}
                          disabled={markingId === inv.id}
                          className="text-[9px] tracking-[1px] uppercase px-2 py-1 border border-white/20 text-[#555] hover:text-white hover:border-white/50 transition-all disabled:opacity-40"
                        >
                          {markingId === inv.id ? "..." : "Mark Paid"}
                        </button>
                      )}
                      {inv.shoot_id && (
                        <a
                          href={`/admin/shoots/${inv.shoot_id}`}
                          className="text-[9px] tracking-[1px] uppercase text-[#444] hover:text-white transition-colors"
                        >
                          Shoot ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
