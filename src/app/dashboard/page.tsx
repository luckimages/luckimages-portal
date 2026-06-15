"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type KPI = {
  revMonth: number;
  revYTD: number;
  netIncome: number;
  expenses: number;
  ytdInvoices: number;
  unpaidCount: number;
  recentInvoices: { num: string; client: string; date: string; amount: string; paid: boolean }[];
  monthly: { month: string; rev: number }[];
  syncedAt: string | null;
};

const DEFAULT_KPI: KPI = {
  revMonth: 0,
  revYTD: 0,
  netIncome: 0,
  expenses: 0,
  ytdInvoices: 0,
  unpaidCount: 0,
  recentInvoices: [],
  monthly: [],
  syncedAt: null,
};

function fmtClock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtHours(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0 && m === 0) return "0m";
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function weekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function Card({ label, value, sub, accent = "#ffffff", valueClass = "", children }: {
  label: string; value?: string; sub?: string; accent?: string; valueClass?: string; children?: React.ReactNode;
}) {
  return (
    <div className="bg-[#111] border border-white/10 p-6" style={{ borderBottom: `2px solid ${accent}` }}>
      <p className="text-xs tracking-[2px] uppercase text-[#666] mb-4">{label}</p>
      {value && <p className={`text-3xl font-bold transition-all duration-200 ${valueClass}`}>{value}</p>}
      {sub && <p className="text-xs text-[#444] mt-2">{sub}</p>}
      {children}
    </div>
  );
}

