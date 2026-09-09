"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

type ExpenseLine = {
  id: string;
  kind: "operating" | "stripe" | "gas" | "editing";
  category: string;
  label: string;
  amount_cents: number;
  recurring?: boolean;
  note?: string | null;
  shoot_id?: string | null;
  editable: boolean;
};

type Pnl = {
  scope: "month" | "ytd";
  month: string | null;
  income_cents: number;
  paid_invoice_count: number;
  expense_cents: number;
  profit_cents: number;
  by_category: { category: string; amount_cents: number }[];
  lines: ExpenseLine[];
  memo: {
    mileage_miles: number;
    mileage_deduction_cents: number;
    leif_profit_share_cents: number;
  };
};

type MileageRow = {
  photographer_id: string;
  name: string;
  month: string;
  day_count: number;
  miles: number;
  gas_cents: number;
  deduction_cents: number;
};

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtc(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const monthNames: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

const EXPENSE_CATEGORIES = ["software", "insurance", "marketing", "gear", "vehicle", "contractor", "other"];
const CAT_LABEL: Record<string, string> = {
  software: "Software / Subscriptions", insurance: "Insurance", marketing: "Marketing",
  gear: "Gear", vehicle: "Vehicle", contractor: "Contractor pay", other: "Other",
};

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${monthNames[m]} ${y}`;
}
function shiftMonth(key: string, by: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

  const thisMonthKey0 = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [expMonth, setExpMonth] = useState(thisMonthKey0);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [pnlLoading, setPnlLoading] = useState(true);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    const r = await fetch("/api/admin/invoices");
    if (r.ok) setInvoices((await r.json()).invoices ?? []);
    setInvoicesLoading(false);
  }, []);

  const loadPnl = useCallback(async () => {
    setPnlLoading(true);
    const qs = period === "month" ? `scope=month&month=${expMonth}` : "scope=ytd";
    const r = await fetch(`/api/admin/expenses?${qs}`);
    if (r.ok) setPnl(await r.json());
    setPnlLoading(false);
  }, [period, expMonth]);

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

  useEffect(() => { loadPnl(); }, [loadPnl]);

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
      setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, paid: true } : i));
      loadPnl();
    }
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

  const monthlyBreakdown: Record<string, number> = {};
  for (const inv of paidInvoices) {
    const key = inv.created_at.slice(0, 7);
    monthlyBreakdown[key] = (monthlyBreakdown[key] ?? 0) + inv.amount_cents / 100;
  }
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const cutoffKey = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}`;
  const months = Object.entries(monthlyBreakdown).filter(([k]) => k >= cutoffKey).sort(([a], [b]) => a.localeCompare(b));
  const maxMonth = Math.max(...Object.values(monthlyBreakdown), 1);

  const thisMonthPaid = paidInvoices.filter(i => i.created_at.startsWith(thisMonthKey));
  const lastMonthPaid = paidInvoices.filter(i => i.created_at.startsWith(lastMonthKey));
  const ytdPaid = paidInvoices.filter(i => i.created_at.startsWith(thisYear));

  const thisMonthIncome = thisMonthPaid.reduce((s, i) => s + i.amount_cents, 0) / 100;
  const lastMonthIncome = lastMonthPaid.reduce((s, i) => s + i.amount_cents, 0) / 100;
  const ytdIncome = ytdPaid.reduce((s, i) => s + i.amount_cents, 0) / 100;
  const momDiff = lastMonthIncome ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : null;

  const heroShoots = period === "month" ? thisMonthPaid.length : ytdPaid.length;

  // Income / expenses / profit — prefer the P&L (matches its period), fall
  // back to the invoice-derived income while it loads.
  const heroIncome = pnl ? pnl.income_cents / 100 : (period === "month" ? thisMonthIncome : ytdIncome);
  const heroExpenses = pnl ? pnl.expense_cents / 100 : 0;
  const heroProfit = pnl ? pnl.profit_cents / 100 : heroIncome - heroExpenses;

  const filtered = filter === "unpaid" ? unpaidInvoices : filter === "paid" ? paidInvoices : invoices;

  const blur = blurred ? "blur-sm" : "";

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tight uppercase">Revenue</h1>
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

        {/* ── Period + privacy toggle ─────────────────────────────────── */}
        <div className="flex items-center gap-2">
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

        {/* ── Hero: Income · Expenses · Net Profit ─────────────────────── */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/[0.07] border border-white/[0.07]">
            <div className="bg-[#0c0c0c] px-6 py-7">
              <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-3">Income</p>
              <p className={`text-4xl font-black tabular-nums tracking-tight transition-all select-none ${blur}`}>{fmt(heroIncome)}</p>
              {period === "month" && momDiff !== null && (
                <p className={`text-xs mt-2 font-semibold ${momDiff >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                  {momDiff >= 0 ? "▲" : "▼"} {Math.abs(momDiff).toFixed(1)}% vs last month
                </p>
              )}
            </div>
            <div className="bg-[#0c0c0c] px-6 py-7">
              <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-3">Expenses</p>
              <p className={`text-4xl font-black tabular-nums tracking-tight text-[#f87171] transition-all select-none ${blur}`}>
                {pnlLoading && !pnl ? "—" : fmt(heroExpenses)}
              </p>
              {pnl && (
                <p className={`text-xs mt-2 text-[#555] select-none ${blur}`}>
                  {fmtc((pnl.by_category.find(c => c.category === "Stripe fees")?.amount_cents) ?? 0)} Stripe ·{" "}
                  {fmtc((pnl.by_category.find(c => c.category === "Gas (mileage)")?.amount_cents) ?? 0)} gas ·{" "}
                  {fmtc((pnl.by_category.find(c => c.category === "Editing")?.amount_cents) ?? 0)} editing
                </p>
              )}
            </div>
            <div className="bg-[#0c0c0c] px-6 py-7">
              <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-3">Net Profit</p>
              <p className={`text-4xl font-black tabular-nums tracking-tight transition-all select-none ${blur} ${heroProfit >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                {pnlLoading && !pnl ? "—" : fmt(heroProfit)}
              </p>
              {pnl && (
                <p className={`text-xs mt-2 text-[#555] select-none ${blur}`}>
                  Leif&apos;s 50%: {fmtc(pnl.memo.leif_profit_share_cents)}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-[#555] mt-3">
            {invoicesLoading ? "—" : `${heroShoots} paid shoot${heroShoots === 1 ? "" : "s"}`}
            {outstandingCents > 0 && <span className="text-[#fbbf24]"> · {fmt(outstandingCents / 100)} outstanding</span>}
          </p>
        </div>

        {/* ── Monthly bar chart ───────────────────────────────────────── */}
        <div className="bg-[#111] border border-white/[0.07] px-6 py-5">
          <div className="flex items-end gap-2 h-36">
            {months.map(([key, val]) => {
              const [yr, mo] = key.split("-");
              const isThis = key === thisMonthKey;
              const showYear = yr !== thisYear;
              const h = Math.max(Math.round((val / maxMonth) * 128), 2);
              return (
                <div key={key} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                    <span className="text-white font-semibold">{fmt(val)}</span>
                    <span className="text-[#555] ml-1">{monthNames[mo]}</span>
                  </div>
                  <div className={`w-full transition-colors ${isThis ? "bg-white" : "bg-white/20 group-hover:bg-white/40"}`} style={{ height: `${h}px` }} />
                  <p className={`text-[9px] tracking-wide leading-tight text-center ${isThis ? "text-white" : "text-[#444]"}`}>
                    {monthNames[mo]}{showYear && <><br /><span className="text-[8px] opacity-60">{yr.slice(2)}</span></>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Expenses ────────────────────────────────────────────────── */}
        <ExpensesSection
          pnl={pnl}
          loading={pnlLoading}
          period={period}
          expMonth={expMonth}
          setExpMonth={setExpMonth}
          onChanged={loadPnl}
          blur={blur}
        />

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
                    <span className={`text-sm font-semibold tabular-nums transition-all select-none ${blur}`}>{fmt(inv.amount_cents / 100)}</span>
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

/* ══════════════════════════════════════════════════════════════════════════
   Expenses section
   ══════════════════════════════════════════════════════════════════════════ */

function ExpensesSection({
  pnl, loading, period, expMonth, setExpMonth, onChanged, blur,
}: {
  pnl: Pnl | null;
  loading: boolean;
  period: "month" | "ytd";
  expMonth: string;
  setExpMonth: (m: string) => void;
  onChanged: () => void;
  blur: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCat, setNewCat] = useState("software");
  const [newRecurring, setNewRecurring] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const operating = useMemo(() => (pnl?.lines ?? []).filter(l => l.kind === "operating"), [pnl]);
  const gasLines = useMemo(() => (pnl?.lines ?? []).filter(l => l.kind === "gas"), [pnl]);
  const editingLines = useMemo(() => (pnl?.lines ?? []).filter(l => l.kind === "editing"), [pnl]);
  const stripeLines = useMemo(() => (pnl?.lines ?? []).filter(l => l.kind === "stripe"), [pnl]);

  const maxCat = Math.max(1, ...(pnl?.by_category ?? []).map(c => c.amount_cents));

  async function addExpense() {
    const dollars = parseFloat(newAmount);
    if (!newLabel.trim()) { setErr("Give it a name."); return; }
    if (!Number.isFinite(dollars) || dollars < 0) { setErr("Enter a valid amount."); return; }
    setSaving(true); setErr("");
    const r = await fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: newLabel.trim(),
        amount_cents: Math.round(dollars * 100),
        category: newCat,
        recurring: newRecurring,
        month: period === "month" ? expMonth : undefined,
      }),
    });
    setSaving(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Could not save."); return; }
    setNewLabel(""); setNewAmount(""); setAdding(false);
    onChanged();
  }

  async function patchLine(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    await fetch("/api/admin/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    setBusyId(null);
    onChanged();
  }

  async function deleteLine(id: string) {
    setBusyId(id);
    await fetch("/api/admin/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusyId(null);
    onChanged();
  }

  const opsTotal = operating.reduce((s, l) => s + l.amount_cents, 0);

  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-[10px] tracking-[3px] uppercase text-[#555]">Expenses</p>
        {period === "month" ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setExpMonth(shiftMonth(expMonth, -1))} className="text-[#555] hover:text-white transition-colors px-1">‹</button>
            <span className="text-[10px] tracking-[2px] uppercase text-[#888] tabular-nums">{monthLabel(expMonth)}</span>
            <button
              onClick={() => setExpMonth(shiftMonth(expMonth, 1))}
              disabled={expMonth >= `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
              className="text-[#555] hover:text-white transition-colors px-1 disabled:opacity-20">›</button>
          </div>
        ) : (
          <span className="text-[10px] tracking-[2px] uppercase text-[#888]">Year to date</span>
        )}
      </div>

      {loading && !pnl ? (
        <div className="border border-white/5 px-5 py-8 text-center text-[#444] text-xs tracking-widest uppercase">Loading...</div>
      ) : (
        <div className="space-y-6">

          {/* Category breakdown */}
          {pnl && pnl.by_category.length > 0 && (
            <div className="bg-[#111] border border-white/[0.07] px-6 py-5 space-y-2.5">
              {pnl.by_category.map(c => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="text-[11px] text-[#888] w-40 shrink-0 truncate">{CAT_LABEL[c.category] ?? c.category}</span>
                  <div className="flex-1 h-2 bg-white/[0.04]">
                    <div className="h-full bg-[#f87171]/50" style={{ width: `${(c.amount_cents / maxCat) * 100}%` }} />
                  </div>
                  <span className={`text-[11px] text-white tabular-nums w-16 text-right select-none ${blur}`}>{fmtc(c.amount_cents)}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-2 border-t border-white/[0.07]">
                <span className="text-[11px] tracking-[1px] uppercase text-[#666] w-40 shrink-0">Total expenses</span>
                <div className="flex-1" />
                <span className={`text-sm font-bold text-[#f87171] tabular-nums w-16 text-right select-none ${blur}`}>{fmtc(pnl.expense_cents)}</span>
              </div>
            </div>
          )}

          {/* Operating budget — manual */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] tracking-[2px] uppercase text-[#666]">Operating budget</p>
              <button onClick={() => { setAdding(a => !a); setErr(""); }} className="text-[9px] tracking-[1.5px] uppercase px-2.5 py-1 border border-white/15 text-[#888] hover:text-white hover:border-white/40 transition-all">
                {adding ? "Close" : "+ Add expense"}
              </button>
            </div>

            {adding && (
              <div className="border border-white/10 bg-white/[0.02] p-4 mb-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="What is it? (e.g. Adobe CC)"
                    className="bg-[#0c0c0c] border border-white/15 focus:border-white/40 text-sm text-white px-3 py-2 outline-none flex-1 min-w-[160px]" />
                  <div className="flex items-center border border-white/15 focus-within:border-white/40 bg-[#0c0c0c]">
                    <span className="text-[#555] text-sm pl-2.5">$</span>
                    <input value={newAmount} onChange={e => setNewAmount(e.target.value)} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
                      className="bg-transparent text-sm text-white px-2 py-2 w-24 outline-none tabular-nums" />
                  </div>
                  <select value={newCat} onChange={e => setNewCat(e.target.value)}
                    className="bg-[#0c0c0c] border border-white/15 text-sm text-white px-2 py-2 outline-none">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-xs text-[#888] cursor-pointer">
                    <input type="checkbox" checked={newRecurring} onChange={e => setNewRecurring(e.target.checked)} className="accent-white" />
                    Recurring — repeats every month automatically
                  </label>
                  <button onClick={addExpense} disabled={saving}
                    className="text-xs tracking-[2px] uppercase bg-white text-black px-4 py-2 font-semibold hover:bg-white/90 transition-colors disabled:opacity-40">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
                {err && <p className="text-[11px] text-red-400">{err}</p>}
              </div>
            )}

            <div className="border border-white/[0.07]">
              {operating.length === 0 ? (
                <p className="px-4 py-5 text-center text-[#444] text-xs tracking-widest uppercase">
                  No operating expenses {period === "month" ? "this month" : "yet"}
                </p>
              ) : (
                operating.map(l => (
                  <div key={l.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-4 py-2.5 border-b border-white/[0.04] last:border-0 items-center">
                    <div className="min-w-0">
                      <span className="text-sm truncate block">{l.label}</span>
                      <span className="text-[10px] text-[#555] tracking-[1px] uppercase">
                        {CAT_LABEL[l.category] ?? l.category}{l.recurring && " · recurring"}
                      </span>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums select-none ${blur}`}>{fmtc(l.amount_cents)}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => patchLine(l.id, { recurring: !l.recurring })}
                        disabled={busyId === l.id}
                        title={l.recurring ? "Stop repeating" : "Make recurring"}
                        className={`text-[9px] tracking-[1px] uppercase px-1.5 py-1 border transition-all disabled:opacity-40 ${
                          l.recurring ? "border-[#4ade80]/30 text-[#4ade80]" : "border-white/15 text-[#555] hover:text-white"
                        }`}>
                        ↻
                      </button>
                      <button onClick={() => deleteLine(l.id)} disabled={busyId === l.id}
                        className="text-[9px] tracking-[1px] uppercase px-1.5 py-1 border border-white/15 text-[#555] hover:text-red-400 hover:border-red-400/40 transition-all disabled:opacity-40">
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
              {operating.length > 0 && (
                <div className="grid grid-cols-[1fr_auto] gap-x-3 px-4 py-2.5 bg-white/[0.02] items-center">
                  <span className="text-[10px] tracking-[1px] uppercase text-[#666]">Operating subtotal</span>
                  <span className={`text-sm font-bold tabular-nums select-none ${blur}`}>{fmtc(opsTotal)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Auto-tracked */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AutoBucket title="Stripe fees" note="2.9% + $0.30 per paid invoice" lines={stripeLines} blur={blur} />
            <AutoBucket title="Gas" note="From the mileage tracker" lines={gasLines} blur={blur} />
            <AutoBucket title="Editing" note="Logged at delivery, per shoot" lines={editingLines} blur={blur} />
          </div>

          {/* Memo / reference lines */}
          {pnl && (
            <div className="border border-white/[0.07] bg-white/[0.01] px-4 py-3 text-xs text-[#666] space-y-1.5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">For reference — not subtracted from profit</p>
              <div className="flex justify-between">
                <span>IRS mileage deduction ({pnl.memo.mileage_miles.toLocaleString()} mi · tax season)</span>
                <span className={`tabular-nums text-[#888] select-none ${blur}`}>{fmtc(pnl.memo.mileage_deduction_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Leif&apos;s share (50% of net profit)</span>
                <span className={`tabular-nums text-[#888] select-none ${blur}`}>{fmtc(pnl.memo.leif_profit_share_cents)}</span>
              </div>
            </div>
          )}

          {/* Mileage report */}
          <MileageReport blur={blur} />
        </div>
      )}
    </section>
  );
}

function AutoBucket({ title, note, lines, blur }: { title: string; note: string; lines: ExpenseLine[]; blur: string }) {
  const [open, setOpen] = useState(false);
  const total = lines.reduce((s, l) => s + l.amount_cents, 0);
  return (
    <div className="border border-white/[0.07] px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] tracking-[1px] uppercase text-[#888]">{title}</p>
          <p className="text-[10px] text-[#555] mt-0.5">{note}</p>
        </div>
        <span className={`text-lg font-bold tabular-nums select-none ${blur}`}>{fmtc(total)}</span>
      </div>
      {lines.length > 0 && (
        <>
          <button onClick={() => setOpen(o => !o)} className="text-[9px] tracking-[1px] uppercase text-[#555] hover:text-white transition-colors mt-2">
            {open ? "Hide" : `Show ${lines.length} item${lines.length === 1 ? "" : "s"}`}
          </button>
          {open && (
            <div className="mt-2 space-y-1 border-t border-white/[0.07] pt-2">
              {lines.map(l => (
                <div key={l.id} className="flex justify-between gap-2 text-[11px]">
                  <span className="text-[#888] truncate">{l.label}</span>
                  <span className={`text-[#aaa] tabular-nums shrink-0 select-none ${blur}`}>{fmtc(l.amount_cents)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MileageReport({ blur }: { blur: string }) {
  const [rows, setRows] = useState<MileageRow[] | null>(null);
  const [totals, setTotals] = useState<{ miles: number; gas_cents: number; deduction_cents: number } | null>(null);

  useEffect(() => {
    fetch("/api/admin/mileage")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setRows(d.rows); setTotals(d.totals); } })
      .catch(() => setRows([]));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] tracking-[2px] uppercase text-[#666]">Mileage report — all photographers</p>
        <a href="/api/admin/mileage?format=csv"
          className="text-[9px] tracking-[1.5px] uppercase px-2.5 py-1 border border-white/15 text-[#888] hover:text-white hover:border-white/40 transition-all">
          ↓ CSV
        </a>
      </div>
      <div className="border border-white/[0.07] overflow-x-auto">
        <div className="grid grid-cols-[92px_1fr_60px_80px_90px_100px] gap-x-3 px-4 py-2.5 border-b border-white/[0.07] min-w-[520px]">
          {["Month", "Photographer", "Days", "Miles", "Gas", "IRS ded."].map(h => (
            <span key={h} className="text-[9px] tracking-[1.5px] uppercase text-[#333]">{h}</span>
          ))}
        </div>
        {rows === null ? (
          <p className="px-4 py-5 text-center text-[#444] text-xs tracking-widest uppercase">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-5 text-center text-[#444] text-xs tracking-widest uppercase">No mileage recorded yet</p>
        ) : (
          <>
            {rows.map(r => (
              <div key={`${r.photographer_id}-${r.month}`} className="grid grid-cols-[92px_1fr_60px_80px_90px_100px] gap-x-3 px-4 py-2.5 border-b border-white/[0.04] items-center min-w-[520px]">
                <span className="text-[11px] text-[#555] tabular-nums">{monthLabel(r.month)}</span>
                <span className="text-sm truncate">{r.name}</span>
                <span className="text-[11px] text-[#888] tabular-nums">{r.day_count}</span>
                <span className="text-[11px] text-[#888] tabular-nums">{r.miles.toFixed(0)}</span>
                <span className={`text-[11px] tabular-nums select-none ${blur}`}>{fmtc(r.gas_cents)}</span>
                <span className={`text-[11px] text-[#888] tabular-nums select-none ${blur}`}>{fmtc(r.deduction_cents)}</span>
              </div>
            ))}
            {totals && (
              <div className="grid grid-cols-[92px_1fr_60px_80px_90px_100px] gap-x-3 px-4 py-2.5 bg-white/[0.02] items-center min-w-[520px]">
                <span className="text-[10px] tracking-[1px] uppercase text-[#666]">Total</span>
                <span />
                <span />
                <span className="text-[11px] font-semibold tabular-nums">{totals.miles.toFixed(0)}</span>
                <span className={`text-[11px] font-semibold tabular-nums select-none ${blur}`}>{fmtc(totals.gas_cents)}</span>
                <span className={`text-[11px] font-semibold tabular-nums select-none ${blur}`}>{fmtc(totals.deduction_cents)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
