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

  type Section = "Revenue" | "Monthly Revenue" | "Clients" | "Services" | "Marketing" | "Capacity" | "Recent Invoices" | "Realtors" | "Schedule" | "Contacts" | "Cold Calls" | "Command Center" | "Shoot Log" | "Portal Members" | "Invite Client" | "Time Tracker";
  const DEFAULT_ORDER: Section[] = ["Schedule", "Command Center", "Cold Calls", "Shoot Log", "Revenue", "Monthly Revenue", "Clients", "Services", "Marketing", "Capacity", "Recent Invoices", "Contacts", "Portal Members", "Invite Client", "Time Tracker"];
  const DEFAULT_VISIBLE: Record<Section, boolean> = { Schedule: true, Revenue: true, "Monthly Revenue": true, Clients: true, Services: true, Marketing: true, Capacity: true, "Recent Invoices": true, Realtors: true, Contacts: true, "Cold Calls": true, "Command Center": true, "Shoot Log": true, "Portal Members": true, "Invite Client": true, "Time Tracker": true };

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
  const [callNote, setCallNote] = useState("");
  const [callListingAddress, setCallListingAddress] = useState("");
  const [zillowUrl, setZillowUrl] = useState("");
  const [zillowLoading, setZillowLoading] = useState(false);
  const [callContactSearch, setCallContactSearch] = useState("");
  const [showCallNewContact, setShowCallNewContact] = useState(false);
  const [callNewContact, setCallNewContact] = useState({ name: "", phone: "", brokerage: "" });
  const [callOutcome, setCallOutcome] = useState("");
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

  // Command center state
  type Todo = { id: string; text: string; title?: string; details?: string; created_by: string; created_at: string; completed_at: string | null; completed_by?: string; is_urgent: boolean };

  function userColor(name: string) {
    if (name === "ryan") return "text-[#4ade80]";
    if (name === "leif") return "text-[#60a5fa]";
    return "text-[#888]";
  }
  function fmtTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  type UpdateItem = { id: string; type: string; message: string; created_at: string; by?: string };
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoInput, setTodoInput] = useState("");
  const [todoUrgent, setTodoUrgent] = useState(false);
  const [todoFilter, setTodoFilter] = useState<"all" | "urgent">("all");
  const [todoExpanded, setTodoExpanded] = useState<string | null>(null);
  const [todoEditing, setTodoEditing] = useState<string | null>(null);
  const [todoEditTitle, setTodoEditTitle] = useState("");
  const [todoEditDetails, setTodoEditDetails] = useState("");
  const [todoDetailsInput, setTodoDetailsInput] = useState("");
  const [todoAddOpen, setTodoAddOpen] = useState(false);
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [updateInput, setUpdateInput] = useState("");
  const [needsAttention, setNeedsAttention] = useState<UpdateItem[]>([]);

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

      // Load active timer + week stats via API (uses service role to bypass RLS)
      const timerRes = await fetch("/api/admin/time-entries");
      if (timerRes.ok) {
        const { active, weekEntries } = await timerRes.json();
        if (active) {
          setActiveEntryId(active.id);
          setTimerStart(new Date(active.started_at));
          setElapsed(Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000));
        }
        if (weekEntries) {
          let myTotal = 0;
          let partnerTotal = 0;
          let pName = "";
          const now = Date.now();
          weekEntries.forEach((e: { user_id: string; user_name: string; duration_seconds: number; started_at: string; stopped_at: string | null }) => {
            // Only count stopped entries — active entry is tracked live via `elapsed`
            const secs = e.stopped_at ? (e.duration_seconds || 0) : 0;
            if (e.user_id === uid) {
              myTotal += secs;
            } else {
              // Partner: use live seconds for their active entry
              const partnerSecs = e.stopped_at ? (e.duration_seconds || 0) : Math.floor((now - new Date(e.started_at).getTime()) / 1000);
              partnerTotal += partnerSecs;
              pName = e.user_name;
              if (!e.stopped_at) setPartnerActive(true);
            }
          });
          setMyWeekSeconds(myTotal);
          setPartnerWeekSeconds(partnerTotal);
          setPartnerName(pName);
        }
      }

      // Load realtors
      const realtorRes = await fetch("/api/admin/realtors");
      if (realtorRes.ok) setRealtors(await realtorRes.json());

      // Load all upcoming shoots for calendar
      const allShootsRes = await fetch("/api/admin/shoots?all=1");
      if (allShootsRes.ok) setAllShoots(await allShootsRes.json());

      // Load command center data
      const [todosRes, updatesRes] = await Promise.all([
        fetch("/api/admin/todos"),
        fetch("/api/admin/company-updates"),
      ]);
      if (todosRes.ok) { const d = await todosRes.json(); setTodos(d.active || []); }
      if (updatesRes.ok) {
        const d = await updatesRes.json();
        const all = [...(d.posts || []).map((p: {id: string; message: string; created_at: string; created_by: string}) => ({ id: p.id, type: "post", message: p.message, created_at: p.created_at, by: p.created_by })), ...(d.auto || [])].sort((a: {created_at: string}, b: {created_at: string}) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setUpdates(all);
        // Needs attention = overdue callbacks + recent no_answers
        setNeedsAttention((d.auto || []).filter((u: {type: string; message: string}) => u.type === "call" && (u.message.includes("no answer") || u.message.includes("callback"))).slice(0, 8));
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
    const res = await fetch("/api/admin/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", userName }),
    });
    const json = await res.json();
    if (!res.ok) { alert("Timer error: " + json.error); return; }
    setActiveEntryId(json.entry.id);
    setTimerStart(new Date(json.entry.started_at));
    setElapsed(0);
  }

  async function stopTimer() {
    if (!activeEntryId) return;
    await fetch("/api/admin/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop", entryId: activeEntryId, elapsed }),
    });
    setActiveEntryId(null);
    setTimerStart(null);
    setElapsed(0);
    // Refetch totals so we don't double-count the running time already in the initial load
    const res = await fetch("/api/admin/time-entries");
    if (res.ok) {
      const { weekEntries } = await res.json();
      if (weekEntries) {
        let myTotal = 0; let partnerTotal = 0; let pName = "";
        const now = Date.now();
        weekEntries.forEach((e: { user_id: string; user_name: string; duration_seconds: number; started_at: string; stopped_at: string | null }) => {
          const secs = e.stopped_at ? (e.duration_seconds || 0) : 0;
          if (e.user_id === userId) { myTotal += secs; }
          else { partnerTotal += e.stopped_at ? (e.duration_seconds || 0) : Math.floor((now - new Date(e.started_at).getTime()) / 1000); pName = e.user_name; }
        });
        setMyWeekSeconds(myTotal);
        setPartnerWeekSeconds(partnerTotal);
        setPartnerName(pName);
      }
    }
  }

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!todoInput.trim()) return;
    const res = await fetch("/api/admin/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", title: todoInput, details: todoDetailsInput, is_urgent: todoUrgent }) });
    if (res.ok) { const { todo } = await res.json(); setTodos(t => [...t, todo]); setTodoInput(""); setTodoDetailsInput(""); setTodoUrgent(false); setTodoAddOpen(false); }
  }

  async function saveTodoEdit(id: string) {
    await fetch("/api/admin/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", id, title: todoEditTitle, details: todoEditDetails }) });
    setTodos(ts => ts.map(t => t.id === id ? { ...t, title: todoEditTitle, text: todoEditTitle, details: todoEditDetails } : t));
    setTodoEditing(null);
  }

  async function completeTodo(id: string) {
    await fetch("/api/admin/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", id }) });
    setTodos(t => t.filter(x => x.id !== id));
  }

  async function postUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!updateInput.trim()) return;
    const res = await fetch("/api/admin/company-updates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: updateInput }) });
    if (res.ok) {
      const { post } = await res.json();
      setUpdates(u => [{ id: post.id, type: "post", message: post.message, created_at: post.created_at, by: post.created_by }, ...u]);
      setUpdateInput("");
    }
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

  const [selectedShoot, setSelectedShoot] = useState<typeof pendingShoots[0] | null>(null);
  const [viewShoot, setViewShoot] = useState<ShootEvent | null>(null);
  const [viewShootPhotographers, setViewShootPhotographers] = useState<string[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignSaved, setAssignSaved] = useState(false);
  const [callsExpanded, setCallsExpanded] = useState(false);

  // Create shoot modal state
  const [createShootOpen, setCreateShootOpen] = useState(false);
  const [csAddress, setCsAddress] = useState("");
  const [csDateTime, setCsDateTime] = useState("");
  const [csServices, setCsServices] = useState<string[]>([]);
  const [csNotes, setCsNotes] = useState("");
  const [csSqft, setCsSqft] = useState("");
  const [csClientSearch, setCsClientSearch] = useState("");
  const [csClientResults, setCsClientResults] = useState<{id:string;name:string;email:string}[]>([]);
  const [csClient, setCsClient] = useState<{id:string;name:string;email:string}|null>(null);
  const [csPhotographers, setCsPhotographers] = useState<string[]>([]);
  const [csSaving, setCsSaving] = useState(false);
  const [csInviteLink, setCsInviteLink] = useState("");

  const DASHBOARD_SERVICES = ["HDR Photography","Aerial / Drone","Virtual Staging","Video Walkthrough","3D Tour / Matterport","Floor Plan","Twilight Photography","Headshots / Agent Photos"];

  function csToggleService(s: string) { setCsServices(p => p.includes(s) ? p.filter(x=>x!==s) : [...p,s]); }
  function csTogglePhotographer(id: string) { setCsPhotographers(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]); }
  function csSearchClients(q: string) {
    setCsClientSearch(q);
    if (!q.trim()) { setCsClientResults([]); return; }
    const lower = q.toLowerCase();
    setCsClientResults(realtors.filter((r:{id:string;full_name:string;email:string}) =>
      (r.full_name||"").toLowerCase().includes(lower) || (r.email||"").toLowerCase().includes(lower)
    ).slice(0,5).map((r:{id:string;full_name:string;email:string}) => ({id:r.id,name:r.full_name||r.email,email:r.email})));
  }

  async function createShootFromDashboard() {
    if (!csAddress.trim()) return;
    setCsSaving(true); setCsInviteLink("");
    const res = await fetch("/api/admin/shoots", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        address: csAddress, scheduled_at: csDateTime||null, services: csServices,
        notes: csNotes||null, square_footage: csSqft ? parseInt(csSqft) : null,
        client_id: csClient?.id||null, photographer_ids: csPhotographers, status: "scheduled",
      }),
    });
    if (!res.ok) { setCsSaving(false); return; }
    const { shoot } = await res.json();
    void shoot; // calendar event already fired in POST handler
    // Generate client invite link if client selected
    if (csClient?.email) {
      const ir = await fetch("/api/admin/invite-client", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ email: csClient.email, name: csClient.name }),
      });
      const id = await ir.json();
      if (id.link) setCsInviteLink(id.link);
    }
    await refreshShoots();
    setCsSaving(false);
    setCsAddress(""); setCsDateTime(""); setCsServices([]); setCsNotes(""); setCsSqft("");
    setCsClient(null); setCsClientSearch(""); setCsPhotographers([]);
    if (!csClient?.email) setCreateShootOpen(false);
  }

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

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

  const onDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) {
      dragItem.current = null; dragOver.current = null; return;
    }
    const next = [...order];
    const [moved] = next.splice(dragItem.current, 1);
    next.splice(dragOver.current, 0, moved);
    dragItem.current = null; dragOver.current = null;
    setOrder(next);
    savePrefs(next, visible);
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

  type ShootEvent = { id: string; address: string; scheduled_at: string; services: string[]; notes: string; square_footage: number | null; client_name: string; client_email: string; status: string; photographer_ids: string[] };
  const [allShoots, setAllShoots] = useState<ShootEvent[]>([]);

  // Shoot Log
  type TimeEntry = { id: string; user_id: string; user_name: string; started_at: string; stopped_at: string | null; duration_seconds: number };
  const [shootLog, setShootLog] = useState<ShootEvent[]>([]);
  const [shootLogEntries, setShootLogEntries] = useState<TimeEntry[]>([]);
  const [shootLogExpanded, setShootLogExpanded] = useState(false);
  const [shootLogLoaded, setShootLogLoaded] = useState(false);
  const [shootLogFilter, setShootLogFilter] = useState<"all"|"scheduled"|"completed"|"pending"|"cancelled">("all");
  const [shootLogMonth, setShootLogMonth] = useState("");

  async function loadShootLog() {
    if (shootLogLoaded) return;
    const [shootsRes, timeRes] = await Promise.all([
      fetch("/api/admin/shoots?full=1"),
      fetch("/api/admin/time-entries?mode=all"),
    ]);
    if (shootsRes.ok) setShootLog(await shootsRes.json());
    if (timeRes.ok) { const d = await timeRes.json(); setShootLogEntries(d.allEntries || []); }
    setShootLogLoaded(true);
  }
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
              <button onClick={() => setCreateShootOpen(true)} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 hover:border-white/30 px-3 py-1">+ New Shoot</button>
              <button onClick={() => setCalWeekOffset(o => o - 1)} className="text-[#555] hover:text-white transition-colors px-2 py-1 text-sm">←</button>
              <span className="text-xs tracking-[2px] uppercase text-[#666]">{weekLabel}</span>
              <button onClick={() => setCalWeekOffset(o => o + 1)} className="text-[#555] hover:text-white transition-colors px-2 py-1 text-sm">→</button>
              {calWeekOffset !== 0 && (
                <button onClick={() => setCalWeekOffset(0)} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors">Today</button>
              )}
            </div>
          </div>
          {/* TBD pending shoots — no date yet */}
          {pendingShoots.filter(s => !s.scheduled_at).length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {pendingShoots.filter(s => !s.scheduled_at).map(s => (
                <button key={s.id} onClick={() => setSelectedShoot(s)}
                  className="text-xs px-3 py-1.5 bg-[#fbbf2415] border border-[#fbbf2430] text-[#fbbf24] hover:bg-[#fbbf2425] transition-colors flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-pulse" />
                  {s.client_name || s.client_email || "Client"} — No date yet · tap to review
                </button>
              ))}
            </div>
          )}

          <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <div className="grid grid-cols-7 gap-2 min-w-[560px]">
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
                      onClick={() => {
                        const pending = pendingShoots.find(p => p.id === shoot.id);
                        if (pending) setSelectedShoot(pending);
                        else { setViewShoot(shoot); setViewShootPhotographers(shoot.photographer_ids || []); setAssignSaved(false); }
                      }}
                      className={`text-xs p-2 rounded-sm leading-tight cursor-pointer transition-colors ${
                        shoot.status === "pending"
                          ? "bg-[#fbbf2415] border border-[#fbbf2430] text-[#fbbf24] hover:bg-[#fbbf2425]"
                          : "bg-[#4ade8015] border border-[#4ade8030] text-[#4ade80] hover:bg-[#4ade8025]"
                      }`}
                    >
                      <p className="font-semibold truncate">{shoot.client_name || "Client"}</p>
                      <p className="text-[10px] opacity-70 truncate mt-0.5">{shoot.address}</p>
                      {shoot.scheduled_at && (
                        <p className="text-[10px] opacity-60 mt-0.5">
                          {new Date(shoot.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                      <p className="text-[9px] tracking-[1px] uppercase opacity-50 mt-1">
                        {shoot.status === "pending" ? "Proposed ↗" : "View ↗"}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          </div>

          {/* View shoot detail popup (confirmed/scheduled) */}
          {viewShoot && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewShoot(null)}>
              <div className="absolute inset-0 bg-black/70" />
              <div className="relative bg-[#141414] border border-[#4ade80]/20 w-full max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                      <p className="text-[10px] tracking-[3px] uppercase text-[#4ade80]">Scheduled Shoot</p>
                    </div>
                    <p className="text-base font-semibold">{viewShoot.address}</p>
                  </div>
                  <button onClick={() => setViewShoot(null)} className="text-[#555] hover:text-white transition-colors text-lg leading-none">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Date & Time</p>
                    <p>{viewShoot.scheduled_at ? new Date(viewShoot.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · " + new Date(viewShoot.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "TBD"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Client</p>
                    <p className="font-medium">{viewShoot.client_name || "—"}</p>
                    {viewShoot.client_email && <p className="text-xs text-[#555] mt-0.5">{viewShoot.client_email}</p>}
                  </div>
                  {viewShoot.services?.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Services</p>
                      <div className="flex flex-wrap gap-1.5">
                        {viewShoot.services.map((svc: string) => (
                          <span key={svc} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80]">{svc}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewShoot.square_footage && (
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Sq Ft</p>
                      <p>{viewShoot.square_footage?.toLocaleString()}</p>
                    </div>
                  )}
                  {viewShoot.notes && (
                    <div className="col-span-2">
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Notes</p>
                      <p className="text-[#888] text-xs">{viewShoot.notes}</p>
                    </div>
                  )}
                </div>
                {/* Photographer assignment */}
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Assigned Photographer(s)</p>
                  {photographers.length === 0 ? (
                    <p className="text-xs text-[#444] italic">No photographers in system yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {photographers.map(p => {
                        const assigned = viewShootPhotographers.includes(p.id);
                        return (
                          <button key={p.id} type="button"
                            onClick={() => { setAssignSaved(false); setViewShootPhotographers(prev => assigned ? prev.filter(x => x !== p.id) : [...prev, p.id]); }}
                            className={`text-xs px-3 py-2 border transition-colors ${assigned ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      if (!viewShoot) return;
                      setSavingAssignment(true);
                      await fetch("/api/admin/shoots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: viewShoot.id, status: viewShoot.status, photographer_ids: viewShootPhotographers }) });
                      setAllShoots(prev => prev.map(s => s.id === viewShoot.id ? { ...s, photographer_ids: viewShootPhotographers } : s));
                      setSavingAssignment(false); setAssignSaved(true);
                    }}
                    disabled={savingAssignment}
                    className="w-full py-2.5 text-xs tracking-[2px] uppercase font-semibold bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-40">
                    {savingAssignment ? "Saving..." : assignSaved ? "Saved ✓" : "Save Assignment"}
                  </button>
                </div>
                <div className="flex gap-3">
                  <a href="/admin/shoots" className="flex-1 text-center text-xs tracking-[2px] uppercase border border-white/10 text-[#888] px-4 py-2.5 hover:border-white/30 hover:text-white transition-colors">Manage Shoots →</a>
                  <button onClick={() => setViewShoot(null)} className="px-6 py-2.5 text-xs tracking-[2px] uppercase border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Approval modal */}
          {selectedShoot && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedShoot(null)}>
              <div className="absolute inset-0 bg-black/70" />
              <div className="relative bg-[#141414] border border-[#fbbf24]/30 w-full max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-pulse" />
                      <p className="text-[10px] tracking-[3px] uppercase text-[#fbbf24]">Pending Approval</p>
                    </div>
                    <p className="text-base font-semibold">{selectedShoot.address}</p>
                  </div>
                  <button onClick={() => setSelectedShoot(null)} className="text-[#555] hover:text-white transition-colors text-lg leading-none">✕</button>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Client</p>
                    <p className="font-medium">{selectedShoot.client_name || "—"}</p>
                    {selectedShoot.client_email && <p className="text-xs text-[#555] mt-0.5">{selectedShoot.client_email}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Requested Date</p>
                    <p>{selectedShoot.scheduled_at ? new Date(selectedShoot.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · " + new Date(selectedShoot.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "No date requested"}</p>
                  </div>
                  {selectedShoot.services?.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Services</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedShoot.services.map((svc: string) => (
                          <span key={svc} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-white/5 border border-white/10 text-[#888]">{svc}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedShoot.square_footage && (
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Sq Ft</p>
                      <p>{selectedShoot.square_footage.toLocaleString()}</p>
                    </div>
                  )}
                  {selectedShoot.notes && (
                    <div className="col-span-2">
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Notes</p>
                      <p className="text-[#888] text-xs">{selectedShoot.notes}</p>
                    </div>
                  )}
                </div>

                {/* Photographer assign */}
                {photographers.length > 0 && (
                  <div>
                    <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Assign Photographer(s)</p>
                    <div className="flex flex-wrap gap-2">
                      {photographers.map(p => {
                        const selected = (shootPhotographers[selectedShoot.id] || []).includes(p.id);
                        return (
                          <button key={p.id} type="button" onClick={() => toggleShootPhotographer(selectedShoot.id, p.id)}
                            className={`text-xs px-3 py-1.5 border transition-colors ${selected ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={async () => { await approveShoot(selectedShoot.id); setSelectedShoot(null); }}
                    disabled={approvingId === selectedShoot.id}
                    className="flex-1 text-xs tracking-[3px] uppercase bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/30 px-5 py-3 hover:bg-[#4ade80]/20 transition-colors disabled:opacity-40">
                    {approvingId === selectedShoot.id ? "Confirming..." : "Confirm ✓"}
                  </button>
                  <button
                    onClick={async () => { await declineShoot(selectedShoot.id); setSelectedShoot(null); }}
                    disabled={approvingId === selectedShoot.id}
                    className="text-xs tracking-[3px] uppercase bg-red-500/10 text-red-400 border border-red-500/20 px-5 py-3 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                    Decline
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Create Shoot modal */}
          {createShootOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { if (!csSaving) setCreateShootOpen(false); }}>
              <div className="absolute inset-0 bg-black/80" />
              <div className="relative bg-[#141414] border border-white/15 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-[#141414] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
                  <p className="text-xs tracking-[3px] uppercase font-semibold">New Shoot</p>
                  <button onClick={() => setCreateShootOpen(false)} className="text-[#555] hover:text-white transition-colors text-lg leading-none">✕</button>
                </div>

                {csInviteLink ? (
                  // Success state — show invite link
                  <div className="p-6 space-y-5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
                      <p className="text-sm font-semibold">Shoot created + added to Google Calendar</p>
                    </div>
                    <div>
                      <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Client Invite Link</p>
                      <p className="text-[10px] text-[#888] mb-3">Send this to your client — they click it to access their portal and see the shoot.</p>
                      <div className="bg-[#111] border border-white/10 p-3 flex items-center gap-3">
                        <p className="text-xs text-[#4ade80] font-mono break-all flex-1">{csInviteLink}</p>
                        <button onClick={() => navigator.clipboard.writeText(csInviteLink)}
                          className="text-xs tracking-[1px] uppercase px-3 py-1.5 border border-white/10 text-[#888] hover:text-white hover:border-white/30 transition-colors flex-shrink-0">Copy</button>
                      </div>
                    </div>
                    <button onClick={() => { setCreateShootOpen(false); setCsInviteLink(""); }}
                      className="w-full py-3 bg-white text-black text-xs tracking-[2px] uppercase font-semibold hover:bg-[#ddd] transition-colors">Done</button>
                  </div>
                ) : (
                  <div className="p-6 space-y-5">
                    {/* Address */}
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Property Address *</p>
                      <input value={csAddress} onChange={e => setCsAddress(e.target.value)} placeholder="123 Main St, Austin TX"
                        className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    </div>

                    {/* Date + Sqft */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Date & Time</p>
                        <input type="datetime-local" value={csDateTime} onChange={e => setCsDateTime(e.target.value)}
                          className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 [color-scheme:dark]" />
                      </div>
                      <div>
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Square Footage</p>
                        <input type="number" value={csSqft} onChange={e => setCsSqft(e.target.value)} placeholder="2,400"
                          className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
                      </div>
                    </div>

                    {/* Services */}
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Services</p>
                      <div className="flex flex-wrap gap-2">
                        {DASHBOARD_SERVICES.map(svc => (
                          <button key={svc} type="button" onClick={() => csToggleService(svc)}
                            className={`text-xs px-3 py-1.5 border transition-colors ${csServices.includes(svc) ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                            {svc}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Client */}
                    <div className="relative">
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Client / Realtor</p>
                      {csClient ? (
                        <div className="flex items-center gap-3 bg-[#111] border border-white/20 px-4 py-3">
                          <div className="flex-1">
                            <p className="text-sm">{csClient.name}</p>
                            <p className="text-xs text-[#555]">{csClient.email}</p>
                          </div>
                          <button type="button" onClick={() => { setCsClient(null); setCsClientSearch(""); }} className="text-[#555] hover:text-white text-xs">✕</button>
                        </div>
                      ) : (
                        <>
                          <input value={csClientSearch} onChange={e => csSearchClients(e.target.value)} placeholder="Search by name or email..."
                            className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
                          {csClientResults.length > 0 && (
                            <div className="absolute z-10 w-full bg-[#1a1a1a] border border-white/20 mt-1">
                              {csClientResults.map(c => (
                                <button key={c.id} type="button" onClick={() => { setCsClient(c); setCsClientSearch(""); setCsClientResults([]); }}
                                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors">
                                  <p className="text-sm">{c.name}</p>
                                  <p className="text-xs text-[#555]">{c.email}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Photographers */}
                    {photographers.length > 0 && (
                      <div>
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Photographer(s)</p>
                        <div className="flex flex-wrap gap-2">
                          {photographers.map(p => (
                            <button key={p.id} type="button" onClick={() => csTogglePhotographer(p.id)}
                              className={`text-xs px-3 py-1.5 border transition-colors ${csPhotographers.includes(p.id) ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Notes</p>
                      <textarea value={csNotes} onChange={e => setCsNotes(e.target.value)} rows={2} placeholder="Any special instructions..."
                        className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333] resize-none" />
                    </div>

                    <button onClick={createShootFromDashboard} disabled={!csAddress.trim() || csSaving}
                      className="w-full py-4 bg-white text-black text-xs tracking-[3px] uppercase font-bold hover:bg-[#ddd] transition-colors disabled:opacity-30">
                      {csSaving ? "Creating..." : "Create Shoot + Add to Calendar"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
    if (s === "Contacts") return (
      <section key={s}>
        <p className={sectionLabel}>Contacts</p>
        <div className="bg-[#111] border border-white/10 flex flex-col max-w-lg">
          <div className="p-5 border-b border-white/10 flex items-end justify-between">
            <div>
              <p className="text-4xl font-bold">{contacts.length}</p>
              <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1">Total</p>
            </div>
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-lg font-semibold text-[#fbbf24]">{contacts.filter(c => c.is_hot).length}</p>
                <p className="text-xs text-[#555]">Hot</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-[#4ade80]">{contacts.filter(c => c.stage === "client").length}</p>
                <p className="text-xs text-[#555]">Clients</p>
              </div>
            </div>
          </div>
          {showQuickAdd ? (
            <form onSubmit={saveQuickContact} className="p-5 flex flex-col gap-3">
              <input required autoFocus value={quickAddForm.name} onChange={e => setQuickAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Name *" className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
              <div className="grid grid-cols-2 gap-3">
                <input value={quickAddForm.phone} onChange={e => setQuickAddForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone" className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
                <input value={quickAddForm.brokerage} onChange={e => setQuickAddForm(f => ({ ...f, brokerage: e.target.value }))}
                  placeholder="Brokerage" className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
              </div>
              <input type="email" value={quickAddForm.email} onChange={e => setQuickAddForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Email" className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowQuickAdd(false)}
                  className="px-4 py-2.5 text-xs tracking-[2px] uppercase text-[#555] border border-white/10 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={quickAddSaving}
                  className="flex-1 py-2.5 text-xs tracking-[2px] uppercase bg-white text-black font-semibold hover:bg-[#ddd] transition-colors disabled:opacity-40">
                  {quickAddSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-white/5">
              <button onClick={() => setShowQuickAdd(true)}
                className="py-4 text-xs tracking-[2px] uppercase text-[#555] hover:text-white hover:bg-white/[0.03] transition-all">+ New Contact</button>
              <a href="/admin/contacts"
                className="py-4 text-xs tracking-[2px] uppercase text-[#555] hover:text-white hover:bg-white/[0.03] transition-all text-center">View All →</a>
            </div>
          )}
        </div>
      </section>
    );

    if (s === "Command Center") {
      const urgentCount = todos.filter(t => t.is_urgent).length;
      const visibleTodos = todoFilter === "urgent" ? todos.filter(t => t.is_urgent) : todos;
      return (
        <section key={s}>
          <p className={sectionLabel}>Command Center</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TO DO + NEEDS ATTENTION */}
            <div className="bg-[#111] border border-white/10 flex flex-col h-48">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <div className="flex items-center gap-1">
                  <button onClick={() => setTodoFilter("all")}
                    className={`text-xs px-2 py-0.5 transition-colors ${todoFilter === "all" ? "text-white" : "text-[#555] hover:text-[#888]"}`}>
                    All {todos.length > 0 && <span className="text-[#444]">({todos.length})</span>}
                  </button>
                  <button onClick={() => setTodoFilter("urgent")}
                    className={`text-xs px-2 py-0.5 transition-colors flex items-center gap-1 ${todoFilter === "urgent" ? "text-red-400" : "text-[#555] hover:text-[#888]"}`}>
                    {urgentCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                    Urgent {urgentCount > 0 && <span>({urgentCount})</span>}
                  </button>
                </div>
                <a href="/admin/todos" className="text-xs text-[#555] hover:text-white transition-colors">View all →</a>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {visibleTodos.length === 0 && (
                  <p className="text-xs text-[#333] italic p-3">{todoFilter === "urgent" ? "No urgent items." : "Nothing pending."}</p>
                )}
                {visibleTodos.map(t => {
                  const isOpen = todoExpanded === t.id;
                  const isEdit = todoEditing === t.id;
                  const title = t.title || t.text;
                  return (
                    <div key={t.id} className={`border-b border-white/5 ${t.is_urgent ? "border-l-2 border-l-red-500/60" : ""}`}>
                      {/* Title row */}
                      <div className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => setTodoExpanded(isOpen ? null : t.id)}>
                        <button onClick={e => { e.stopPropagation(); completeTodo(t.id); }}
                          className="w-3.5 h-3.5 border border-white/20 rounded-sm flex-shrink-0 hover:border-[#4ade80] hover:bg-[#4ade80]/10 transition-all" />
                        <p className="text-xs flex-1 truncate">{title}</p>
                        <span className="text-[#333] text-[10px] ml-auto">{isOpen ? "▲" : "▼"}</span>
                      </div>
                      {/* Expanded detail */}
                      {isOpen && (
                        <div className="px-3 pb-3 bg-white/[0.015]">
                          {isEdit ? (
                            <div className="flex flex-col gap-1.5 pt-1">
                              <input value={todoEditTitle} onChange={e => setTodoEditTitle(e.target.value)}
                                className="bg-[#1a1a1a] border border-white/10 text-xs px-2 py-1.5 outline-none text-white w-full"
                                placeholder="Title" />
                              <textarea value={todoEditDetails} onChange={e => setTodoEditDetails(e.target.value)}
                                className="bg-[#1a1a1a] border border-white/10 text-xs px-2 py-1.5 outline-none text-white w-full resize-none"
                                rows={3} placeholder="Details (optional)" />
                              <div className="flex gap-2">
                                <button onClick={() => saveTodoEdit(t.id)}
                                  className="text-[10px] tracking-[1px] uppercase text-[#4ade80] hover:text-white transition-colors">Save</button>
                                <button onClick={() => setTodoEditing(null)}
                                  className="text-[10px] tracking-[1px] uppercase text-[#444] hover:text-white transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {t.details ? (
                                <p className="text-[11px] text-[#777] leading-relaxed pt-1.5 whitespace-pre-wrap">{t.details}</p>
                              ) : (
                                <p className="text-[10px] text-[#333] italic pt-1.5">No details added.</p>
                              )}
                              <div className="flex items-center gap-3 mt-2">
                                <p className="text-[9px] flex items-center gap-1">
                                  <span className={userColor(t.created_by)}>{t.created_by}</span>
                                  <span className="text-[#333]">· {fmtTime(t.created_at)}</span>
                                </p>
                                <button onClick={() => { setTodoEditing(t.id); setTodoEditTitle(t.title || t.text); setTodoEditDetails(t.details || ""); }}
                                  className="text-[9px] text-[#444] hover:text-white transition-colors uppercase tracking-[1px]">Edit</button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Add task — collapsed by default, expands inline */}
              {todoAddOpen ? (
                <form onSubmit={addTodo} className="border-t border-white/10 flex flex-col gap-1 p-2">
                  <input value={todoInput} onChange={e => setTodoInput(e.target.value)} placeholder="Title"
                    className="bg-transparent text-xs px-2 py-1.5 outline-none placeholder:text-[#333] text-white border border-white/10" autoFocus />
                  <input value={todoDetailsInput} onChange={e => setTodoDetailsInput(e.target.value)} placeholder="Details (optional)"
                    className="bg-transparent text-xs px-2 py-1.5 outline-none placeholder:text-[#333] text-white border border-white/10" />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setTodoUrgent(u => !u)}
                      className={`text-[10px] uppercase tracking-[1px] transition-colors ${todoUrgent ? "text-red-400" : "text-[#444] hover:text-[#888]"}`}>! Urgent</button>
                    <button type="submit" className="text-[10px] uppercase tracking-[1px] text-[#4ade80] hover:text-white transition-colors ml-auto">Add</button>
                    <button type="button" onClick={() => setTodoAddOpen(false)} className="text-[10px] uppercase tracking-[1px] text-[#444] hover:text-white transition-colors">Cancel</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setTodoAddOpen(true)} className="border-t border-white/10 w-full text-left px-3 py-2 text-xs text-[#444] hover:text-white transition-colors">+ Add task</button>
              )}
            </div>
            {/* UPDATES */}
            <div className="bg-[#111] border border-white/10 flex flex-col h-48">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-xs tracking-[2px] uppercase text-[#888]">Updates</span>
                <a href="/admin/updates" className="text-xs text-[#444] hover:text-white transition-colors">View All →</a>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {updates.length === 0 && <p className="text-xs text-[#333] italic p-3">No recent activity.</p>}
                {updates.slice(0, 12).map(u => {
                  const icon = u.type === "call" ? "📞" : u.type === "contact" ? "👤" : u.type === "shoot" ? "📷" : "💬";
                  return (
                    <div key={u.id} className="px-3 py-2 hover:bg-white/[0.02] border-b border-white/5">
                      <p className="text-xs truncate">{icon} {u.message}</p>
                      <p className="text-[10px] text-[#444]">{new Date(u.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}{u.by ? ` · ${u.by}` : ""}</p>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={postUpdate} className="border-t border-white/10 flex">
                <input value={updateInput} onChange={e => setUpdateInput(e.target.value)} placeholder="Post an update..."
                  className="flex-1 bg-transparent text-xs px-3 py-2 outline-none placeholder:text-[#333] text-white" />
                <button type="submit" className="px-3 py-2 text-[#555] hover:text-white transition-colors">→</button>
              </form>
            </div>
          </div>
        </section>
      );
    }
    if (s === "Cold Calls") {
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
      const weekLogs = callLogs.filter(l => new Date(l.called_at) >= weekStart);
      const weekLeads = weekLogs.filter(l => ["interested","callback","booked"].includes(l.outcome));
      return (
        <section key={s}>
          <div className="flex items-center gap-4 mb-4">
            <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-[''] flex-1">Cold Calls</p>
          </div>
          <div className="bg-[#111] border border-white/10">
            <div className="grid grid-cols-2 divide-x divide-white/5">
              <div className="px-6 py-5">
                <p className="text-4xl font-bold tabular-nums">{weekLogs.length}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1.5">Calls This Week</p>
              </div>
              <div className="px-6 py-5">
                <p className="text-4xl font-bold tabular-nums text-[#4ade80]">{weekLeads.length}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1.5">Leads This Week</p>
              </div>
            </div>
            <div className="border-t border-white/10 p-4">
              <a href="/admin/cold-calls"
                className="block w-full py-3 bg-white text-black text-xs tracking-[3px] uppercase font-bold hover:bg-[#ddd] transition-colors text-center">
                Start Calling →
              </a>
            </div>
          </div>
        </section>
      );
    }

    if (s === "Shoot Log") {
      const thisMonth = new Date().toISOString().slice(0, 7);
      const completedCount = allShoots.filter(s => s.status === "completed").length + shootLog.filter(s => s.status === "completed").length;
      const totalCount = allShoots.length;
      const thisMonthCount = allShoots.filter(s => s.scheduled_at?.startsWith(thisMonth)).length;

      // Build filtered log for expanded view
      const filtered = shootLog
        .filter(s => shootLogFilter === "all" || s.status === shootLogFilter)
        .filter(s => !shootLogMonth || s.scheduled_at?.startsWith(shootLogMonth))
        .sort((a, b) => new Date(b.scheduled_at || 0).getTime() - new Date(a.scheduled_at || 0).getTime());

      // Build day → hours map from time entries
      const dayHours: Record<string, { ryan: number; leif: number }> = {};
      for (const e of shootLogEntries) {
        const day = e.started_at.slice(0, 10);
        if (!dayHours[day]) dayHours[day] = { ryan: 0, leif: 0 };
        const secs = e.stopped_at ? (e.duration_seconds || 0) : 0;
        if (e.user_name === "ryan") dayHours[day].ryan += secs;
        else if (e.user_name === "leif") dayHours[day].leif += secs;
      }

      const fmtH = (s: number) => s > 0 ? `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m` : "—";

      const statusColor = (st: string) => {
        if (st === "completed") return "text-[#4ade80]";
        if (st === "scheduled") return "text-[#60a5fa]";
        if (st === "pending") return "text-[#fbbf24]";
        return "text-[#555]";
      };

      const months = [...new Set(shootLog.map(s => s.scheduled_at?.slice(0, 7)).filter(Boolean))].sort().reverse();

      return (
        <section key={s}>
          <p className={sectionLabel}>Shoot Log</p>
          {!shootLogExpanded ? (
            <div className="bg-[#111] border border-white/10 flex items-center">
              <div className="flex-1 grid grid-cols-3 divide-x divide-white/5">
                <div className="px-8 py-6">
                  <p className="text-4xl font-bold tabular-nums">{totalCount}</p>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1.5">Total Shoots</p>
                </div>
                <div className="px-8 py-6">
                  <p className="text-4xl font-bold tabular-nums">{thisMonthCount}</p>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1.5">This Month</p>
                </div>
                <div className="px-8 py-6">
                  <p className="text-4xl font-bold tabular-nums text-[#4ade80]">{completedCount}</p>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1.5">Completed</p>
                </div>
              </div>
              <div className="px-6 flex-shrink-0">
                <button onClick={() => { setShootLogExpanded(true); loadShootLog(); }}
                  className="px-8 py-4 bg-white text-black text-xs tracking-[3px] uppercase font-bold hover:bg-[#ddd] transition-colors whitespace-nowrap">
                  View Log ↓
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#111] border border-white/10">
              {/* Header */}
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {(["all","scheduled","completed","pending","cancelled"] as const).map(f => (
                    <button key={f} onClick={() => setShootLogFilter(f)}
                      className={`text-xs tracking-[1px] uppercase px-3 py-1 transition-colors ${shootLogFilter === f ? "text-white border border-white/20" : "text-[#555] hover:text-white"}`}>
                      {f}
                    </button>
                  ))}
                  <select value={shootLogMonth} onChange={e => setShootLogMonth(e.target.value)}
                    className="bg-[#181818] border border-white/10 text-xs text-[#888] px-3 py-1 outline-none ml-2">
                    <option value="">All months</option>
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <button onClick={() => setShootLogExpanded(false)} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors">Collapse ▲</button>
              </div>

              {!shootLogLoaded ? (
                <p className="text-xs text-[#444] italic p-6">Loading...</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-[#444] italic p-6">No shoots match this filter.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-[#444] tracking-[1px] uppercase">
                        <th className="text-left px-4 py-2.5 font-normal">Date</th>
                        <th className="text-left px-4 py-2.5 font-normal">Address</th>
                        <th className="text-left px-4 py-2.5 font-normal">Client</th>
                        <th className="text-left px-4 py-2.5 font-normal">Services</th>
                        <th className="text-left px-4 py-2.5 font-normal">Status</th>
                        <th className="text-left px-4 py-2.5 font-normal">Ryan hrs</th>
                        <th className="text-left px-4 py-2.5 font-normal">Leif hrs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(shoot => {
                        const day = shoot.scheduled_at?.slice(0, 10) || "";
                        const dh = dayHours[day];
                        return (
                          <tr key={shoot.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-[#888] whitespace-nowrap">
                              {shoot.scheduled_at ? new Date(shoot.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                            </td>
                            <td className="px-4 py-3 max-w-[200px]">
                              <p className="truncate font-medium">{shoot.address}</p>
                            </td>
                            <td className="px-4 py-3 text-[#888] whitespace-nowrap">{shoot.client_name || "—"}</td>
                            <td className="px-4 py-3 text-[#555] max-w-[160px]">
                              <p className="truncate">{shoot.services?.join(", ") || "—"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`tracking-[1px] uppercase ${statusColor(shoot.status)}`}>{shoot.status}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-[#4ade80]">{dh ? fmtH(dh.ryan) : "—"}</td>
                            <td className="px-4 py-3 font-mono text-[#60a5fa]">{dh ? fmtH(dh.leif) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      );
    }

    if (s === "Portal Members") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const newRealtors = realtors.filter(r => new Date(r.created_at) >= sevenDaysAgo);
      return (
        <section key={s}>
          <div className="flex items-center gap-4 mb-4">
            <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-[''] flex-1">Portal Members</p>
            <div className="flex flex-shrink-0 border border-white/10 overflow-hidden">
              <button onClick={() => setRealtorTab("all")}
                className={`text-xs tracking-[2px] uppercase px-4 py-1.5 transition-colors ${realtorTab === "all" ? "bg-white text-black" : "text-[#555] hover:text-white"}`}>
                All ({realtors.length})
              </button>
              <button onClick={() => setRealtorTab("new")}
                className={`text-xs tracking-[2px] uppercase px-4 py-1.5 transition-colors flex items-center gap-2 ${realtorTab === "new" ? "bg-white text-black" : "text-[#555] hover:text-white"}`}>
                {newRealtors.length > 0 && realtorTab !== "new" && <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />}
                New ({newRealtors.length})
              </button>
            </div>
          </div>
          {realtors.length === 0 ? (
            <div className="bg-[#111] border border-white/10 p-8 text-center"><p className="text-[#444] text-sm">No realtors have signed up yet.</p></div>
          ) : (
            <div className="bg-[#111] border border-white/10 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#111]">
                  <tr className="border-b border-white/10">
                    {["Name", "Email", "Brokerage", "Joined"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(realtorTab === "new" ? newRealtors : realtors).map(r => {
                    const isNew = new Date(r.created_at) >= sevenDaysAgo;
                    return (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                          {isNew && <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] flex-shrink-0" />}
                          {r.full_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-[#888] text-xs truncate max-w-[120px]">{r.email || "—"}</td>
                        <td className="px-4 py-3 text-[#888] text-xs">{r.brokerage || "—"}</td>
                        <td className="px-4 py-3 text-[#888] text-xs">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
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

    if (s === "Invite Client") return (
      <section key={s}>
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
    );

    if (s === "Time Tracker") return (
      <section key={s}>
        <div className="flex items-center gap-4 mb-4">
          <p className="text-xs tracking-[4px] uppercase text-[#555]">Time Tracker — This Week</p>
          <a href="/admin/time-tracker" className="text-xs text-[#555] hover:text-white transition-colors">View all →</a>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <div className="bg-[#111] border border-white/10 p-5 flex items-center gap-8">
          <div className="flex items-center gap-3">
            {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse flex-shrink-0" />}
            <span className="text-xs tracking-[2px] uppercase text-[#666]">{myName}</span>
            <span className="text-sm font-bold">{fmtHours(myWeekSeconds + elapsed)}</span>
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
    );

    return null;
  }

  async function logCallFromDashboard() {
    if (!activeCallContact || !callOutcome) return;
    setLoggingCall(true);
    const supabase = createClient();
    const { data: newLog } = await supabase.from("cold_calls").insert({
      contact_id: activeCallContact.id,
      outcome: callOutcome,
      notes: callNote || null,
      listing_address: callListingAddress || null,
      called_by: userName.split(" ")[0].toLowerCase() || "ryan",
    }).select().single();
    const stageMap: Record<string, string> = { interested: "interested", callback: "follow-up", booked: "booked", not_interested: "dead" };
    if (stageMap[callOutcome]) {
      await supabase.from("contacts").update({ stage: stageMap[callOutcome] }).eq("id", activeCallContact.id);
      setContacts(cs => cs.map(c => c.id === activeCallContact.id ? { ...c, stage: stageMap[callOutcome] } : c));
    }
    if (newLog) setCallLogs(logs => [newLog, ...logs]);
    setCallOutcome("");
    setCallNote("");
    setCallListingAddress("");
    setZillowUrl("");
    setActiveCallContact(null);
    setTodayCalls(t => t + 1);
    setLoggingCall(false);
  }

  const isRunning = !!timerStart;
  const myName = userName.split(" ")[0] || "You";

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* HEADER */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10 gap-4">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <a href="/admin/contacts" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors hidden sm:inline">Contacts</a>
          <a href="/admin/cold-calls" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors hidden sm:inline">📞 Calls</a>
          <a href="/choose-portal" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Portals</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto w-full space-y-10 md:space-y-12">

        {/* TITLE */}
        <div className="flex flex-col gap-3">
          <p className="text-xs tracking-[4px] uppercase text-[#666]">Welcome back</p>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase">{userName || "Dashboard"}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={isRunning ? stopTimer : startTimer}
                className={`text-xs tracking-[3px] uppercase font-semibold px-3 py-2 transition-colors flex items-center gap-2 ${
                  isRunning
                    ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                    : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                }`}
              >
                {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                {isRunning ? `Stop ${fmtClock(elapsed)}` : "Start Timer"}
              </button>
              <button
                onClick={syncQB}
                disabled={qbSyncing}
                className="text-xs tracking-[2px] uppercase border border-white/10 px-3 py-1.5 text-[#888] hover:border-white/30 hover:text-white transition-all disabled:opacity-40 flex items-center gap-2"
              >
                {qbSyncing && <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />}
                {qbSyncing ? "Syncing..." : "Sync QB"}
              </button>
              <div ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="text-xs tracking-[2px] uppercase text-white flex items-center gap-1.5 hover:text-white/70 transition-colors border border-white/10 px-3 py-1.5"
              >
                Sections
                <span className="text-[10px]">{menuOpen ? "▲" : "▼"}</span>
              </button>

              {/* Slide-out panel */}
              {menuOpen && (
                <div className="fixed inset-0 z-50 flex">
                  {/* Backdrop */}
                  <div className="flex-1" onClick={() => setMenuOpen(false)} />
                  {/* Panel */}
                  <div className="w-72 bg-[#131313] border-l border-white/10 flex flex-col h-full shadow-2xl">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                      <p className="text-xs tracking-[3px] uppercase font-semibold">Sections</p>
                      <button onClick={() => setMenuOpen(false)} className="text-[#555] hover:text-white transition-colors text-lg leading-none">✕</button>
                    </div>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#444] px-5 pt-4 pb-2">Drag to reorder · click to show/hide</p>
                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                      {order.map((s, i) => (
                        <div
                          key={s}
                          draggable
                          onDragStart={() => { dragItem.current = i; }}
                          onDragEnter={() => { dragOver.current = i; }}
                          onDragEnd={onDragEnd}
                          onDragOver={e => e.preventDefault()}
                          onClick={() => toggle(s)}
                          className={`flex items-center gap-3 px-3 py-3 rounded cursor-pointer select-none transition-colors group
                            ${visible[s] ? "hover:bg-white/5" : "opacity-40 hover:opacity-60 hover:bg-white/5"}`}
                        >
                          {/* Drag grip */}
                          <span className="text-[#333] group-hover:text-[#666] transition-colors cursor-grab active:cursor-grabbing flex-shrink-0" style={{ lineHeight: 1 }}>
                            ⠿
                          </span>
                          <span className={`text-xs tracking-[2px] uppercase flex-1 transition-colors ${visible[s] ? "text-white" : "text-[#555]"}`}>
                            {s}
                          </span>
                          {/* Toggle pill */}
                          <div className={`w-8 h-4 rounded-full flex-shrink-0 transition-colors relative ${visible[s] ? "bg-white/20" : "bg-white/5"}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${visible[s] ? "bg-white right-0.5" : "bg-[#444] left-0.5"}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-4 border-t border-white/10">
                      <button
                        onClick={() => { setOrder(DEFAULT_ORDER); setVisible(DEFAULT_VISIBLE); savePrefs(DEFAULT_ORDER, DEFAULT_VISIBLE); }}
                        className="w-full text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors py-2 border border-white/10 hover:border-white/30"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>


        {order.map(renderSection)}


      </div>
    </main>
  );
}
