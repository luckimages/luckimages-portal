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
  monthly_cents?: number;
  recurring?: boolean;
  cadence?: string;
  auto_source?: string | null;
  note?: string | null;
  shoot_id?: string | null;
  editable: boolean;
};

type ShootExpenseRow = {
  shoot_id: string;
  date: string;
  address: string;
  client: string;
  stripe_cents: number;
  gas_cents: number;
  editing_cents: number;
  expense_cents: number;
  revenue_cents: number;
  revenue_paid: boolean;
  profit_cents: number;
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
  shoot_expenses: ShootExpenseRow[];
  shoot_expense_cents: number;
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
// Exact cents — used everywhere in the Expenses breakdown.
function fmtc2(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Effective monthly figure for an expense line (annual rows are billed yearly).
function moOf(l: ExpenseLine) {
  return l.monthly_cents ?? l.amount_cents;
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
  const [period, setPeriod] = useState<"month" | "ytd">("month");
  const [blurred, setBlurred] = useState(true);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"income" | "expenses">("income");

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

  // Anchor an invoice to its shoot's date, not when the row was created
  // (backlogged/imported shoots all share an import date).
  const invMonth = (i: Invoice) => (i.shoots?.scheduled_at ?? i.created_at).slice(0, 7);
  const invYear = (i: Invoice) => (i.shoots?.scheduled_at ?? i.created_at).slice(0, 4);

  const unpaidInvoices = invoices.filter(i => !i.paid);
  const paidInvoices = invoices.filter(i => i.paid);
  const outstandingCents = unpaidInvoices.reduce((s, i) => s + i.amount_cents, 0);

  const monthlyBreakdown: Record<string, number> = {};
  for (const inv of paidInvoices) {
    const key = invMonth(inv);
    monthlyBreakdown[key] = (monthlyBreakdown[key] ?? 0) + inv.amount_cents / 100;
  }
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const cutoffKey = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}`;
  const months = Object.entries(monthlyBreakdown).filter(([k]) => k >= cutoffKey).sort(([a], [b]) => a.localeCompare(b));
  const maxMonth = Math.max(...Object.values(monthlyBreakdown), 1);

  const thisMonthPaid = paidInvoices.filter(i => invMonth(i) === thisMonthKey);
  const lastMonthPaid = paidInvoices.filter(i => invMonth(i) === lastMonthKey);
  const ytdPaid = paidInvoices.filter(i => invYear(i) === thisYear);

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

  // Invoice table is scoped to the selected period so it lines up with the
  // Shoot Expenses table on the other tab.
  const scopedInvoices = invoices.filter(i => period === "month" ? invMonth(i) === thisMonthKey : invYear(i) === thisYear);
  const scopedUnpaid = scopedInvoices.filter(i => !i.paid);
  const scopedPaid = scopedInvoices.filter(i => i.paid);
  const filtered = filter === "unpaid" ? scopedUnpaid : filter === "paid" ? scopedPaid : scopedInvoices;

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
            <button
              onClick={() => setTab("income")}
              className={`bg-[#0c0c0c] px-6 py-7 text-left border-t-2 transition-colors ${
                tab === "income" ? "border-t-white bg-[#111]" : "border-t-transparent hover:bg-white/[0.02]"
              }`}
            >
              <p className={`text-[10px] tracking-[3px] uppercase mb-3 ${tab === "income" ? "text-[#888]" : "text-[#444]"}`}>Income</p>
              <p className={`text-4xl font-black tabular-nums tracking-tight transition-all select-none ${blur}`}>{fmt(heroIncome)}</p>
              {period === "month" && momDiff !== null && (
                <p className={`text-xs mt-2 font-semibold ${momDiff >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                  {momDiff >= 0 ? "▲" : "▼"} {Math.abs(momDiff).toFixed(1)}% vs last month
                </p>
              )}
            </button>
            <button
              onClick={() => setTab("expenses")}
              className={`bg-[#0c0c0c] px-6 py-7 text-left border-t-2 transition-colors ${
                tab === "expenses" ? "border-t-[#f87171] bg-[#111]" : "border-t-transparent hover:bg-white/[0.02]"
              }`}
            >
              <p className={`text-[10px] tracking-[3px] uppercase mb-3 ${tab === "expenses" ? "text-[#888]" : "text-[#444]"}`}>Expenses</p>
              <p className={`text-4xl font-black tabular-nums tracking-tight text-[#f87171] transition-all select-none ${blur}`}>
                {pnlLoading && !pnl ? "—" : fmt(heroExpenses)}
              </p>
              {pnl && (
                <p className={`text-xs mt-2 text-[#555] select-none ${blur}`}>
                  {fmtc2((pnl.by_category.find(c => c.category === "Stripe fees")?.amount_cents) ?? 0)} Stripe ·{" "}
                  {fmtc2((pnl.by_category.find(c => c.category === "Gas (mileage)")?.amount_cents) ?? 0)} gas ·{" "}
                  {fmtc2((pnl.by_category.find(c => c.category === "Editing")?.amount_cents) ?? 0)} editing
                </p>
              )}
            </button>
            <div className="bg-[#0c0c0c] px-6 py-7 border-t-2 border-t-transparent">
              <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-3">Net Profit</p>
              <p className={`text-4xl font-black tabular-nums tracking-tight transition-all select-none ${blur} ${heroProfit >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                {pnlLoading && !pnl ? "—" : fmt(heroProfit)}
              </p>
              {pnl && (
                <p className={`text-xs mt-2 text-[#555] select-none ${blur}`}>
                  Leif&apos;s 50%: {fmtc2(pnl.memo.leif_profit_share_cents)}
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

        {/* ── Expenses tab ───────────────────────────────────────────── */}
        {tab === "expenses" && (
          <ExpensesSection
            pnl={pnl}
            loading={pnlLoading}
            period={period}
            expMonth={expMonth}
            setExpMonth={setExpMonth}
            onChanged={loadPnl}
            blur={blur}
          />
        )}

        {/* ── Income tab: invoices ───────────────────────────────────── */}
        {tab === "income" && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-[3px] uppercase text-[#555]">Invoices — {period === "month" ? monthNames[thisMonthKey.split("-")[1]] : thisYear}</p>
            <div className="flex gap-1">
              {(["all", "unpaid", "paid"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[9px] tracking-[1.5px] uppercase px-2.5 py-1 transition-all ${
                    filter === f ? "bg-white text-black font-bold" : "text-[#555] hover:text-white border border-white/10"
                  }`}
                >
                  {f === "all" ? `All (${scopedInvoices.length})` : f === "unpaid" ? `Unpaid (${scopedUnpaid.length})` : `Paid (${scopedPaid.length})`}
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
                const date = new Date(inv.shoots?.scheduled_at ?? inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
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
        )}

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
  const blankForm = { label: "", amount: "", category: "software", cadence: "monthly", recurring: true, note: "" };
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"category" | "az" | "price">("category");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const toggleCat = (c: string) => setExpandedCats(prev => {
    const next = new Set(prev);
    if (next.has(c)) next.delete(c); else next.add(c);
    return next;
  });

  const operating = useMemo(() => (pnl?.lines ?? []).filter(l => l.kind === "operating"), [pnl]);
  const [shootExpOpen, setShootExpOpen] = useState(false);

  // Operating lines grouped by category, in the canonical order.
  const byCat = useMemo(() => {
    const m = new Map<string, ExpenseLine[]>();
    for (const l of operating) { if (!m.has(l.category)) m.set(l.category, []); m.get(l.category)!.push(l); }
    const extras = [...m.keys()].filter(c => !EXPENSE_CATEGORIES.includes(c));
    return [...EXPENSE_CATEGORIES, ...extras]
      .filter(c => m.has(c))
      .map(c => {
        const lines = [...m.get(c)!].sort((a, b) => a.label.localeCompare(b.label));
        return { category: c, lines, total: lines.reduce((s, l) => s + moOf(l), 0) };
      });
  }, [operating]);

  const flatSorted = useMemo(() => {
    const arr = [...operating];
    if (sortBy === "az") arr.sort((a, b) => a.label.localeCompare(b.label));
    if (sortBy === "price") arr.sort((a, b) => moOf(b) - moOf(a));
    return arr;
  }, [operating, sortBy]);

  const opsTotal = operating.reduce((s, l) => s + moOf(l), 0);

  function openAdd() {
    if (adding) { closeForm(); return; }
    setForm(blankForm); setEditId(null); setErr(""); setAdding(true);
  }
  function openEdit(l: ExpenseLine) {
    setForm({
      label: l.label,
      amount: (l.amount_cents / 100).toFixed(2),
      category: l.category,
      cadence: l.cadence || "monthly",
      recurring: l.recurring ?? true,
      note: l.note || "",
    });
    setEditId(l.id); setAdding(false); setErr("");
  }
  function closeForm() { setAdding(false); setEditId(null); setErr(""); }

  async function submitForm() {
    const dollars = parseFloat(form.amount);
    if (!form.label.trim()) { setErr("Give it a name."); return; }
    if (!Number.isFinite(dollars) || dollars < 0) { setErr("Enter a valid amount."); return; }
    setSaving(true); setErr("");
    const payload = {
      label: form.label.trim(),
      amount_cents: Math.round(dollars * 100),
      category: form.category,
      cadence: form.cadence,
      recurring: form.recurring,
      note: form.note.trim() || null,
    };
    const r = await fetch("/api/admin/expenses", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editId ? { id: editId, ...payload } : { ...payload, month: period === "month" ? expMonth : undefined }),
    });
    setSaving(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Could not save."); return; }
    closeForm();
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
    closeForm();
    onChanged();
  }

  const expenseForm = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="What is it? (e.g. Adobe CC)"
          className="bg-[#0c0c0c] border border-white/15 focus:border-white/40 text-sm text-white px-3 py-2 outline-none flex-1 min-w-[160px]" />
        <div className="flex items-center border border-white/15 focus-within:border-white/40 bg-[#0c0c0c]">
          <span className="text-[#555] text-sm pl-2.5">$</span>
          <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
            className="bg-transparent text-sm text-white px-2 py-2 w-24 outline-none tabular-nums" />
        </div>
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          className="bg-[#0c0c0c] border border-white/15 text-sm text-white px-2 py-2 outline-none">
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
        </select>
        <select value={form.cadence} onChange={e => setForm(f => ({ ...f, cadence: e.target.value }))}
          className="bg-[#0c0c0c] border border-white/15 text-sm text-white px-2 py-2 outline-none">
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
          <option value="fluctuates">Fluctuates</option>
        </select>
      </div>
      {form.cadence === "annual" && (
        <p className="text-[10px] text-[#666]">
          Enter the <span className="text-[#999]">annual</span> cost — the budget shows it ÷12
          {parseFloat(form.amount) > 0 && ` (${fmtc2(Math.round(parseFloat(form.amount) * 100 / 12))}/mo)`}.
        </p>
      )}
      <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note (optional)"
        className="bg-[#0c0c0c] border border-white/15 focus:border-white/40 text-sm text-white px-3 py-2 outline-none w-full" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <label className="flex items-center gap-2 text-xs text-[#888] cursor-pointer">
          <input type="checkbox" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} className="accent-white" />
          Recurring — repeats every month automatically
        </label>
        <div className="flex items-center gap-2">
          {editId && (
            <button onClick={() => deleteLine(editId)} disabled={busyId === editId}
              className="text-[10px] tracking-[1.5px] uppercase px-3 py-2 border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40">
              Delete
            </button>
          )}
          <button onClick={closeForm} className="text-[10px] tracking-[1.5px] uppercase px-3 py-2 text-[#666] hover:text-white transition-colors">Cancel</button>
          <button onClick={submitForm} disabled={saving}
            className="text-xs tracking-[2px] uppercase bg-white text-black px-4 py-2 font-semibold hover:bg-white/90 transition-colors disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {err && <p className="text-[11px] text-red-400">{err}</p>}
    </div>
  );

  const rowEl = (l: ExpenseLine, opts?: { showCat?: boolean }) => (
    <div key={l.id} className="group grid grid-cols-[1fr_auto] gap-x-3 pl-8 pr-4 py-2 border-b border-white/[0.04] items-baseline">
      <div className="min-w-0 flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
        <span className="text-[13px] text-white">{l.label}</span>
        {opts?.showCat && <span className="text-[9px] tracking-[1px] uppercase text-[#666] border border-white/10 px-1">{CAT_LABEL[l.category] ?? l.category}</span>}
        {l.cadence === "annual" && <span className="text-[9px] tracking-[1px] uppercase text-[#888] border border-white/10 px-1">annual</span>}
        {l.cadence === "fluctuates" && <span className="text-[9px] tracking-[1px] uppercase text-[#fbbf24] border border-[#fbbf24]/20 px-1">fluctuates</span>}
        {l.auto_source && <span className="text-[9px] tracking-[1px] uppercase text-[#60a5fa] border border-[#60a5fa]/20 px-1">auto</span>}
        {!l.recurring && <span className="text-[9px] tracking-[1px] uppercase text-[#666] border border-white/10 px-1">one-time</span>}
        {l.note && <span className="text-[10px] text-[#555] truncate">{l.note}</span>}
      </div>
      <div className="flex items-center gap-2.5">
        <span className={`text-[13px] font-semibold tabular-nums select-none ${blur}`}>{fmtc2(moOf(l))}</span>
        <button onClick={() => openEdit(l)} title="Edit expense"
          className="text-[#777] hover:text-white transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </div>
    </div>
  );

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

          {/* Total expenses bar */}
          {pnl && (
            <div className="flex items-center justify-between bg-[#111] border border-white/[0.07] px-6 py-4">
              <span className="text-[11px] tracking-[2px] uppercase text-[#666]">Total expenses</span>
              <span className={`text-xl font-bold text-[#f87171] tabular-nums select-none ${blur}`}>{fmtc2(pnl.expense_cents)}</span>
            </div>
          )}

          {/* Operating budget */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <p className="text-[10px] tracking-[2px] uppercase text-[#666]">Operating budget</p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[9px] tracking-[1.5px] uppercase text-[#555]">
                  Sort by
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="bg-[#0c0c0c] border border-white/15 text-[10px] tracking-[1px] uppercase text-[#aaa] px-2 py-1 outline-none">
                    <option value="category">Category</option>
                    <option value="az">A–Z</option>
                    <option value="price">Price (high→low)</option>
                  </select>
                </label>
                <button onClick={openAdd} className="text-[9px] tracking-[1.5px] uppercase px-2.5 py-1 border border-white/15 text-[#888] hover:text-white hover:border-white/40 transition-all">
                  + Add expense
                </button>
              </div>
            </div>

            <div className="border border-white/[0.07]">
              {operating.length === 0 ? (
                <p className="px-4 py-5 text-center text-[#444] text-xs tracking-widest uppercase">
                  No operating expenses {period === "month" ? "this month" : "yet"}
                </p>
              ) : sortBy === "category" ? (
                byCat.map(grp => {
                  const open = expandedCats.has(grp.category);
                  return (
                    <div key={grp.category}>
                      <button onClick={() => toggleCat(grp.category)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] border-b border-white/[0.06] transition-colors text-left">
                        <span className="flex items-center gap-2">
                          <span className={`text-[#666] text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
                          <span className="text-[10px] tracking-[2px] uppercase text-[#999]">{CAT_LABEL[grp.category] ?? grp.category}</span>
                          <span className="text-[9px] text-[#555]">({grp.lines.length})</span>
                        </span>
                        <span className={`text-[12px] font-semibold tabular-nums text-white select-none ${blur}`}>{fmtc2(grp.total)}</span>
                      </button>
                      {open && grp.lines.map(l => rowEl(l))}
                    </div>
                  );
                })
              ) : (
                flatSorted.map(l => rowEl(l, { showCat: true }))
              )}
              {operating.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.04]">
                  <span className="text-[10px] tracking-[1px] uppercase text-[#888]">Operating subtotal</span>
                  <span className={`text-sm font-bold tabular-nums select-none ${blur}`}>{fmtc2(opsTotal)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Shoot expenses — per-shoot Stripe fee + gas + editing */}
          {pnl && (
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#666] mb-2">Shoot expenses</p>
              <div className="border border-white/[0.07]">
                <button onClick={() => setShootExpOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-left">
                  <span className="flex items-center gap-2">
                    <span className={`text-[#666] text-[10px] transition-transform ${shootExpOpen ? "rotate-90" : ""}`}>▶</span>
                    <span className="text-[10px] tracking-[2px] uppercase text-[#999]">Stripe fees · gas · editing</span>
                    <span className="text-[9px] text-[#555]">({pnl.shoot_expenses.length} shoot{pnl.shoot_expenses.length === 1 ? "" : "s"})</span>
                  </span>
                  <span className={`text-[12px] font-semibold tabular-nums text-white select-none ${blur}`}>{fmtc2(pnl.shoot_expense_cents)}</span>
                </button>
                {shootExpOpen && <ShootExpenseTable rows={pnl.shoot_expenses} blur={blur} />}
              </div>
            </div>
          )}

          {/* Memo / reference lines */}
          {pnl && (
            <div className="border border-white/[0.07] bg-white/[0.01] px-4 py-3 text-xs text-[#666] space-y-1.5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">For reference — not subtracted from profit</p>
              <div className="flex justify-between">
                <span>IRS mileage deduction ({pnl.memo.mileage_miles.toLocaleString()} mi · tax season)</span>
                <span className={`tabular-nums text-[#888] select-none ${blur}`}>{fmtc2(pnl.memo.mileage_deduction_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Leif&apos;s share (50% of profit on shoots he sourced)</span>
                <span className={`tabular-nums text-[#888] select-none ${blur}`}>{fmtc2(pnl.memo.leif_profit_share_cents)}</span>
              </div>
            </div>
          )}

          {/* Mileage report */}
          <MileageReport blur={blur} />
        </div>
      )}

      {/* Add / edit expense modal */}
      {(adding || editId) && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={closeForm}>
          <div className="bg-[#111] border border-white/10 p-5 max-w-2xl w-full my-8" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] tracking-[3px] uppercase text-[#666] mb-4">{editId ? "Edit expense" : "New expense"}</p>
            {expenseForm}
          </div>
        </div>
      )}
    </section>
  );
}

const COLS = "grid grid-cols-[52px_1fr_100px_74px_66px_72px_86px_92px] gap-x-3 min-w-[680px]";

function ShootExpenseTable({ rows, blur }: { rows: ShootExpenseRow[]; blur: string }) {
  if (rows.length === 0) {
    return <p className="px-4 py-5 text-center text-[#444] text-xs tracking-widest uppercase border-t border-white/[0.07]">No shoots this month</p>;
  }
  const t = rows.reduce(
    (a, r) => ({
      stripe: a.stripe + r.stripe_cents, gas: a.gas + r.gas_cents, editing: a.editing + r.editing_cents,
      expense: a.expense + r.expense_cents, profit: a.profit + r.profit_cents,
    }),
    { stripe: 0, gas: 0, editing: 0, expense: 0, profit: 0 }
  );
  const md = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  return (
    <div className="border-t border-white/[0.07] overflow-x-auto">
      <div className={`${COLS} px-4 py-2 border-b border-white/[0.07]`}>
        {["Date", "Property", "Client", "Stripe", "Gas", "Editing", "Shoot exp.", "Profit"].map(h => (
          <span key={h} className="text-[9px] tracking-[1.5px] uppercase text-[#333]">{h}</span>
        ))}
      </div>
      {rows.map(r => (
        <div key={r.shoot_id} className={`${COLS} px-4 py-2 border-b border-white/[0.04] items-center`}>
          <span className="text-[11px] text-[#555] tabular-nums">{md(r.date)}</span>
          <span className="text-[12px] truncate" title={r.address}>{r.address}</span>
          <span className="text-[11px] text-[#888] truncate">{r.client}</span>
          <span className={`text-[11px] tabular-nums text-[#aaa] select-none ${blur}`}>{fmtc2(r.stripe_cents)}</span>
          <span className={`text-[11px] tabular-nums text-[#aaa] select-none ${blur}`}>{fmtc2(r.gas_cents)}</span>
          <span className={`text-[11px] tabular-nums text-[#aaa] select-none ${blur}`}>{fmtc2(r.editing_cents)}</span>
          <span className={`text-[11px] tabular-nums font-semibold select-none ${blur}`}>{fmtc2(r.expense_cents)}</span>
          <span
            className={`text-[11px] tabular-nums font-semibold select-none ${blur} ${
              !r.revenue_paid ? "text-[#fbbf24]" : r.profit_cents >= 0 ? "text-[#4ade80]" : "text-[#f87171]"
            }`}
            title={r.revenue_paid ? "" : "Invoice not paid yet — expected"}
          >
            {fmtc2(r.profit_cents)}
          </span>
        </div>
      ))}
      <div className={`${COLS} px-4 py-2.5 bg-white/[0.04] items-center`}>
        <span className="text-[9px] tracking-[1px] uppercase text-[#888]">Total</span>
        <span /><span />
        <span className={`text-[11px] tabular-nums font-semibold select-none ${blur}`}>{fmtc2(t.stripe)}</span>
        <span className={`text-[11px] tabular-nums font-semibold select-none ${blur}`}>{fmtc2(t.gas)}</span>
        <span className={`text-[11px] tabular-nums font-semibold select-none ${blur}`}>{fmtc2(t.editing)}</span>
        <span className={`text-[12px] tabular-nums font-bold select-none ${blur}`}>{fmtc2(t.expense)}</span>
        <span className={`text-[12px] tabular-nums font-bold select-none ${blur} ${t.profit >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>{fmtc2(t.profit)}</span>
      </div>
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
                <span className={`text-[11px] tabular-nums select-none ${blur}`}>{fmtc2(r.gas_cents)}</span>
                <span className={`text-[11px] text-[#888] tabular-nums select-none ${blur}`}>{fmtc2(r.deduction_cents)}</span>
              </div>
            ))}
            {totals && (
              <div className="grid grid-cols-[92px_1fr_60px_80px_90px_100px] gap-x-3 px-4 py-2.5 bg-white/[0.02] items-center min-w-[520px]">
                <span className="text-[10px] tracking-[1px] uppercase text-[#666]">Total</span>
                <span />
                <span />
                <span className="text-[11px] font-semibold tabular-nums">{totals.miles.toFixed(0)}</span>
                <span className={`text-[11px] font-semibold tabular-nums select-none ${blur}`}>{fmtc2(totals.gas_cents)}</span>
                <span className={`text-[11px] font-semibold tabular-nums select-none ${blur}`}>{fmtc2(totals.deduction_cents)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
