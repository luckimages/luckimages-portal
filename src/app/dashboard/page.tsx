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

  type Section = "Revenue" | "Monthly Revenue" | "Clients" | "Services" | "Marketing" | "Capacity" | "Recent Invoices" | "Realtors" | "Schedule" | "Contacts" | "Cold Calls";
  const DEFAULT_ORDER: Section[] = ["Schedule", "Contacts", "Cold Calls", "Revenue", "Monthly Revenue", "Clients", "Services", "Marketing", "Capacity", "Recent Invoices", "Realtors"];
  const DEFAULT_VISIBLE: Record<Section, boolean> = { Schedule: true, Revenue: true, "Monthly Revenue": true, Clients: true, Services: true, Marketing: true, Capacity: true, "Recent Invoices": true, Realtors: true, Contacts: true, "Cold Calls": true };

  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [pendingShoots, setPendingShoots] = useState<Array<{
    id: string; address: string; scheduled_at: string; services: string[];
    notes: string; square_footage: number | null; client_name: string; client_email: string;
  }>>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [shootPhotographers, setShootPhotographers] = useState<Record<string, string[]>>({});
  const [photographers, setPhotographers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [order, setOrder] = useState<Section[]>(DEFAULT_ORDER);
  const [visible, setVisible] = useState<Record<Section, boolean>>(DEFAULT_VISIBLE);

  // Contacts + Cold Calls state
  type Contact = { id: string; name: string; email: string | null; phone: string | null; brokerage: string | null; stage: string; is_hot: boolean; total_invoices: number; total_revenue: number; };
  type CallLog = { id: string; contact_id: string; outcome: string; called_at: string; notes: string | null; listing_address: string | null; called_by: string; };
  const CALL_OUTCOMES = [
    { value: "no_answer", label: "No Answer", color: "bg-zinc-700 text-zinc-300" },
    { value: "not_interested", label: "Not Interested", color: "bg-red-900 text-red-300" },
    { value: "interested", label: "Interested", color: "bg-blue-900 text-blue-300" },
    { value: "callback", label: "Callback", color: "bg-yellow-900 text-yellow-300" },
    { value: "booked", label: "Booked!", color: "bg-green-900 text-green-300" },
  ];
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [activeCallContact, setActiveCallContact] = useState<Contact | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ name: "", email: "", phone: "", brokerage: "", stage: "lead" });
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [callOutcome, setCallOutcome] = useState("");
  const [callNote, setCallNote] = useState("");
  const [loggingCall, setLoggingCall] = useState(false);
  const [todayCalls, setTodayCalls] = useState(0);
  const DAILY_GOAL = 20;

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
      if (meta?.section_order) {
        const saved = meta.section_order as Section[];
        // Merge: keep saved order, append any new sections not yet in prefs
        const merged = [...saved, ...DEFAULT_ORDER.filter(s => !saved.includes(s))];
        setOrder(merged);
      }
      if (meta?.section_visible) {
        const saved = meta.section_visible as Record<Section, boolean>;
        // Merge: apply saved visibility, default new sections to visible
        const merged = { ...DEFAULT_VISIBLE, ...saved };
        setVisible(merged);
      }

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

      // Load contacts + call logs
      const [{ data: cs }, { data: cls }] = await Promise.all([
        supabase.from("contacts").select("*").order("name", { ascending: true }),
        supabase.from("cold_calls").select("*").order("called_at", { ascending: false }).limit(200),
      ]);
      setContacts(cs || []);
      setCallLogs(cls || []);
      const today = new Date().toISOString().split("T")[0];
      setTodayCalls((cls || []).filter((l: CallLog) => l.called_at.startsWith(today)).length);

      // Load pending shoot requests (server-side to resolve client names)
      const shootsRes = await fetch("/api/admin/shoots");
      if (shootsRes.ok) setPendingShoots(await shootsRes.json());

      // Load photographers for assignment dropdown
      const pgRes = await fetch("/api/admin/photographers");
      if (pgRes.ok) setPhotographers(await pgRes.json());

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

      // Load realtors
      const realtorRes = await fetch("/api/admin/realtors");
      if (realtorRes.ok) setRealtors(await realtorRes.json());

      // Load all upcoming shoots for calendar
      const allShootsRes = await fetch("/api/admin/shoots?all=1");
      if (allShootsRes.ok) setAllShoots(await allShootsRes.json());
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
    const { data, error } = await supabase
      .from("time_entries")
      .insert({ user_id: userId, user_name: name, started_at: new Date().toISOString() })
      .select()
      .single();
    if (error) {
      console.error("startTimer error:", error);
      alert("Timer error: " + error.message);
      return;
    }
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

  async function refreshShoots() {
    const [pendingRes, allRes] = await Promise.all([
      fetch("/api/admin/shoots"),
      fetch("/api/admin/shoots?all=1"),
    ]);
    if (pendingRes.ok) setPendingShoots(await pendingRes.json());
    if (allRes.ok) setAllShoots(await allRes.json());
  }

  async function approveShoot(id: string) {
    setApprovingId(id);
    const photographer_ids = shootPhotographers[id]?.length ? shootPhotographers[id] : [];
    await fetch("/api/admin/shoots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "scheduled", photographer_ids }) });
    await refreshShoots();
    setApprovingId(null);
  }

  function toggleShootPhotographer(shootId: string, photographerId: string) {
    setShootPhotographers(prev => {
      const current = prev[shootId] || [];
      const updated = current.includes(photographerId)
        ? current.filter(id => id !== photographerId)
        : [...current, photographerId];
      return { ...prev, [shootId]: updated };
    });
  }

  async function generateClientInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true);
    setInviteLink("");
    const res = await fetch("/api/admin/invite-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, name: inviteName }),
    });
    const data = await res.json();
    setInviteLoading(false);
    if (data.link) setInviteLink(data.link);
  }

  async function declineShoot(id: string) {
    setApprovingId(id);
    await fetch("/api/admin/shoots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "cancelled" }) });
    await refreshShoots();
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

  type Realtor = { id: string; full_name: string; email: string; phone: string | null; brokerage: string | null; referral_source: string | null; created_at: string };
  const [realtors, setRealtors] = useState<Realtor[]>([]);
  const [realtorTab, setRealtorTab] = useState<"all" | "new">("all");

  type ShootEvent = { id: string; address: string; scheduled_at: string; services: string[]; notes: string; square_footage: number | null; client_name: string; client_email: string; status: string };
  const [allShoots, setAllShoots] = useState<ShootEvent[]>([]);
  const [calWeekOffset, setCalWeekOffset] = useState(0);

  const [qbSyncing, setQbSyncing] = useState(false);

  async function syncQB() {
    setQbSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-qb", { method: "POST" });
      if (res.ok) {
        const snap = await res.json();
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
          recentInvoices: snap.recent_invoices ?? [],
          monthly,
          syncedAt: snap.synced_at ?? null,
        });
      }
    } finally {
      setQbSyncing(false);
    }
  }

  const [hideRevenue, setHideRevenue] = useState(true);
  const blur = hideRevenue ? "blur-sm select-none" : "";

  const [referrals, setReferrals] = useState(0);
  const [coldCalls, setColdCalls] = useState(0);
  const [leads, setLeads] = useState(0);
  const [bookings, setBookings] = useState(0);
  const [capTotal, setCapTotal] = useState(50);
  const capPct = capTotal > 0 ? Math.min(100, Math.round(((QB.ytdInvoices || 0) / capTotal) * 100)) : 0;
  const convPct = leads > 0 ? Math.min(100, Math.round((bookings / leads) * 100)) : 0;

  const sectionLabel = "text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']";

  async function saveQuickContact(e: React.FormEvent) {
    e.preventDefault();
    if (!quickAddForm.name.trim()) return;
    setQuickAddSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from("contacts").insert({ ...quickAddForm, type: "lead" }).select().single();
    if (data) setContacts(cs => [...cs, data].sort((a, b) => a.name.localeCompare(b.name)));
    setQuickAddSaving(false);
    setShowQuickAdd(false);
    setQuickAddForm({ name: "", email: "", phone: "", brokerage: "", stage: "lead" });
  }

  function renderSection(s: Section) {
    if (!visible[s]) return null;
    if (s === "Schedule") {
      // Build week days based on offset
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sun
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + calWeekOffset * 7);
      monday.setHours(0, 0, 0, 0);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
      });
      const weekLabel = `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      return (
        <section key={s}>
          <div className="flex items-center gap-4 mb-4">
            <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-[''] flex-1">
              Schedule
            </p>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button onClick={() => setCalWeekOffset(o => o - 1)} className="text-[#555] hover:text-white transition-colors px-2 py-1 text-sm">←</button>
              <span className="text-xs tracking-[2px] uppercase text-[#666]">{weekLabel}</span>
              <button onClick={() => setCalWeekOffset(o => o + 1)} className="text-[#555] hover:text-white transition-colors px-2 py-1 text-sm">→</button>
              {calWeekOffset !== 0 && (
                <button onClick={() => setCalWeekOffset(0)} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors">Today</button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, i) => {
              const isToday = day.toDateString() === today.toDateString();
              const dayStr = day.toISOString().split("T")[0];
              const dayEvents = allShoots.filter(shoot => {
                if (!shoot.scheduled_at) return false;
                const shootDate = new Date(shoot.scheduled_at).toISOString().split("T")[0];
                return shootDate === dayStr;
              });
              return (
                <div key={i} className={`bg-[#111] border p-3 min-h-[120px] flex flex-col gap-2 ${isToday ? "border-white/30" : "border-white/10"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs tracking-[2px] uppercase text-[#555]">{DAY_NAMES[i]}</span>
                    <span className={`text-sm font-bold ${isToday ? "text-white" : "text-[#444]"}`}>{day.getDate()}</span>
                  </div>
                  {dayEvents.length === 0 && (
                    <div className="flex-1" />
                  )}
                  {dayEvents.map(shoot => (
                    <div
                      key={shoot.id}
                      className={`text-xs p-2 rounded-sm leading-tight ${
                        shoot.status === "pending"
                          ? "bg-[#fbbf2415] border border-[#fbbf2430] text-[#fbbf24]"
                          : "bg-[#4ade8015] border border-[#4ade8030] text-[#4ade80]"
                      }`}
                    >
                      <p className="font-semibold truncate">{shoot.client_name || "Client"}</p>
                      <p className="text-[10px] opacity-70 truncate mt-0.5">{shoot.address}</p>
                      {shoot.scheduled_at && (
                        <p className="text-[10px] opacity-60 mt-0.5">
                          {new Date(shoot.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                      {shoot.status === "pending" && (
                        <p className="text-[9px] tracking-[1px] uppercase opacity-60 mt-1">Pending</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      );
    }
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
    if (s === "Realtors") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const newRealtors = realtors.filter(r => new Date(r.created_at) >= sevenDaysAgo);
      const displayed = realtorTab === "new" ? newRealtors : realtors;
      return (
        <section key={s}>
          <div className="flex items-center gap-4 mb-4">
            <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-[''] flex-1">
              Realtors — Portal Members
            </p>
            <div className="flex flex-shrink-0 border border-white/10 overflow-hidden">
              <button
                onClick={() => setRealtorTab("all")}
                className={`text-xs tracking-[2px] uppercase px-4 py-1.5 transition-colors ${realtorTab === "all" ? "bg-white text-black" : "text-[#555] hover:text-white"}`}
              >
                All ({realtors.length})
              </button>
              <button
                onClick={() => setRealtorTab("new")}
                className={`text-xs tracking-[2px] uppercase px-4 py-1.5 transition-colors flex items-center gap-2 ${realtorTab === "new" ? "bg-white text-black" : "text-[#555] hover:text-white"}`}
              >
                {newRealtors.length > 0 && realtorTab !== "new" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
                )}
                New ({newRealtors.length})
              </button>
            </div>
          </div>
          {displayed.length === 0 ? (
            <div className="bg-[#111] border border-white/10 p-8 text-center">
              <p className="text-[#444] text-sm">
                {realtorTab === "new" ? "No new realtors in the last 7 days." : "No realtors have signed up yet."}
              </p>
            </div>
          ) : (
            <div className="bg-[#111] border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {["Name", "Email", "Phone", "Brokerage", "Source", "Joined"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(r => {
                    const isNew = new Date(r.created_at) >= sevenDaysAgo;
                    return (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 font-medium flex items-center gap-2">
                          {isNew && <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] flex-shrink-0" title="New this week" />}
                          {r.full_name || "—"}
                        </td>
                        <td className="px-5 py-3 text-[#888]">{r.email || "—"}</td>
                        <td className="px-5 py-3 text-[#888]">{r.phone || "—"}</td>
                        <td className="px-5 py-3 text-[#888]">{r.brokerage || "—"}</td>
                        <td className="px-5 py-3 text-[#888]">{r.referral_source || "—"}</td>
                        <td className="px-5 py-3 text-[#888]">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      );
    }
    if (s === "Contacts") {
      const hotCount = contacts.filter(c => c.is_hot).length;
      const stageCount = (stage: string) => contacts.filter(c => c.stage === stage).length;
      return (
        <section key={s}>
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Contacts
          </p>
          <div className="bg-[#111] border border-white/10">
            {/* Stats row */}
            <div className="grid grid-cols-5 divide-x divide-white/5 border-b border-white/10">
              {[
                { label: "Total", value: contacts.length },
                { label: "Hot", value: hotCount },
                { label: "Leads", value: stageCount("lead") + stageCount("interested") + stageCount("follow-up") },
                { label: "Booked", value: stageCount("booked") },
                { label: "Clients", value: stageCount("client") },
              ].map(stat => (
                <div key={stat.label} className="px-5 py-4 text-center">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-[#555] mt-0.5 tracking-[1px] uppercase">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Quick add form (inline, toggleable) */}
            {showQuickAdd ? (
              <form onSubmit={saveQuickContact} className="p-5 border-b border-white/10">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input required autoFocus value={quickAddForm.name} onChange={e => setQuickAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Name *" className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 col-span-2" />
                  <input value={quickAddForm.phone} onChange={e => setQuickAddForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone" className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
                  <input value={quickAddForm.brokerage} onChange={e => setQuickAddForm(f => ({ ...f, brokerage: e.target.value }))}
                    placeholder="Brokerage" className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
                  <input type="email" value={quickAddForm.email} onChange={e => setQuickAddForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Email" className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
                  <select value={quickAddForm.stage} onChange={e => setQuickAddForm(f => ({ ...f, stage: e.target.value }))}
                    className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none">
                    {["lead","interested","follow-up","booked","client"].map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowQuickAdd(false)}
                    className="px-4 py-2 text-xs tracking-[2px] uppercase text-[#555] border border-white/10 hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={quickAddSaving}
                    className="flex-1 py-2 text-xs tracking-[2px] uppercase bg-white text-black font-semibold hover:bg-[#ddd] transition-colors disabled:opacity-40">
                    {quickAddSaving ? "Saving..." : "Save Contact"}
                  </button>
                </div>
              </form>
            ) : null}

            {/* Action buttons */}
            <div className="grid grid-cols-3 divide-x divide-white/5">
              <button onClick={() => { setShowQuickAdd(true); }}
                className="flex flex-col items-center gap-2 py-5 text-[#888] hover:text-white hover:bg-white/[0.03] transition-all">
                <span className="text-xl">+</span>
                <span className="text-xs tracking-[2px] uppercase">New Contact</span>
              </button>
              <a href="/admin/contacts"
                className="flex flex-col items-center gap-2 py-5 text-[#888] hover:text-white hover:bg-white/[0.03] transition-all">
                <span className="text-xl">☰</span>
                <span className="text-xs tracking-[2px] uppercase">View All</span>
              </a>
              <a href="/admin/cold-calls"
                className="flex flex-col items-center gap-2 py-5 text-[#888] hover:text-white hover:bg-white/[0.03] transition-all">
                <span className="text-xl">📞</span>
                <span className="text-xs tracking-[2px] uppercase">Cold Calls</span>
              </a>
            </div>
          </div>
        </section>
      );
    }

    if (s === "Cold Calls") {
      return (
        <section key={s}>
          <div className="flex items-center gap-4 mb-4">
            <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-[''] flex-1">
              📞 Cold Calls — {todayCalls}/{DAILY_GOAL} Today
            </p>
            <a href="/admin/cold-calls" className="flex-shrink-0 text-xs tracking-[2px] uppercase border border-white/10 px-4 py-1.5 text-[#888] hover:border-white/30 hover:text-white transition-all">
              Full View →
            </a>
          </div>
          <div className="bg-[#111] border border-white/10 p-5 space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-[#222] rounded-full overflow-hidden">
                <div className="h-full bg-[#4ade80] rounded-full transition-all duration-500" style={{ width: `${Math.min((todayCalls / DAILY_GOAL) * 100, 100)}%` }} />
              </div>
              <span className="text-sm font-bold text-[#4ade80]">{Math.round((todayCalls / DAILY_GOAL) * 100)}%</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#555] mb-2">Active Contact</p>
                {activeCallContact ? (
                  <div className="bg-[#181818] border border-white/10 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{activeCallContact.name}</p>
                      <p className="text-xs text-[#555]">{activeCallContact.brokerage || activeCallContact.phone || "—"}</p>
                    </div>
                    <button onClick={() => setActiveCallContact(null)} className="text-[#555] hover:text-white text-xs">✕</button>
                  </div>
                ) : (
                  <p className="text-xs text-[#444] italic">Select from Contacts above</p>
                )}
              </div>
              <div>
                <p className="text-xs text-[#555] mb-2">Outcome</p>
                <div className="flex flex-wrap gap-1.5">
                  {CALL_OUTCOMES.map(o => (
                    <button key={o.value} onClick={() => setCallOutcome(o.value)}
                      className={`text-xs px-2.5 py-1 rounded-full transition-all ${callOutcome === o.value ? o.color : "bg-[#1a1a1a] text-[#555] hover:text-white"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={logCallFromDashboard} disabled={!activeCallContact || !callOutcome || loggingCall}
              className="w-full py-2.5 text-xs tracking-[3px] uppercase font-semibold bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              {loggingCall ? "Logging..." : "Log Call"}
            </button>
          </div>
        </section>
      );
    }

    return null;
  }

  async function logCallFromDashboard() {
    if (!activeCallContact || !callOutcome) return;
    setLoggingCall(true);
    const supabase = createClient();
    await supabase.from("cold_calls").insert({
      contact_id: activeCallContact.id,
      outcome: callOutcome,
      notes: callNote || null,
      called_by: userName.split(" ")[0].toLowerCase() || "ryan",
    });
    const stageMap: Record<string, string> = { interested: "interested", callback: "follow-up", booked: "booked", not_interested: "dead" };
    if (stageMap[callOutcome]) await supabase.from("contacts").update({ stage: stageMap[callOutcome] }).eq("id", activeCallContact.id);
    setCallOutcome("");
    setCallNote("");
    setActiveCallContact(null);
    setTodayCalls(t => t + 1);
    setLoggingCall(false);
  }

  const isRunning = !!timerStart;
  const myName = userName.split(" ")[0] || "You";

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <div className="flex items-center gap-6">
          <a href="/admin/contacts" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Contacts</a>
          <a href="/admin/cold-calls" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">📞 Cold Calls</a>
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
            <div className="flex items-center gap-3">
              <p className="text-xs tracking-[2px] uppercase text-[#444]">
                {QB.syncedAt
                  ? `QB synced: ${new Date(QB.syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                  : "Not yet synced"}
              </p>
              <button
                onClick={syncQB}
                disabled={qbSyncing}
                className="text-xs tracking-[2px] uppercase border border-white/10 px-3 py-1.5 text-[#888] hover:border-white/30 hover:text-white transition-all disabled:opacity-40 flex items-center gap-2"
              >
                {qbSyncing && <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />}
                {qbSyncing ? "Syncing..." : "Sync QB"}
              </button>
            </div>
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
                      <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1">Client</p>
                      <p className="text-sm font-semibold">{s.client_name || "—"}</p>
                      {s.client_email && <p className="text-xs text-[#555] mt-0.5">{s.client_email}</p>}
                    </div>
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
                  <div className="flex flex-col gap-3 flex-shrink-0 min-w-[200px]">
                    {photographers.length > 0 && (
                      <div>
                        <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Assign Photographers</p>
                        <div className="flex flex-col gap-1.5">
                          {photographers.map(p => {
                            const selected = (shootPhotographers[s.id] || []).includes(p.id);
                            return (
                              <label key={p.id} className="flex items-center gap-2.5 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleShootPhotographer(s.id, p.id)}
                                  className="accent-white w-3 h-3"
                                />
                                <span className={`text-xs tracking-[1px] uppercase transition-colors ${selected ? "text-white" : "text-[#555] group-hover:text-[#888]"}`}>{p.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => approveShoot(s.id)}
                        disabled={approvingId === s.id}
                        className="text-xs tracking-[3px] uppercase bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/30 px-5 py-3 hover:bg-[#4ade80]/20 transition-colors disabled:opacity-40 flex-1"
                      >
                        {approvingId === s.id ? "..." : "Confirm ✓"}
                      </button>
                      <button
                        onClick={() => declineShoot(s.id)}
                        disabled={approvingId === s.id}
                        className="text-xs tracking-[3px] uppercase bg-red-500/10 text-red-400 border border-red-500/20 px-5 py-3 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {order.map(renderSection)}

        {/* CLIENT INVITE */}
        <section>
          <p className={sectionLabel}>Invite Client</p>
          <div className="bg-[#111] border border-white/10 p-6 max-w-lg">
            <p className="text-xs text-[#555] mb-4">Generate a magic link for a realtor to create their account and access media.</p>
            <form onSubmit={generateClientInvite} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Client name" value={inviteName} onChange={e => setInviteName(e.target.value)}
                  className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 transition-colors placeholder:text-[#444]" />
                <input type="email" required placeholder="their@email.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 transition-colors placeholder:text-[#444]" />
              </div>
              <button type="submit" disabled={inviteLoading}
                className="bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-3 hover:bg-white/90 transition-colors disabled:opacity-50">
                {inviteLoading ? "Generating..." : "Generate Magic Link"}
              </button>
            </form>
            {inviteLink && (
              <div className="mt-4 border border-white/10 p-4 flex flex-col gap-3">
                <p className="text-xs font-mono text-[#888] break-all">{inviteLink}</p>
                <div className="flex gap-3">
                  <button onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); }}
                    className="flex-1 bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-2.5 hover:bg-white/90 transition-colors">
                    {inviteCopied ? "Copied!" : "Copy Link"}
                  </button>
                  <a href={`mailto:${inviteEmail}?subject=Your Luck Images Portal Access&body=Hi ${inviteName},%0A%0AHere's your link to access your photos on the Luck Images portal:%0A%0A${encodeURIComponent(inviteLink)}%0A%0AClick the link to create your account and download your media.%0A%0ARyan%0ALuck Images`}
                    className="flex-1 border border-white/20 text-white text-xs tracking-[3px] uppercase font-semibold py-2.5 hover:bg-white/5 transition-colors text-center">
                    Email It
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

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