function EditableNumber({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="bg-transparent text-3xl font-bold w-full outline-none border-b border-transparent focus:border-white/20 pb-0.5 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

export default function DashboardPage() {
  const [QB, setQB] = useState<KPI>(DEFAULT_KPI);
  const avgPerShoot = QB.ytdInvoices > 0 ? Math.round(QB.revYTD / QB.ytdInvoices) : 0;

  type Section = "Revenue" | "Monthly Revenue" | "Clients" | "Services" | "Marketing" | "Capacity" | "Recent Invoices";
  const DEFAULT_ORDER: Section[] = ["Revenue", "Monthly Revenue", "Clients", "Services", "Marketing", "Capacity", "Recent Invoices"];
  const DEFAULT_VISIBLE: Record<Section, boolean> = { Revenue: true, "Monthly Revenue": true, Clients: true, Services: true, Marketing: true, Capacity: true, "Recent Invoices": true };

  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [pendingShoots, setPendingShoots] = useState<Array<{
    id: string; address: string; scheduled_at: string; services: string[];
    notes: string; square_footage: number | null; client_email: string;
  }>>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [order, setOrder] = useState<Section[]>(DEFAULT_ORDER);
  const [visible, setVisible] = useState<Record<Section, boolean>>(DEFAULT_VISIBLE);

  // Time tracker state
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [myWeekSeconds, setMyWeekSeconds] = useState(0);
  const [partnerWeekSeconds, setPartnerWeekSeconds] = useState(0);
  const [partnerName, setPartnerName] = useState("");
  const [partnerActive, setPartnerActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const uid = data.user.id;
      const meta = data.user?.user_metadata;
      setUserId(uid);
      setUserName((meta?.full_name || data.user?.email || "").toUpperCase());
      if (meta?.section_order) setOrder(meta.section_order as Section[]);
      if (meta?.section_visible) setVisible(meta.section_visible as Record<Section, boolean>);

      // Load live QB KPI snapshot
      const { data: snap } = await supabase
        .from("kpi_snapshots")
        .select("*")
        .eq("id", 1)
        .single();
      if (snap) {
        const breakdown: Record<string, number> = snap.monthly_breakdown || {};
        const year = new Date().getFullYear();
        const monthly = Object.entries(breakdown)
          .filter(([k]) => k.startsWith(`${year}-`))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => ({ month: MONTH_NAMES[parseInt(k.split("-")[1]) - 1], rev: v as number }));
        setQB({
          revMonth: snap.rev_month ?? 0,
          revYTD: snap.rev_ytd ?? 0,
          netIncome: snap.net_income ?? 0,
          expenses: snap.expenses_ytd ?? 0,
          ytdInvoices: snap.ytd_invoices ?? 0,
          unpaidCount: snap.unpaid_count ?? 0,
          recentInvoices: (snap.recent_invoices ?? []).map((i: { num: string; client: string; date: string; amount: string; paid: boolean }) => ({
            num: i.num,
            client: i.client,
            date: i.date,
            amount: i.amount,
            paid: i.paid,
          })),
          monthly,
          syncedAt: snap.synced_at ?? null,
        });
      }

      // Load pending shoot requests
      const { data: pending } = await supabase
        .from("shoots")
        .select("id, address, scheduled_at, services, notes, square_footage, client_id")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (pending) {
        setPendingShoots(pending.map(s => ({ ...s, client_email: s.client_id })));
      }

      // Load active timer entry
      const { data: active } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", uid)
        .is("stopped_at", null)
        .single();
      if (active) {
        setActiveEntryId(active.id);
        setTimerStart(new Date(active.started_at));
        setElapsed(Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000));
      }

      // Load this week's stats for all admins
      const ws = weekStart();
      const { data: weekEntries } = await supabase
        .from("time_entries")
        .select("user_id, user_name, duration_seconds, started_at, stopped_at")
        .gte("started_at", ws.toISOString());

      if (weekEntries) {
        let myTotal = 0;
        let partnerTotal = 0;
        let pName = "";
        const now = Date.now();
        weekEntries.forEach(e => {
          const secs = e.stopped_at
            ? (e.duration_seconds || 0)
            : Math.floor((now - new Date(e.started_at).getTime()) / 1000);
          if (e.user_id === uid) {
            myTotal += secs;
          } else {
            partnerTotal += secs;
            pName = e.user_name;
            if (!e.stopped_at) setPartnerActive(true);
          }
        });
        setMyWeekSeconds(myTotal);
        setPartnerWeekSeconds(partnerTotal);
        setPartnerName(pName);
      }
    });
  }, []);

  // Live clock tick
  useEffect(() => {
    if (timerStart) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - timerStart.getTime()) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerStart]);

  async function startTimer() {
    const supabase = createClient();
    const name = userName || "Unknown";
    const { data } = await supabase
      .from("time_entries")
      .insert({ user_id: userId, user_name: name, started_at: new Date().toISOString() })
      .select()
      .single();
    if (data) {
      setActiveEntryId(data.id);
      setTimerStart(new Date(data.started_at));
      setElapsed(0);
    }
  }

  async function stopTimer() {
    if (!activeEntryId) return;
    const supabase = createClient();
    const stoppedAt = new Date().toISOString();
    await supabase.from("time_entries").update({
      stopped_at: stoppedAt,
      duration_seconds: elapsed,
    }).eq("id", activeEntryId);
    setActiveEntryId(null);
    setTimerStart(null);
    setMyWeekSeconds(s => s + elapsed);
    setElapsed(0);
  }

  async function approveShoot(id: string) {
    setApprovingId(id);
    const supabase = createClient();
    await supabase.from("shoots").update({ status: "scheduled" }).eq("id", id);
    setPendingShoots(prev => prev.filter(s => s.id !== id));
    setApprovingId(null);
  }

  async function declineShoot(id: string) {
    setApprovingId(id);
    const supabase = createClient();
    await supabase.from("shoots").update({ status: "cancelled" }).eq("id", id);
    setPendingShoots(prev => prev.filter(s => s.id !== id));
    setApprovingId(null);
  }

  function savePrefs(newOrder: Section[], newVisible: Record<Section, boolean>) {
    createClient().auth.updateUser({ data: { section_order: newOrder, section_visible: newVisible } });
  }

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (s: Section) => {
    const next = { ...visible, [s]: !visible[s] };
    setVisible(next);
    savePrefs(order, next);
  };
  const moveSection = (s: Section, dir: -1 | 1) => {
    setOrder(prev => {
      const next = [...prev];
      const i = next.indexOf(s);
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      savePrefs(next, visible);
      return next;
    });
  };

  const [hideRevenue, setHideRevenue] = useState(false);
  const blur = hideRevenue ? "blur-sm select-none" : "";

  const [referrals, setReferrals] = useState(0);
  const [coldCalls, setColdCalls] = useState(0);
  const [leads, setLeads] = useState(0);
  const [bookings, setBookings] = useState(0);
  const [capTotal, setCapTotal] = useState(50);
  const capPct = capTotal > 0 ? Math.min(100, Math.round(((QB.ytdInvoices || 0) / capTotal) * 100)) : 0;
  const convPct = leads > 0 ? Math.min(100, Math.round((bookings / leads) * 100)) : 0;

  const sectionLabel = "text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']";

  function renderSection(s: Section) {
    if (!visible[s]) return null;
    if (s === "Revenue") return (
      <section key={s}>
        <div className="flex items-center gap-3 mb-4">
          <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-[''] flex-1">Revenue</p>
          <button onClick={() => setHideRevenue(h => !h)} className={`transition-colors flex-shrink-0 ${hideRevenue ? "text-[#fbbf24]" : "text-[#555] hover:text-white"}`} title={hideRevenue ? "Show revenue" : "Hide revenue"}>
            {hideRevenue ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Revenue This Month" value={`$${QB.revMonth.toLocaleString()}`} accent="#4ade80" sub="Current billing period" valueClass={blur} />
          <Card label="Revenue YTD" value={`$${QB.revYTD.toLocaleString()}`} accent="#4ade80" sub="Year to date" valueClass={blur} />
          <Card label="Net Income YTD" value={`$${QB.netIncome.toLocaleString()}`} accent="#4ade80" sub="Year to date" valueClass={blur} />
          <Card label="Unpaid Invoices" value={QB.unpaidCount.toString()} accent="#fbbf24" sub="Outstanding balance" />
        </div>
      </section>
    );
    if (s === "Monthly Revenue") return (
      <section key={s}>
        <p className={sectionLabel}>Monthly Revenue — {new Date().getFullYear()}</p>
        {QB.monthly.length === 0 ? (
          <div className="bg-[#111] border border-white/10 p-8 text-center">
            <p className="text-[#444] text-sm">No invoice data yet — add invoices in QuickBooks and they&apos;ll appear here after the next sync.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {QB.monthly.map((m) => {
              const maxRev = Math.max(...QB.monthly.map(x => x.rev), 1);
              const pct = Math.round((m.rev / maxRev) * 100);
              return (
                <div key={m.month} className="bg-[#111] border border-white/10 p-5">
                  <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">{m.month}</p>
                  <p className={`text-xl font-bold mb-3 transition-all duration-200 ${blur}`}>${m.rev.toLocaleString()}</p>
                  <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                    <div className="h-full bg-white/40 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
    if (s === "Clients") return (
      <section key={s}>
        <p className={sectionLabel}>Clients — YTD</p>
        <div className="grid grid-cols-3 gap-3">
          <Card label="Invoices YTD" value={QB.ytdInvoices.toString()} accent="#60a5fa" sub="Total invoices this year" />
          <Card label="Avg per Invoice" value={avgPerShoot > 0 ? `$${avgPerShoot.toLocaleString()}` : "—"} accent="#4ade80" sub="YTD average" valueClass={blur} />
          <Card label="Referrals" accent="#a78bfa">
            <EditableNumber value={referrals} onChange={setReferrals} />
            <p className="text-xs text-[#444] mt-2">Click to edit</p>
          </Card>
        </div>
      </section>
    );
    if (s === "Services") return (
      <section key={s}>
        <p className={sectionLabel}>Services — YTD Bookings</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Listing Photos", value: "—" },
            { label: "Drone", value: "—" },
            { label: "Matterport", value: "—" },
            { label: "Video", value: "—" },
            { label: "Headshots", value: "—" },
          ].map(item => (
            <div key={item.label} className="bg-[#111] border border-white/10 p-5">
              <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">{item.label}</p>
              <p className="text-2xl font-bold text-[#555]">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    );
    if (s === "Marketing") return (
      <section key={s}>
        <p className={sectionLabel}>Marketing — This Month</p>
        <div className="grid grid-cols-3 gap-3">
          <Card label="Cold Calls Made" accent="#fbbf24">
            <EditableNumber value={coldCalls} onChange={setColdCalls} />
            <p className="text-xs text-[#444] mt-2">Click to edit</p>
          </Card>
          <Card label="Leads Generated" accent="#60a5fa">
            <EditableNumber value={leads} onChange={setLeads} />
            <p className="text-xs text-[#444] mt-2">Click to edit</p>
          </Card>
          <Card label="Bookings from Marketing" accent="#4ade80">
            <EditableNumber value={bookings} onChange={setBookings} />
            <p className="text-xs text-[#444] mt-2">Click to edit</p>
          </Card>
        </div>
      </section>
    );
    if (s === "Capacity") return (
      <section key={s}>
        <p className={sectionLabel}>Capacity</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111] border border-white/10 p-6">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-4">Capacity Utilized</p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold">{QB.ytdInvoices || 0}</span>
              <span className="text-[#555]">/</span>
              <input
                type="number"
                value={capTotal}
                onChange={e => setCapTotal(Number(e.target.value))}
                className="text-3xl font-bold bg-transparent w-20 outline-none border-b border-transparent focus:border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <p className="text-xs text-[#444] mb-3">Shoots completed / monthly capacity (click to edit)</p>
            <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${capPct}%` }} />
            </div>
            <p className="text-xs text-[#666] mt-2">{capPct}% utilized</p>
          </div>
          <div className="bg-[#111] border border-white/10 p-6">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-4">Lead Conversion Rate</p>
            <p className="text-3xl font-bold mb-4">{leads > 0 ? `${convPct}%` : "—"}</p>
            <p className="text-xs text-[#444] mb-3">Bookings ÷ Leads</p>
            <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${convPct}%`, background: "#60a5fa" }} />
            </div>
            <p className="text-xs text-[#666] mt-2">{leads > 0 ? `${bookings} of ${leads} leads converted` : "Enter leads and bookings above"}</p>
          </div>
        </div>
      </section>
    );
    if (s === "Recent Invoices") return (
      <section key={s}>
        <p className={sectionLabel}>Recent Invoices</p>
        {QB.recentInvoices.length === 0 ? (
          <div className="bg-[#111] border border-white/10 p-8 text-center">
            <p className="text-[#444] text-sm">No invoices yet — add them in QuickBooks and they&apos;ll appear here after the next sync.</p>
          </div>
        ) : (
          <div className="bg-[#111] border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {["Invoice", "Client", "Date", "Amount", "Status"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {QB.recentInvoices.map(inv => (
                  <tr key={inv.num} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-[#888]">#{inv.num}</td>
                    <td className="px-5 py-3">{inv.client}</td>
                    <td className="px-5 py-3 text-[#888]">{inv.date}</td>
                    <td className={`px-5 py-3 font-medium transition-all duration-200 ${blur}`}>{inv.amount}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs tracking-[1px] uppercase px-2 py-1 ${inv.paid ? "bg-[#4ade8018] text-[#4ade80]" : "bg-[#fbbf2418] text-[#fbbf24]"}`}>
                        {inv.paid ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
    return null;
  }

  const isRunning = !!timerStart;
  const myName = userName.split(" ")[0] || "You";

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <div className="flex items-center gap-6">
          <a href="/admin/invite" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Invite Photographer</a>
          <span className="text-xs tracking-[2px] uppercase text-[#666]">Admin</span>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 px-8 py-12 max-w-7xl mx-auto w-full space-y-12">

        {/* TITLE */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#666] mb-2">Welcome back</p>
            <div className="flex items-center gap-5">
              <h1 className="text-4xl font-black tracking-tight uppercase">{userName || "Dashboard"}</h1>
              <button
                onClick={isRunning ? stopTimer : startTimer}
                className={`text-xs tracking-[3px] uppercase font-semibold px-4 py-2 transition-colors flex items-center gap-2 ${
                  isRunning
                    ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                    : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                }`}
              >
                {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                {isRunning ? `Stop  ${fmtClock(elapsed)}` : "Start Timer"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <p className="text-xs tracking-[2px] uppercase text-[#444]">
              {QB.syncedAt
                ? `Last synced: ${new Date(QB.syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`
                : "Syncing..."}
            </p>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="text-xs tracking-[2px] uppercase text-white flex items-center gap-1.5 hover:text-white/70 transition-colors"
              >
                Sections
                <span className="text-[10px]">{menuOpen ? "▲" : "▼"}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 bg-[#181818] border border-white/10 py-2 z-50 min-w-[200px]">
                  <button
                    onClick={() => { setOrder(DEFAULT_ORDER); setVisible(DEFAULT_VISIBLE); savePrefs(DEFAULT_ORDER, DEFAULT_VISIBLE); }}
                    className="w-full text-left px-3 py-2 text-xs tracking-[2px] uppercase text-[#666] hover:text-white hover:bg-white/5 transition-colors border-b border-white/10 mb-1"
                  >
                    Reset to Default
                  </button>
                  {order.map((s, i) => (
                    <div key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors">
                      <input type="checkbox" checked={visible[s]} onChange={() => toggle(s)} className="accent-white w-3 h-3 cursor-pointer flex-shrink-0" />
                      <span className="text-xs tracking-[2px] uppercase text-white flex-1">{s}</span>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveSection(s, -1)} disabled={i === 0} className="text-[#555] hover:text-white disabled:opacity-20 leading-none text-[10px]">▲</button>
                        <button onClick={() => moveSection(s, 1)} disabled={i === order.length - 1} className="text-[#555] hover:text-white disabled:opacity-20 leading-none text-[10px]">▼</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>


        {/* PENDING SHOOT REQUESTS */}
        <section>
          <p className="text-xs tracking-[4px] uppercase mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            {pendingShoots.length > 0 ? (
              <span className="text-[#fbbf24] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-pulse" />
                Pending Approval — {pendingShoots.length} Request{pendingShoots.length > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-[#555]">Shoot Requests</span>
            )}
          </p>
          {pendingShoots.length === 0 ? (
            <div className="bg-[#111] border border-white/10 p-8 text-center">
              <p className="text-[#444] text-sm">No pending requests — you're all caught up.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingShoots.map(s => (
                <div key={s.id} className="bg-[#111] border border-[#fbbf24]/20 p-6 flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1">Address</p>
                      <p className="text-sm font-semibold">{s.address}</p>
                    </div>
                    <div>
                      <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1">Requested Date</p>
                      <p className="text-sm">{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "TBD"}</p>
                    </div>
                    <div>
                      <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1">Services</p>
                      <p className="text-sm text-[#888]">{s.services?.join(", ") || "—"}</p>
                    </div>
                    {s.square_footage && (
                      <div>
                        <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1">Sq Ft</p>
                        <p className="text-sm text-[#888]">{s.square_footage.toLocaleString()}</p>
                      </div>
                    )}
                    {s.notes && (
                      <div className="col-span-2 md:col-span-4">
                        <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1">Notes</p>
                        <p className="text-sm text-[#888]">{s.notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 flex-shrink-0">
                    <button
                      onClick={() => approveShoot(s.id)}
                      disabled={approvingId === s.id}
                      className="text-xs tracking-[3px] uppercase bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/30 px-6 py-3 hover:bg-[#4ade80]/20 transition-colors disabled:opacity-40"
                    >
                      {approvingId === s.id ? "..." : "Confirm ✓"}
                    </button>
                    <button
                      onClick={() => declineShoot(s.id)}
                      disabled={approvingId === s.id}
                      className="text-xs tracking-[3px] uppercase bg-red-500/10 text-red-400 border border-red-500/20 px-6 py-3 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {order.map(renderSection)}

        {/* TIME STATS — compact, always at bottom */}
        <section>
          <p className={sectionLabel}>Time Tracker — This Week</p>
          <div className="bg-[#111] border border-white/10 p-5 flex items-center gap-8">
            <div className="flex items-center gap-3">
              {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse flex-shrink-0" />}
              <span className="text-xs tracking-[2px] uppercase text-[#666]">{myName}</span>
              <span className="text-sm font-bold">{fmtHours(myWeekSeconds + (isRunning ? elapsed : 0))}</span>
              {isRunning && <span className="text-xs text-[#4ade80] font-mono">{fmtClock(elapsed)}</span>}
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-3">
              {partnerActive && <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-pulse flex-shrink-0" />}
              <span className="text-xs tracking-[2px] uppercase text-[#666]">{partnerName || (userName.includes("RYAN") ? "Leif" : "Ryan")}</span>
              <span className="text-sm font-bold">{fmtHours(partnerWeekSeconds)}</span>
              {partnerActive && <span className="text-xs text-[#60a5fa] tracking-[1px] uppercase">Live</span>}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
