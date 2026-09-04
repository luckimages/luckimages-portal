"use client";

import { useState, useEffect, useCallback } from "react";
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

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const monthNames: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

const emptySnap: Snapshot = {
  rev_ytd: 0, rev_month: 0, expenses_ytd: 0, net_income: 0,
  ytd_invoices: 0, unpaid_count: 0, monthly_breakdown: {}, synced_at: "",
};

export default function RevenuePage() {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState<"month" | "ytd">("ytd");
  const [blurred, setBlurred] = useState(true);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    const r = await fetch("/api/admin/invoices");
    if (r.ok) setInvoices((await r.json()).invoices ?? []);
    setInvoicesLoading(false);
  }, []);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
    });
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
    if (r.ok) setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, paid: true } : i));
    setMarkingId(null);
  }

  if (!snap) return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center">
      <p className="text-xs text-[#555] tracking-[3px] uppercase">Loading...</p>
    </div>
  );

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  const thisYear = now.getFullYear().toString();

  const unpaidInvoices = invoices.filter(i => !i.paid);
  const paidInvoices = invoices.filter(i => i.paid);
  const outstandingCents = unpaidInvoices.reduce((s, i) => s + i.amount_cents, 0);

  // Build monthly breakdown from Supabase paid invoices (grouped by created_at month)
  const monthlyBreakdown: Record<string, number> = {};
  for (const inv of paidInvoices) {
    const key = inv.created_at.slice(0, 7);
    monthlyBreakdown[key] = (monthlyBreakdown[key] ?? 0) + inv.amount_cents / 100;
  }
  const months = Object.entries(monthlyBreakdown).sort(([a], [b]) => a.localeCompare(b));
  const maxMonth = Math.max(...Object.values(monthlyBreakdown), 1);

  // Hero stats — all from Supabase invoices
  const thisMonthPaid = paidInvoices.filter(i => i.created_at.startsWith(thisMonthKey));
  const lastMonthPaid = paidInvoices.filter(i => i.created_at.startsWith(lastMonthKey));
  const ytdPaid = paidInvoices.filter(i => i.created_at.startsWith(thisYear));

  const thisMonthIncome = thisMonthPaid.reduce((s, i) => s + i.amount_cents, 0) / 100;
  const lastMonthIncome = lastMonthPaid.reduce((s, i) => s + i.amount_cents, 0) / 100;
  const ytdIncome = ytdPaid.reduce((s, i) => s + i.amount_cents, 0) / 100;
  const momDiff = lastMonthIncome ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : null;

  const heroIncome = period === "month" ? thisMonthIncome : ytdIncome;
  const heroShoots = period === "month" ? thisMonthPaid.length : ytdPaid.length;

  const filtered = filter === "unpaid" ? unpaidInvoices : filter === "paid" ? paidInvoices : invoices;

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 space-y-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tight uppercase">Revenue</h1>
          <div className="flex items-center gap-3">
            {snap.synced_at && (
              <span className="text-[10px] text-[#444] hidden md:block">
                QB {new Date(snap.synced_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
            {snap.connected === false ? (
              <a href="/api/admin/qbo/connect" className="text-[10px] tracking-[2px] uppercase border border-[#fbbf24]/40 px-3 py-1.5 text-[#fbbf24] hover:border-[#fbbf24] transition-all">
                Connect QB
              </a>
            ) : (
              <button onClick={syncNow} disabled={syncing} className="text-[10px] tracking-[2px] uppercase border border-white/20 px-3 py-1.5 text-[#555] hover:text-white hover:border-white/40 transition-all disabled:opacity-40">
                {syncing ? "Syncing..." : "↻ Sync QB"}
              </button>
            )}
          </div>
        </div>

        {/* ── Hero stats ──────────────────────────────────────────────── */}
        <div>
          {/* Period toggle + privacy toggle */}
          <div className="flex items-center gap-2 mb-5">
            {(["month", "ytd"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-[10px] tracking-[2px] uppercase px-3 py-1.5 transition-all ${
                  period === p ? "bg-white text-black font-bold" : "text-[#555] border border-white/10 hover:text-white"
                }`}
              >
                {p === "month" ? `${monthNames[thisMonthKey.split("-")[1]]} ${now.getFullYear()}` : "YTD"}
              </button>
            ))}
            <button
              onClick={() => setBlurred(b => !b)}
              className="p-1.5 text-[#555] hover:text-white transition-colors"
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

          <div className="grid grid-cols-2 gap-px bg-white/[0.07] border border-white/[0.07]">
            <div className="bg-[#0c0c0c] px-8 py-7">
              <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-3">Income</p>
              <p className={`text-5xl font-black tabular-nums tracking-tight transition-all select-none ${blurred ? "blur-sm" : ""}`}>{fmt(heroIncome)}</p>
              {period === "month" && momDiff !== null && (
                <p className={`text-xs mt-2 font-semibold ${momDiff >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                  {momDiff >= 0 ? "▲" : "▼"} {Math.abs(momDiff).toFixed(1)}% vs last month
                </p>
              )}
              {period === "ytd" && snap.expenses_ytd > 0 && (
                <p className={`text-xs mt-2 text-[#555] transition-all select-none ${blurred ? "blur-sm" : ""}`}>
                  <span className="text-[#4ade80] font-semibold">{fmt(snap.net_income)}</span> net · {fmt(snap.expenses_ytd)} expenses (QB)
                </p>
              )}
            </div>
            <div className="bg-[#0c0c0c] px-8 py-7">
              <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-3">Shoots</p>
              <p className={`text-5xl font-black tabular-nums tracking-tight transition-all select-none ${blurred ? "blur-sm" : ""}`}>{invoicesLoading ? "—" : heroShoots}</p>
              {outstandingCents > 0 && (
                <p className={`text-xs mt-2 font-semibold text-[#fbbf24] transition-all select-none ${blurred ? "blur-sm" : ""}`}>
                  {fmt(outstandingCents / 100)} outstanding
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Monthly bar chart ───────────────────────────────────────── */}
        <div className="bg-[#111] border border-white/[0.07] px-6 py-5">
          <div className="flex items-end gap-2 h-36">
            {months.map(([key, val]) => {
              const [, mo] = key.split("-");
              const isThis = key === thisMonthKey;
              const h = Math.max(Math.round((val / maxMonth) * 128), 2);
              return (
                <div key={key} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                    <span className="text-white font-semibold">{fmt(val)}</span>
                    <span className="text-[#555] ml-1">{monthNames[mo]}</span>
                  </div>
                  <div className={`w-full transition-colors ${isThis ? "bg-white" : "bg-white/20 group-hover:bg-white/40"}`} style={{ height: `${h}px` }} />
                  <p className={`text-[9px] tracking-wide ${isThis ? "text-white" : "text-[#444]"}`}>{monthNames[mo]}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Invoice table ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-[3px] uppercase text-[#555]">Invoices</p>
            <div className="flex gap-1">
              {(["all", "unpaid", "paid"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[9px] tracking-[1.5px] uppercase px-2.5 py-1 transition-all ${
                    filter === f ? "bg-white text-black font-bold" : "text-[#555] hover:text-white border border-white/10"
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
            <div className="border border-white/[0.07] overflow-x-auto">
              <div className="grid grid-cols-[88px_1fr_130px_80px_90px_110px] gap-x-3 px-4 py-2.5 border-b border-white/[0.07] min-w-[600px]">
                {["Date", "Property", "Client", "Amount", "Status", ""].map(h => (
                  <span key={h} className="text-[9px] tracking-[1.5px] uppercase text-[#333]">{h}</span>
                ))}
              </div>
              {filtered.map(inv => {
                const fullAddress = inv.shoots?.address || inv.description || "—";
                const address = fullAddress.split(",")[0].trim();
                const clientName = inv.contacts?.name || "—";
                const date = new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
                const source = inv.stripe_payment_intent_id ? "stripe" : inv.qbo_invoice_id ? "qbo" : inv.paid ? "historical" : "unpaid";
                const badge = {
                  stripe:     { label: "Paid · Stripe",     cls: "text-[#4ade80] bg-[#4ade80]/10" },
                  qbo:        { label: "Paid · QB",          cls: "text-[#60a5fa] bg-[#60a5fa]/10" },
                  historical: { label: "Paid · Historical",  cls: "text-[#888] bg-white/[0.06]" },
                  unpaid:     { label: "Unpaid",             cls: "text-[#fbbf24] bg-[#fbbf24]/10" },
                }[source];
                return (
                  <div key={inv.id} className="grid grid-cols-[88px_1fr_130px_80px_90px_110px] gap-x-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] items-center min-w-[600px]">
                    <span className="text-[11px] text-[#555] tabular-nums">{date}</span>
                    <span className="text-sm truncate" title={fullAddress}>{address}</span>
                    <span className="text-[11px] text-[#888] truncate">{clientName}</span>
                    <span className={`text-sm font-semibold tabular-nums transition-all select-none ${blurred ? "blur-sm" : ""}`}>{fmt(inv.amount_cents / 100)}</span>
                    <span className={`text-[9px] tracking-[1px] uppercase font-semibold px-1.5 py-0.5 w-fit ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <div className="flex items-center gap-2 justify-end">
                      {!inv.paid && (
                        <button onClick={() => markPaid(inv.id)} disabled={markingId === inv.id} className="text-[9px] tracking-[1px] uppercase px-2 py-1 border border-white/20 text-[#555] hover:text-white hover:border-white/50 transition-all disabled:opacity-40">
                          {markingId === inv.id ? "..." : "Mark Paid"}
                        </button>
                      )}
                      {inv.shoot_id && (
                        <a href={`/admin/shoots/${inv.shoot_id}`} className="text-[9px] tracking-[1px] uppercase text-[#383838] hover:text-white transition-colors">
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
