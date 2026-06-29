"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import ShootGallery from "@/components/ShootGallery";
import { normalizePhone } from "@/lib/format";
import HelpTip from "@/components/HelpTip";
import TaskBoard from "./TaskBoard";

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
  monthlyRaw: Record<string, number>;
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
  monthlyRaw: {},
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

  type Section = "Revenue" | "Clients" | "Marketing" | "Realtors" | "Schedule" | "Contacts" | "Command Center" | "Shoot Log" | "Time Tracker" | "Employees" | "Quote Builder";
  const DEFAULT_ORDER: Section[] = ["Schedule", "Command Center", "Shoot Log", "Revenue", "Clients", "Marketing", "Contacts", "Employees", "Time Tracker", "Quote Builder"];
  const DEFAULT_VISIBLE: Record<Section, boolean> = { Schedule: true, Revenue: true, Clients: true, Marketing: true, Realtors: true, Contacts: true, "Command Center": true, "Shoot Log": true, "Time Tracker": true, Employees: true, "Quote Builder": true };

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
  const [showInviteInline, setShowInviteInline] = useState(false);
  const [order, setOrder] = useState<Section[]>(DEFAULT_ORDER);
  const [visible, setVisible] = useState<Record<Section, boolean>>(DEFAULT_VISIBLE);

  // Contacts + Cold Calls state
  type Contact = { id: string; name: string; email: string | null; phone: string | null; brokerage: string | null; stage: string; is_hot: boolean; total_invoices: number; total_revenue: number; type: string; created_at: string; user_id: string | null; lead_source: string | null; };
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
  type TodoList = { id: string; name: string; position: number };
  type Todo = { id: string; text: string; title?: string; details?: string; notes?: string; created_by: string; created_at: string; completed_at: string | null; completed_by?: string; is_urgent: boolean; list_id?: string | null; assigned_to?: string; due_date?: string | null };

  function userColor(name: string) {
    if (name === "ryan") return "text-[#4ade80]";
    if (name === "leif") return "text-[#60a5fa]";
    return "text-[#888]";
  }
  function fmtTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  type UpdateItem = { id: string; type: string; category: string; message: string; created_at: string; by?: string; link?: string };
  const [todoLists, setTodoLists] = useState<TodoList[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [completedTodos, setCompletedTodos] = useState<Todo[]>([]);
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [updateInput, setUpdateInput] = useState("");
  const [needsAttention, setNeedsAttention] = useState<UpdateItem[]>([]);
  const [notifReadAt, setNotifReadAt] = useState<Date | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(["shoots","clients","marketing","finance","team","nocturne","alerts"]));
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);
  const [todoTab, setTodoTab] = useState("asap");

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
        const merged = { ...DEFAULT_VISIBLE, ...saved };
        setVisible(merged);
      }
      if (meta?.notif_read_at) {
        setNotifReadAt(new Date(meta.notif_read_at));
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
          monthlyRaw: breakdown,
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
      const allShootsRes = await fetch("/api/admin/shoots?full=1");
      if (allShootsRes.ok) setAllShoots(await allShootsRes.json());

      // Load command center data
      const [todosRes, updatesRes] = await Promise.all([
        fetch("/api/admin/todos"),
        fetch("/api/admin/company-updates"),
      ]);
      if (todosRes.ok) {
        const d = await todosRes.json();
        setTodoLists(d.lists || []);
        setTodos(d.active || []);
        setCompletedTodos(d.completed || []);
      }
      if (updatesRes.ok) {
        const d = await updatesRes.json();
        const all = [...(d.posts || []), ...(d.auto || [])].sort((a: {created_at: string}, b: {created_at: string}) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  async function markAllRead() {
    const now = new Date();
    setNotifReadAt(now);
    createClient().auth.updateUser({ data: { notif_read_at: now.toISOString() } });
  }

  async function postUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!updateInput.trim()) return;
    const res = await fetch("/api/admin/company-updates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: updateInput }) });
    if (res.ok) {
      const { post } = await res.json();
      setUpdates(u => [{ id: post.id, type: "post", category: "nocturne", message: post.message, created_at: post.created_at, by: post.created_by }, ...u]);
      setUpdateInput("");
    }
  }

  async function refreshShoots() {
    const supabase = createClient();
    const [pendingRes, allRes, { data: cs }] = await Promise.all([
      fetch("/api/admin/shoots"),
      fetch("/api/admin/shoots?full=1"),
      supabase.from("contacts").select("*").order("name", { ascending: true }),
    ]);
    if (pendingRes.ok) setPendingShoots(await pendingRes.json());
    if (allRes.ok) setAllShoots(await allRes.json());
    if (cs) setContacts(cs);
    // Invalidate shoot log cache so it reloads fresh next time it's expanded
    setShootLogLoaded(false);
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

  // Edit shoot modal state
  const [esAddress, setEsAddress] = useState("");
  const [esPropertyType, setEsPropertyType] = useState("");
  const [esSqft, setEsSqft] = useState("");
  const [esServices, setEsServices] = useState<string[]>([]);
  const [esAddons, setEsAddons] = useState<string[]>([]);
  const [esDatetime, setEsDatetime] = useState("");
  const [esAccess, setEsAccess] = useState("");
  const [esNotes, setEsNotes] = useState("");
  const [esSaving, setEsSaving] = useState(false);
  const [esSaved, setEsSaved] = useState(false);
  const [esEditing, setEsEditing] = useState(false);
  const [esTab, setEsTab] = useState<"info" | "edit" | "media">("info");
  const [callsExpanded, setCallsExpanded] = useState(false);

  // Create shoot modal state
  const [createShootOpen, setCreateShootOpen] = useState(false);
  const [csAddress, setCsAddress] = useState("");
  const [csDateTime, setCsDateTime] = useState("");
  const [csServices, setCsServices] = useState<string[]>([]);
  const [csNotes, setCsNotes] = useState("");
  const [csAccess, setCsAccess] = useState("");
  const [csAddons, setCsAddons] = useState<string[]>([]);
  const [csSqft, setCsSqft] = useState("");
  const [csPropertyType, setCsPropertyType] = useState("");
  const [csClientSearch, setCsClientSearch] = useState("");
  const [csClientResults, setCsClientResults] = useState<{id:string;name:string;email:string;brokerage:string|null}[]>([]);
  const [csClient, setCsClient] = useState<{id:string;name:string;email:string;brokerage:string|null}|null>(null);
  const [csPhotographers, setCsPhotographers] = useState<string[]>([]);
  const [csSaving, setCsSaving] = useState(false);
  const [csCreateNew, setCsCreateNew] = useState(false);
  const [csNewName, setCsNewName] = useState("");
  const [csNewPhone, setCsNewPhone] = useState("");
  const [csNewEmail, setCsNewEmail] = useState("");
  const [csNewBrokerage, setCsNewBrokerage] = useState("");
  const [csNewSaving, setCsNewSaving] = useState(false);

  const CS_PROPERTY_TYPES = ["Home","Condo","Townhouse","Multi-Family","Airbnb","Commercial","Lot","Land"];
  const CS_SIZE_UNIT = ["Lot","Land"].includes(csPropertyType) ? "acres" : "sqft";

  const CS_SERVICE_PRICES: Record<string, number> = {
    "HDR Photography": 200,
    "Aerial / Drone": 200,
    "Virtual Staging": 100,
    "Video Walkthrough": 200,
    "3D Tour / Matterport": 200,
    "Floor Plan": 50,
    "Twilight Photography": 400,
    "Headshots / Agent Photos": 200,
  };
  // Add-ons: only shown when a parent service is selected
  const CS_ADDONS: { label: string; price: number; requires: string }[] = [
    { label: "Drone Reel", price: 100, requires: "Aerial / Drone" },
  ];
  const CS_SERVICES = Object.keys(CS_SERVICE_PRICES);
  const csActiveAddons = CS_ADDONS.filter(a => csServices.includes(a.requires));

  // Auto-quote: sum of service prices + add-ons + sqft surcharge on photography
  const csAutoQuote = (() => {
    if (csServices.length === 0) return 0;
    let total = csServices.reduce((sum, s) => sum + (CS_SERVICE_PRICES[s] || 0), 0);
    total += CS_ADDONS.filter(a => csAddons.includes(a.label)).reduce((sum, a) => sum + a.price, 0);
    const sqft = parseInt(csSqft) || 0;
    if (csServices.includes("HDR Photography") && sqft > 0 && CS_SIZE_UNIT === "sqft") {
      if (sqft > 3500) total += 200;
      else if (sqft > 2500) total += 100;
      else if (sqft > 2000) total += 50;
    }
    return total;
  })();

  function csToggleService(s: string) {
    setCsServices(p => {
      const next = p.includes(s) ? p.filter(x => x !== s) : [...p, s];
      // Remove add-ons whose parent was just deselected
      if (p.includes(s)) {
        const orphaned = CS_ADDONS.filter(a => a.requires === s).map(a => a.label);
        if (orphaned.length) setCsAddons(prev => prev.filter(a => !orphaned.includes(a)));
      }
      return next;
    });
  }
  function csTogglePhotographer(id: string) { setCsPhotographers(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]); }

  function toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const ES_SIZE_UNIT = ["Lot","Land"].includes(esPropertyType) ? "acres" : "sqft";
  const esActiveAddons = CS_ADDONS.filter(a => esServices.includes(a.requires));
  const esAutoQuote = (() => {
    if (esServices.length === 0) return 0;
    let total = esServices.reduce((sum, s) => sum + (CS_SERVICE_PRICES[s] || 0), 0);
    total += CS_ADDONS.filter(a => esAddons.includes(a.label)).reduce((sum, a) => sum + a.price, 0);
    const sqft = parseInt(esSqft) || 0;
    if (esServices.includes("HDR Photography") && sqft > 0 && ES_SIZE_UNIT === "sqft") {
      if (sqft > 4500) total += 100;
      else if (sqft > 3000) total += 50;
      else if (sqft > 2000) total += 25;
    }
    return total;
  })();
  function esToggleService(s: string) {
    setEsServices(p => {
      const next = p.includes(s) ? p.filter(x => x !== s) : [...p, s];
      if (p.includes(s)) {
        const orphaned = CS_ADDONS.filter(a => a.requires === s).map(a => a.label);
        if (orphaned.length) setEsAddons(prev => prev.filter(a => !orphaned.includes(a)));
      }
      return next;
    });
  }
  function csSearchContacts(q: string) {
    setCsClientSearch(q);
    if (!q.trim()) { setCsClientResults([]); return; }
    const lower = q.toLowerCase();
    setCsClientResults(
      contacts.filter(c =>
        c.name.toLowerCase().includes(lower) ||
        (c.email || "").toLowerCase().includes(lower) ||
        (c.brokerage || "").toLowerCase().includes(lower)
      ).slice(0, 6).map(c => ({ id: c.id, name: c.name, email: c.email || "", brokerage: c.brokerage }))
    );
  }

  async function csSaveNewContact() {
    if (!csNewName.trim()) return;
    setCsNewSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from("contacts").insert({
      name: csNewName.trim(), phone: normalizePhone(csNewPhone), email: csNewEmail || null,
      brokerage: csNewBrokerage || null, stage: "lead", type: "lead",
    }).select("id, name, email, brokerage").single();
    if (data) {
      setCsClient({ id: data.id, name: data.name, email: data.email || "", brokerage: data.brokerage });
      setCsCreateNew(false);
      setCsNewName(""); setCsNewPhone(""); setCsNewEmail(""); setCsNewBrokerage("");
    }
    setCsNewSaving(false);
  }

  function csReset() {
    setCsAddress(""); setCsDateTime(""); setCsServices([]); setCsAddons([]); setCsNotes(""); setCsSqft(""); setCsAccess("");
    setCsPropertyType(""); setCsClient(null); setCsClientSearch(""); setCsPhotographers([]);
    setCsCreateNew(false); setCsNewName(""); setCsNewPhone(""); setCsNewEmail(""); setCsNewBrokerage("");
  }

  async function createShootFromDashboard() {
    if (!csAddress.trim()) return;
    setCsSaving(true);
    const allSelected = [...csServices, ...csAddons];
    const packageName = allSelected.length === 1 ? allSelected[0] : allSelected.length > 1 ? allSelected.join(" + ") : null;
    const res = await fetch("/api/admin/shoots", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        address: csAddress, scheduled_at: csDateTime||null, services: allSelected,
        square_footage: csSqft ? parseInt(csSqft) : null,
        contact_id: csClient?.id||null, photographer_ids: csPhotographers, status: "scheduled",
        price: csAutoQuote || null, package_name: packageName,
        notes: [csAccess ? `ACCESS: ${csAccess}` : "", csNotes].filter(Boolean).join("\n\n") || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Failed to book shoot: ${err.error || res.status}`);
      setCsSaving(false); return;
    }
    await refreshShoots();
    setCsSaving(false);
    csReset();
    setCreateShootOpen(false);
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

  type ShootEvent = { id: string; address: string; scheduled_at: string; services: string[]; notes: string; square_footage: number | null; client_name: string; client_email: string; status: string; photographer_ids: string[]; price: number | null; package_name: string | null; contact_id: string | null; property_type: string | null; checked_in_at: string | null; delivered_at: string | null; paid_at: string | null };
  const [allShoots, setAllShoots] = useState<ShootEvent[]>([]);

  // Shoot-derived live stats — update instantly when a shoot is created/completed
  const _thisYear = new Date().getFullYear().toString();
  const _thisMonthStr = new Date().toISOString().slice(0, 7);
  const shootsThisYear = allShoots.filter(s => (s.scheduled_at || "").startsWith(_thisYear) && s.status !== "cancelled");
  const completedThisYear = allShoots.filter(s => (s.scheduled_at || "").startsWith(_thisYear) && s.status === "completed");
  const shootRevenueYTD = completedThisYear.reduce((sum, s) => sum + (s.price || 0), 0);
  const avgShootPrice = completedThisYear.length > 0 ? Math.round(shootRevenueYTD / completedThisYear.length) : 0;

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
  const [calTodoExpanded, setCalTodoExpanded] = useState<string | null>(null);

  // Quote Builder state
  const [qbAddress, setQbAddress] = useState("");
  const [qbSqft, setQbSqft] = useState("");
  const [qbPrimary, setQbPrimary] = useState<string | null>(null);
  const [qbAddons, setQbAddons] = useState<Set<string>>(new Set());
  const [qbContactSearch, setQbContactSearch] = useState("");
  const [qbContact, setQbContact] = useState<Contact | null>(null);
  const [qbShowDropdown, setQbShowDropdown] = useState(false);
  const [qbSaving, setQbSaving] = useState(false);
  const [qbSaved, setQbSaved] = useState(false);
  const [qbNewName, setQbNewName] = useState("");
  const [qbNewEmail, setQbNewEmail] = useState("");
  const [qbCreating, setQbCreating] = useState(false);
  const [qbShowNewForm, setQbShowNewForm] = useState(false);

  const [qbSyncing, setQbSyncing] = useState(false);
  const [qbSending, setQbSending] = useState(false);
  const [qbSent, setQbSent] = useState(false);

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
        const rawBreakdown: Record<string, number> = snap.monthly_breakdown || {};
        setQB({
          revMonth: snap.rev_month ?? 0,
          revYTD: snap.rev_ytd ?? 0,
          netIncome: snap.net_income ?? 0,
          expenses: snap.expenses_ytd ?? 0,
          ytdInvoices: snap.ytd_invoices ?? 0,
          unpaidCount: snap.unpaid_count ?? 0,
          recentInvoices: snap.recent_invoices ?? [],
          monthly,
          monthlyRaw: rawBreakdown,
          syncedAt: snap.synced_at ?? null,
        });
      }
    } finally {
      setQbSyncing(false);
    }
  }

  const [hideRevenue, setHideRevenue] = useState(true);
  const blur = hideRevenue ? "blur-sm select-none" : "";

  const [capTotal, setCapTotal] = useState(50);

  const sectionLabel = "text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']";

  async function saveQuickContact(e: React.FormEvent) {
    e.preventDefault();
    if (!quickAddForm.name.trim()) return;
    setQuickAddSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from("contacts").insert({ ...quickAddForm, phone: normalizePhone(quickAddForm.phone), type: "lead" }).select().single();
    if (data) setContacts(cs => [...cs, data].sort((a, b) => a.name.localeCompare(b.name)));
    setQuickAddSaving(false);
    setShowQuickAdd(false);
    setQuickAddForm({ name: "", email: "", phone: "", brokerage: "", stage: "lead" });
  }

  function ShootTracker({ status }: { status: string }) {
    const TRACKER_STAGES = [
      { key: "scheduled", label: "Scheduled" },
      { key: "en_route",  label: "En Route" },
      { key: "on_site",   label: "On Site" },
      { key: "wrapping",  label: "Wrapped Up" },
      { key: "delivered", label: "Delivered" },
    ];
    const ORDER = ["pending", "scheduled", "en_route", "on_site", "wrapping", "editing", "delivered", "completed"];
    const cur = ORDER.indexOf(status);
    return (
      <div className="flex items-start gap-0 mt-3">
        {TRACKER_STAGES.map((stage, i) => {
          const idx = ORDER.indexOf(stage.key);
          // editing is between wrapping and delivered — treat it as wrapping done
          const effectiveIdx = status === "editing" ? ORDER.indexOf("editing") : cur;
          const isDone = effectiveIdx > idx || status === "completed";
          const isActive = !isDone && (effectiveIdx === idx || (stage.key === "wrapping" && status === "editing"));
          return (
            <div key={stage.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-2 h-2 rounded-full transition-colors ${isDone ? "bg-[#4ade80]" : isActive ? "bg-white" : "bg-white/15"}`} />
                <span className={`text-[8px] tracking-[1px] uppercase whitespace-nowrap ${isActive ? "text-white" : isDone ? "text-[#4ade80]/70" : "text-[#333]"}`}>{stage.label}</span>
              </div>
              {i < TRACKER_STAGES.length - 1 && (
                <div className={`w-10 h-px mb-3.5 ${isDone ? "bg-[#4ade80]/30" : "bg-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>
    );
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
              <button onClick={() => setCreateShootOpen(true)} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 hover:border-white/30 px-3 py-1">+ Book Shoot</button>
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
                  {(() => {
                    const dayTodos = todos.filter(t => t.due_date === dayStr);
                    if (dayTodos.length === 0) return null;
                    const todayTodoOpen = calTodoExpanded === dayStr;
                    const setTodayTodoOpen = (v: boolean) => setCalTodoExpanded(v ? dayStr : null);
                    return (
                      <div className="bg-[#fbbf2415] border border-[#fbbf2430] text-[#fbbf24] p-1.5 rounded-sm">
                        <button onClick={() => setTodayTodoOpen(!todayTodoOpen)} className="w-full flex items-center justify-between gap-1">
                          <span className="text-[9px] tracking-[1.5px] uppercase font-semibold">TO DO</span>
                          <span className="text-[9px]">{todayTodoOpen ? "▲" : "▼"}</span>
                        </button>
                        {todayTodoOpen && (
                          <ul className="mt-1 flex flex-col gap-0.5">
                            {dayTodos.map(t => (
                              <li key={t.id} className="text-[10px] text-[#fbbf24] opacity-80 truncate">· {t.title || t.text}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}
                  {dayEvents.map(shoot => (
                    <div
                      key={shoot.id}
                      onClick={() => {
                        const pending = pendingShoots.find(p => p.id === shoot.id);
                        if (pending) setSelectedShoot(pending);
                        else {
                          setViewShoot(shoot);
                          setViewShootPhotographers(shoot.photographer_ids || []);
                          setAssignSaved(false);
                          setEsSaved(false);
                          setEsEditing(false);
                          setEsTab("info");
                          setEsAddress(shoot.address || "");
                          setEsPropertyType(shoot.property_type || "");
                          setEsSqft(shoot.square_footage ? String(shoot.square_footage) : "");
                          const addonLabels = CS_ADDONS.map(a => a.label);
                          setEsServices((shoot.services || []).filter((s: string) => !!CS_SERVICE_PRICES[s]));
                          setEsAddons((shoot.services || []).filter((s: string) => addonLabels.includes(s)));
                          setEsDatetime(shoot.scheduled_at ? toDatetimeLocal(shoot.scheduled_at) : "");
                          const notesStr = shoot.notes || "";
                          const accessMatch = notesStr.match(/^ACCESS: (.*?)(\n\n[\s\S]*)?$/);
                          if (accessMatch) {
                            setEsAccess(accessMatch[1] || "");
                            setEsNotes((accessMatch[2] || "").replace(/^\n\n/, "").trim());
                          } else {
                            setEsAccess("");
                            setEsNotes(notesStr);
                          }
                        }
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setViewShoot(null); setEsEditing(false); setEsTab("info"); }}>
              <div className="absolute inset-0 bg-black/70" />
              <div className="relative bg-[#141414] border border-[#4ade80]/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-0">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                      <p className="text-[10px] tracking-[3px] uppercase text-[#4ade80]">{viewShoot.status.replace(/_/g," ")}</p>
                    </div>
                    <p className="text-sm font-semibold">{viewShoot.address}</p>
                    {!["pending", "cancelled", "delivered", "completed"].includes(viewShoot.status) && (
                      <ShootTracker status={viewShoot.status} />
                    )}
                  </div>
                  <button onClick={() => { setViewShoot(null); setEsEditing(false); setEsTab("info"); }} className="text-[#555] hover:text-white transition-colors text-lg leading-none">✕</button>
                </div>
                {/* Tabs */}
                <div className="flex border-b border-white/10 px-6 mt-4 gap-0">
                  {(["info","edit","media"] as const).map(t => (
                    <button key={t} onClick={() => { setEsTab(t); setEsEditing(t === "edit"); }}
                      className={`text-[10px] tracking-[2px] uppercase px-4 py-2.5 border-b-2 transition-colors ${esTab === t ? "border-white text-white" : "border-transparent text-[#444] hover:text-[#888]"}`}>
                      {t === "info" ? "Info" : t === "edit" ? "✏️ Edit" : "📁 Media"}
                    </button>
                  ))}
                </div>

                {esTab === "edit" ? (
                  /* ── EDIT MODE ── */
                  <div className="p-6 space-y-5">
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Realtor</p>
                      <p className="text-sm font-medium">{viewShoot.client_name || <span className="text-[#555] italic">No contact linked</span>}</p>
                      {viewShoot.client_email && <p className="text-xs text-[#555] mt-0.5">{viewShoot.client_email}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Listing Address</p>
                      <input value={esAddress} onChange={e => { setEsAddress(e.target.value); setEsSaved(false); }}
                        className="w-full bg-[#1a1a1a] border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Property Type</p>
                      <div className="flex flex-wrap gap-2">
                        {CS_PROPERTY_TYPES.map(t => (
                          <button key={t} type="button" onClick={() => { setEsPropertyType(t === esPropertyType ? "" : t); setEsSqft(""); setEsSaved(false); }}
                            className={`text-xs px-3 py-1.5 border transition-colors ${esPropertyType === t ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Size ({ES_SIZE_UNIT})</p>
                      <input type="number" value={esSqft} onChange={e => { setEsSqft(e.target.value); setEsSaved(false); }}
                        placeholder={`Enter ${ES_SIZE_UNIT}`}
                        className="w-full bg-[#1a1a1a] border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Services</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {CS_SERVICES.map(svc => (
                          <button key={svc} type="button" onClick={() => { esToggleService(svc); setEsSaved(false); }}
                            className={`text-xs px-3 py-1.5 border transition-colors ${esServices.includes(svc) ? "border-[#4ade80]/60 text-[#4ade80] bg-[#4ade80]/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                            {svc} <span className="ml-1.5 text-[#555]">${CS_SERVICE_PRICES[svc]}</span>
                          </button>
                        ))}
                      </div>
                      {esActiveAddons.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/5">
                          <p className="w-full text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Add-ons</p>
                          {esActiveAddons.map(addon => (
                            <button key={addon.label} type="button" onClick={() => { setEsAddons(p => p.includes(addon.label) ? p.filter(x => x !== addon.label) : [...p, addon.label]); setEsSaved(false); }}
                              className={`text-xs px-3 py-1.5 border transition-colors ${esAddons.includes(addon.label) ? "border-[#fbbf24]/60 text-[#fbbf24] bg-[#fbbf24]/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                              + {addon.label} <span className="ml-1.5 text-[#555]">${addon.price}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {esAutoQuote > 0 && <p className="mt-2 text-sm text-white font-semibold">Quote: ${esAutoQuote.toLocaleString()}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Date & Time</p>
                      <input type="datetime-local" value={esDatetime} onChange={e => { setEsDatetime(e.target.value); setEsSaved(false); }}
                        className="w-full bg-[#1a1a1a] border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Photographer(s)</p>
                      <div className="flex flex-wrap gap-2">
                        {photographers.map(p => {
                          const assigned = viewShootPhotographers.includes(p.id);
                          const pgContact = contacts.find(c => c.email === p.email);
                          const avatarId = pgContact?.id || p.id;
                          return (
                            <button key={p.id} type="button"
                              onClick={() => { setEsSaved(false); setViewShootPhotographers(prev => assigned ? prev.filter(x => x !== p.id) : [...prev, p.id]); }}
                              className={`flex items-center gap-2 text-xs px-3 py-2 border transition-colors ${assigned ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                              <img
                                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarId}`}
                                alt={p.name}
                                className="w-5 h-5 rounded-full object-cover bg-white/5 shrink-0"
                                onError={e => { e.currentTarget.style.display = "none"; }}
                              />
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Property Access</p>
                      <input value={esAccess} onChange={e => { setEsAccess(e.target.value); setEsSaved(false); }}
                        placeholder="Lockbox, Supra, gate code, etc."
                        className="w-full bg-[#1a1a1a] border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Notes</p>
                      <textarea value={esNotes} onChange={e => { setEsNotes(e.target.value); setEsSaved(false); }} rows={3}
                        className="w-full bg-[#1a1a1a] border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30 resize-none" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={async () => {
                          if (!viewShoot) return;
                          setEsSaving(true);
                          try {
                            const allSvcs = [...esServices, ...esAddons];
                            const pkgName = allSvcs.length === 1 ? allSvcs[0] : allSvcs.length > 1 ? allSvcs.join(" + ") : null;
                            const combinedNotes = [esAccess ? `ACCESS: ${esAccess}` : "", esNotes].filter(Boolean).join("\n\n") || null;
                            const scheduledAtISO = esDatetime ? new Date(esDatetime).toISOString() : null;
                            const res = await fetch("/api/admin/shoots", {
                              method: "PATCH", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: viewShoot.id, status: viewShoot.status,
                                address: esAddress, property_type: esPropertyType || null,
                                square_footage: esSqft ? parseInt(esSqft) : null,
                                services: allSvcs, price: esAutoQuote || viewShoot.price || null,
                                package_name: pkgName, scheduled_at: scheduledAtISO,
                                photographer_ids: viewShootPhotographers, notes: combinedNotes,
                              }),
                            });
                            if (res.ok) {
                              setAllShoots(prev => prev.map(s => s.id === viewShoot.id ? {
                                ...s,
                                address: esAddress, property_type: esPropertyType || null,
                                square_footage: esSqft ? parseInt(esSqft) : null,
                                services: allSvcs, price: esAutoQuote || viewShoot.price || null,
                                package_name: pkgName, scheduled_at: scheduledAtISO || s.scheduled_at,
                                photographer_ids: viewShootPhotographers, notes: combinedNotes || "",
                              } : s));
                              setEsSaved(true);
                              setEsEditing(false);
                            } else {
                              const err = await res.json().catch(() => ({}));
                              alert(`Failed to save: ${err.error || res.status}`);
                            }
                          } catch (e) {
                            alert(`Save error: ${e instanceof Error ? e.message : "Unknown error"}`);
                          } finally {
                            setEsSaving(false);
                          }
                        }}
                        disabled={esSaving}
                        className="flex-1 py-2.5 text-xs tracking-[2px] uppercase font-semibold bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-40">
                        {esSaving ? "Saving..." : esSaved ? "Saved ✓" : "Save Changes"}
                      </button>
                      <button onClick={() => setEsEditing(false)} className="px-6 py-2.5 text-xs tracking-[2px] uppercase border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* ── MEDIA TAB ── */
                  esTab === "media" ? (
                    <div className="p-6">
                      <ShootGallery shootId={viewShoot.id} services={viewShoot.services || []} />
                    </div>
                  ) :
                  /* ── READ MODE ── */
                  <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-5 text-sm">
                      <div>
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Date & Time</p>
                        <p>{viewShoot.scheduled_at ? new Date(viewShoot.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · " + new Date(viewShoot.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "TBD"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Realtor</p>
                        {viewShoot.client_name ? (
                          <div className="flex items-center gap-2 mt-1">
                            {viewShoot.contact_id && (
                              <img
                                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${viewShoot.contact_id}`}
                                alt={viewShoot.client_name}
                                className="w-8 h-8 rounded-full object-cover shrink-0 bg-white/5"
                                onError={e => {
                                  const el = e.currentTarget;
                                  el.style.display = "none";
                                  const sib = el.nextElementSibling as HTMLElement | null;
                                  if (sib) sib.style.display = "flex";
                                }}
                              />
                            )}
                            {viewShoot.contact_id && (
                              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 items-center justify-center text-xs font-bold shrink-0" style={{ display: "none" }}>
                                {viewShoot.client_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm">{viewShoot.client_name}</p>
                              {viewShoot.client_email && <p className="text-xs text-[#555]">{viewShoot.client_email}</p>}
                            </div>
                          </div>
                        ) : <p className="text-[#555] italic text-sm">—</p>}
                      </div>
                      {viewShoot.property_type && (
                        <div>
                          <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Property Type</p>
                          <p>{viewShoot.property_type}</p>
                        </div>
                      )}
                      {viewShoot.square_footage && (
                        <div>
                          <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Size</p>
                          <p>{viewShoot.square_footage.toLocaleString()} {["Lot","Land"].includes(viewShoot.property_type || "") ? "acres" : "sq ft"}</p>
                        </div>
                      )}
                      {viewShoot.price && (
                        <div>
                          <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Price</p>
                          <p className="font-semibold text-[#4ade80]">${viewShoot.price.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                    {viewShoot.services?.length > 0 && (
                      <div>
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Services</p>
                        <div className="flex flex-wrap gap-1.5">
                          {viewShoot.services.map((svc: string) => (
                            <span key={svc} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80]">{svc}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewShootPhotographers.length > 0 && (
                      <div>
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Photographer(s)</p>
                        <div className="flex flex-wrap gap-3">
                          {photographers.filter(p => viewShootPhotographers.includes(p.id)).map(p => {
                            const pgContact = contacts.find(c => c.email === p.email);
                            return (
                              <div key={p.id} className="flex items-center gap-2">
                                <img
                                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${pgContact?.id || p.id}`}
                                  alt={p.name}
                                  className="w-7 h-7 rounded-full object-cover bg-white/5"
                                  onError={e => {
                                    const el = e.currentTarget;
                                    el.style.display = "none";
                                    const sib = el.nextElementSibling as HTMLElement | null;
                                    if (sib) sib.style.display = "flex";
                                  }}
                                />
                                <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 items-center justify-center text-xs font-bold shrink-0" style={{ display: "none" }}>
                                  {p.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs text-[#888]">{p.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {esAccess && (
                      <div>
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Property Access</p>
                        <p className="text-sm text-[#aaa]">{esAccess}</p>
                      </div>
                    )}
                    {esNotes && (
                      <div>
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Notes</p>
                        <p className="text-sm text-[#888]">{esNotes}</p>
                      </div>
                    )}
                    <div className="pt-2">
                      <button onClick={() => { setViewShoot(null); setEsEditing(false); setEsTab("info"); }} className="w-full py-2.5 text-xs tracking-[2px] uppercase border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">Close</button>
                    </div>
                  </div>
                )}
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
                  <p className="text-xs tracking-[3px] uppercase font-semibold">Book Shoot</p>
                  <button onClick={() => setCreateShootOpen(false)} className="text-[#555] hover:text-white transition-colors text-lg leading-none">✕</button>
                </div>

                {(
                  <div className="p-6 space-y-5">

                    {/* 1. Realtor / Contact */}
                    <div className="relative">
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Realtor / Client</p>
                      {csClient ? (
                        <div className="flex items-center gap-3 bg-[#111] border border-white/20 px-4 py-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{csClient.name}</p>
                            <p className="text-xs text-[#555]">{csClient.brokerage || csClient.email || "No brokerage"}</p>
                          </div>
                          <button type="button" onClick={() => { setCsClient(null); setCsClientSearch(""); setCsCreateNew(false); }} className="text-[#555] hover:text-white text-xs">✕</button>
                        </div>
                      ) : csCreateNew ? (
                        <div className="bg-[#111] border border-white/15 p-4 space-y-3">
                          <p className="text-[10px] tracking-[2px] uppercase text-[#4ade80]">New Contact</p>
                          <input required value={csNewName} onChange={e => setCsNewName(e.target.value)} placeholder="Name *"
                            className="w-full bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                          <div className="grid grid-cols-2 gap-2">
                            <input value={csNewPhone} onChange={e => setCsNewPhone(e.target.value)} placeholder="Phone"
                              className="bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                            <input type="email" value={csNewEmail} onChange={e => setCsNewEmail(e.target.value)} placeholder="Email"
                              className="bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                          </div>
                          <input value={csNewBrokerage} onChange={e => setCsNewBrokerage(e.target.value)} placeholder="Brokerage"
                            className="w-full bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                          <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => setCsCreateNew(false)} className="px-4 py-2 text-xs tracking-[1px] uppercase text-[#555] border border-white/10 hover:text-white transition-colors">Cancel</button>
                            <button type="button" onClick={csSaveNewContact} disabled={!csNewName.trim() || csNewSaving}
                              className="flex-1 py-2 text-xs tracking-[1px] uppercase bg-white text-black font-bold hover:bg-[#ddd] transition-colors disabled:opacity-40">
                              {csNewSaving ? "Saving..." : "Create & Select"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <input value={csClientSearch} onChange={e => csSearchContacts(e.target.value)} placeholder="Search contacts by name, email, brokerage..."
                            className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
                          {csClientResults.length > 0 && (
                            <div className="absolute z-10 w-full bg-[#1a1a1a] border border-white/20 mt-1">
                              {csClientResults.map(c => (
                                <button key={c.id} type="button" onClick={() => { setCsClient(c); setCsClientSearch(""); setCsClientResults([]); }}
                                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                                  <p className="text-sm">{c.name}</p>
                                  <p className="text-xs text-[#555]">{c.brokerage || c.email || "—"}</p>
                                </button>
                              ))}
                            </div>
                          )}
                          {csClientSearch.length > 1 && csClientResults.length === 0 && (
                            <button type="button" onClick={() => { setCsCreateNew(true); setCsNewName(csClientSearch); setCsClientSearch(""); }}
                              className="w-full mt-1 py-2.5 text-xs tracking-[1px] uppercase text-[#4ade80] border border-[#4ade80]/30 hover:bg-[#4ade80]/5 transition-colors">
                              + Create New Contact &quot;{csClientSearch}&quot;
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* 2. Address */}
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Listing Address *</p>
                      <input value={csAddress} onChange={e => setCsAddress(e.target.value)} placeholder="123 Main St, Austin TX"
                        className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    </div>

                    {/* 3. Property Type */}
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Property Type</p>
                      <div className="flex flex-wrap gap-2">
                        {CS_PROPERTY_TYPES.map(t => (
                          <button key={t} type="button" onClick={() => { setCsPropertyType(t === csPropertyType ? "" : t); setCsSqft(""); }}
                            className={`text-xs px-3 py-1.5 border transition-colors ${csPropertyType === t ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4. Size */}
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">
                        Size {CS_SIZE_UNIT === "acres" ? "(Acres)" : "(Square Footage)"}
                      </p>
                      <input type="number" value={csSqft} onChange={e => setCsSqft(e.target.value)}
                        placeholder={CS_SIZE_UNIT === "acres" ? "e.g. 2.5" : "e.g. 2400"}
                        className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    </div>

                    {/* 5. Services + auto-quote */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Services</p>
                        {csAutoQuote > 0 && (
                          <p className="text-xs font-bold text-[#4ade80]">Quoted: ${csAutoQuote.toLocaleString()}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {CS_SERVICES.map(svc => (
                          <button key={svc} type="button" onClick={() => csToggleService(svc)}
                            className={`text-xs px-3 py-1.5 border transition-colors ${csServices.includes(svc) ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                            {svc}
                            <span className="ml-1.5 text-[#555]">${CS_SERVICE_PRICES[svc]}</span>
                          </button>
                        ))}
                      </div>
                      {csActiveAddons.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-2">Add-ons</p>
                          <div className="flex flex-wrap gap-2">
                            {csActiveAddons.map(addon => (
                              <button key={addon.label} type="button"
                                onClick={() => setCsAddons(p => p.includes(addon.label) ? p.filter(x => x !== addon.label) : [...p, addon.label])}
                                className={`text-xs px-3 py-1.5 border transition-colors ${csAddons.includes(addon.label) ? "border-[#fbbf24]/60 text-[#fbbf24] bg-[#fbbf24]/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                                {addon.label}
                                <span className="ml-1.5 text-[#555]">+${addon.price}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {csAutoQuote > 0 && (
                        <p className="text-[10px] text-[#444] mt-2">Quote is a starting estimate — adjust in the shoot details after booking.</p>
                      )}
                    </div>

                    {/* 6. Date & Time */}
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Date & Time</p>
                      <input type="datetime-local" value={csDateTime} onChange={e => setCsDateTime(e.target.value)}
                        className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 [color-scheme:dark]" />
                    </div>

                    {/* 7. Property Access */}
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Property Access</p>
                      <input value={csAccess} onChange={e => setCsAccess(e.target.value)}
                        placeholder="Lockbox, gate code, supra, agent on-site..."
                        className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    </div>

                    {/* 8. Photographers */}
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

                    {/* 9. Notes */}
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Notes</p>
                      <textarea value={csNotes} onChange={e => setCsNotes(e.target.value)} rows={2} placeholder="Gate codes, special instructions, parking..."
                        className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333] resize-none" />
                    </div>

                    <button onClick={createShootFromDashboard} disabled={!csAddress.trim() || csSaving}
                      className="w-full py-4 bg-white text-black text-xs tracking-[3px] uppercase font-bold hover:bg-[#ddd] transition-colors disabled:opacity-30">
                      {csSaving ? "Booking..." : csAutoQuote > 0 ? `Book Shoot — $${csAutoQuote.toLocaleString()} Quote` : "Book Shoot + Add to Calendar"}
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
          <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-[''] flex-1">Revenue — {new Date().getFullYear()}</p>
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
        {(() => {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, "0");
          const thisKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
          const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastKey = `${lastDate.getFullYear()}-${pad(lastDate.getMonth() + 1)}`;
          const lyKey = `${now.getFullYear() - 1}-${pad(now.getMonth() + 1)}`;
          const thisMonthRev = QB.monthlyRaw[thisKey] ?? QB.revMonth;
          const lastMonthRev = QB.monthlyRaw[lastKey] ?? 0;
          const lyMonthRev = QB.monthlyRaw[lyKey] ?? 0;
          const delta = thisMonthRev - lastMonthRev;
          const lyDelta = thisMonthRev - lyMonthRev;
          const deltaStr = (d: number) => `${d >= 0 ? "+" : ""}$${Math.abs(d).toLocaleString()}`;
          const deltaColor = (d: number) => d >= 0 ? "text-[#4ade80]" : "text-red-400";
          const lyLabel = `${now.toLocaleString("en-US", { month: "short" })} ${now.getFullYear() - 1}`;
          const lastLabel = lastDate.toLocaleString("en-US", { month: "short" });
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#111] border border-white/10 p-6" style={{ borderBottom: "2px solid #4ade80" }}>
                <p className="text-xs tracking-[2px] uppercase text-[#666] mb-4">Revenue This Month</p>
                <p className={`text-3xl font-bold ${blur}`}>${QB.revMonth.toLocaleString()}</p>
                {(lastMonthRev > 0 || lyMonthRev > 0) && (
                  <div className="flex flex-col gap-0.5 mt-2">
                    {lastMonthRev > 0 && <p className={`text-xs ${deltaColor(delta)}`}>{deltaStr(delta)} vs {lastLabel}</p>}
                    {lyMonthRev > 0 && <p className={`text-xs ${deltaColor(lyDelta)}`}>{deltaStr(lyDelta)} vs {lyLabel}</p>}
                  </div>
                )}
                {lastMonthRev === 0 && lyMonthRev === 0 && <p className="text-xs text-[#444] mt-2">Sync QB for deltas</p>}
              </div>
              <Card label="Revenue YTD" value={`$${QB.revYTD.toLocaleString()}`} accent="#4ade80" sub="Year to date" valueClass={blur} />
              <Card label="Net Income YTD" value={`$${QB.netIncome.toLocaleString()}`} accent="#4ade80" sub="Year to date" valueClass={blur} />
              <Card label="Unpaid Invoices" value={QB.unpaidCount.toString()} accent="#fbbf24" sub="Outstanding balance" />
            </div>
          );
        })()}
        <div className="mt-2 text-right">
          <a href="/admin/shoots" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">View Monthly Breakdown →</a>
        </div>
      </section>
    );
    if (s === "Clients") return (
      <section key={s}>
        <p className={sectionLabel}>Invoices <HelpTip title="Invoices" content="Recent invoices synced from QuickBooks. Green = paid, red = outstanding. Use the QB sync button to pull the latest data. Unpaid count rolls into your KPI totals." /></p>
        <div className="bg-[#111] border border-white/10 overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-white/10">
            <div className="p-5">
              <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Total Invoices YTD</p>
              <p className="text-3xl font-bold tabular-nums" style={{ borderBottom: "2px solid #60a5fa", paddingBottom: "2px", display: "inline-block" }}>{QB.ytdInvoices}</p>
              <p className="text-xs text-[#444] mt-2">Synced from QuickBooks</p>
            </div>
            <div className="p-5">
              <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Invoiced YTD</p>
              <p className={`text-3xl font-bold tabular-nums transition-all duration-200 ${blur}`} style={{ borderBottom: "2px solid #4ade80", paddingBottom: "2px", display: "inline-block" }}>
                {QB.revYTD > 0 ? `$${QB.revYTD.toLocaleString()}` : "—"}
              </p>
              <p className="text-xs text-[#444] mt-2">Synced from QuickBooks</p>
            </div>
          </div>
          <div className="border-t border-white/10">
            <a href="/admin/shoots" className="block py-3 text-center text-xs tracking-[2px] uppercase text-[#555] hover:text-white hover:bg-white/[0.02] transition-all">
              View All Invoice History →
            </a>
          </div>
        </div>
      </section>
    );
    if (s === "Marketing") {
      const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay()); ws.setHours(0,0,0,0);
      const weekLogs = callLogs.filter(l => new Date(l.called_at) >= ws);
      const weekLeads = weekLogs.filter(l => ["interested","callback","booked"].includes(l.outcome));
      const weekCalledIds = new Set(weekLogs.map(l => l.contact_id).filter(Boolean));
      const weekConversions = contacts.filter(c => weekCalledIds.has(c.id) && c.stage === "client").length;
      const monthCallIds = new Set(callLogs.filter(l => l.called_at.startsWith(_thisMonthStr)).map(l => l.contact_id).filter(Boolean));
      const monthLeads = contacts.filter(c => monthCallIds.has(c.id)).length;
      const monthConversions = contacts.filter(c => monthCallIds.has(c.id) && (c.stage === "client" || c.stage === "booked")).length;
      const convPct = monthLeads > 0 ? Math.round((monthConversions / monthLeads) * 100) : 0;
      return (
        <section key={s}>
          <p className={sectionLabel}>Marketing <HelpTip title="Marketing" content="Lead pipeline overview — total contacts, leads vs. realtors, pipeline stage breakdown. For full channel attribution and tracking links, visit the Marketing Metrics page in Beta Tools." /></p>
          <div className="bg-[#111] border border-white/10">
            <div className="grid grid-cols-3 divide-x divide-white/5">
              <div className="px-5 py-5">
                <p className="text-4xl font-bold tabular-nums">{weekLogs.length}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1.5">Calls This Week</p>
              </div>
              <div className="px-5 py-5">
                <p className="text-4xl font-bold tabular-nums text-[#60a5fa]">{weekLeads.length}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1.5">Leads This Week</p>
              </div>
              <div className="px-5 py-5">
                <p className="text-4xl font-bold tabular-nums text-[#4ade80]">{monthLeads > 0 ? `${convPct}%` : "—"}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1">Lead Conversion</p>
                <p className="text-xs text-[#444] mt-0.5">{monthConversions} of {monthLeads} leads · this month</p>
              </div>
            </div>
            <div className="border-t border-white/10 grid grid-cols-2 divide-x divide-white/5">
              <a href="/admin/cold-calls"
                className="py-3 text-center text-xs tracking-[3px] uppercase font-bold bg-white text-black hover:bg-[#ddd] transition-colors">
                Start Calling →
              </a>
              <a href="/admin/marketing"
                className="py-3 text-center text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">
                View All Marketing →
              </a>
            </div>
          </div>
        </section>
      );
    }
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
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const newRealtors = realtors.filter(r => new Date(r.created_at) >= sevenDaysAgo);
      const activeContacts = contacts.filter(c => c.stage !== "deleted");
      return (
        <section key={s}>
          <p className={sectionLabel}>Contacts <HelpTip title="Contacts" content="Quick-add leads and search your contact list. Click any name to open their full profile with shoot history, health score, suggested actions, and activity timeline. Full list at /admin/contacts." /></p>
          <div className="bg-[#111] border border-white/10 flex flex-col">

            {/* Stats row */}
            <div className="grid grid-cols-4 divide-x divide-white/5 border-b border-white/10">
              <div className="p-5">
                <p className="text-3xl font-bold tabular-nums">{activeContacts.length}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1">Total</p>
              </div>
              <div className="p-5">
                <p className="text-3xl font-bold tabular-nums text-[#60a5fa]">{realtors.length}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1">Registered</p>
                {newRealtors.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
                    <span className="text-[10px] text-[#4ade80]">+{newRealtors.length} this week</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <p className="text-3xl font-bold tabular-nums text-[#4ade80]">{activeContacts.filter(c => c.stage === "client").length}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1">Clients</p>
              </div>
              <div className="p-5">
                <p className="text-3xl font-bold tabular-nums text-[#fbbf24]">{activeContacts.filter(c => c.is_hot).length}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1">Hot Leads</p>
              </div>
            </div>

            {/* Quick add form or action buttons */}
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
            ) : showInviteInline ? (
              <form onSubmit={generateClientInvite} className="p-5 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Client name" value={inviteName} onChange={e => setInviteName(e.target.value)}
                    className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 placeholder:text-[#444]" />
                  <input type="email" required placeholder="their@email.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 placeholder:text-[#444]" />
                </div>
                {inviteLink ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-mono text-[#555] break-all border border-white/5 bg-[#181818] px-3 py-2">{inviteLink}</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); }}
                        className="flex-1 py-2.5 text-xs tracking-[2px] uppercase bg-white text-black font-semibold hover:bg-[#ddd] transition-colors">
                        {inviteCopied ? "Copied!" : "Copy Link"}
                      </button>
                      <button type="button" onClick={() => { setShowInviteInline(false); setInviteLink(""); setInviteName(""); setInviteEmail(""); }}
                        className="px-4 py-2.5 text-xs tracking-[2px] uppercase text-[#555] border border-white/10 hover:text-white transition-colors">Done</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowInviteInline(false)}
                      className="px-4 py-2.5 text-xs tracking-[2px] uppercase text-[#555] border border-white/10 hover:text-white transition-colors">Cancel</button>
                    <button type="submit" disabled={inviteLoading}
                      className="flex-1 py-2.5 text-xs tracking-[2px] uppercase bg-white text-black font-semibold hover:bg-[#ddd] transition-colors disabled:opacity-40">
                      {inviteLoading ? "Generating..." : "Generate Link"}
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <div className="grid grid-cols-3 divide-x divide-white/5">
                <button onClick={() => setShowQuickAdd(true)}
                  className="py-4 text-xs tracking-[2px] uppercase text-[#555] hover:text-white hover:bg-white/[0.03] transition-all">+ New Contact</button>
                <button onClick={() => setShowInviteInline(true)}
                  className="py-4 text-xs tracking-[2px] uppercase text-[#555] hover:text-white hover:bg-white/[0.03] transition-all">+ Invite Client</button>
                <a href="/admin/contacts"
                  className="py-4 text-xs tracking-[2px] uppercase text-[#555] hover:text-white hover:bg-white/[0.03] transition-all text-center">View All →</a>
              </div>
            )}

          </div>

          {/* Top 10 clients by lifetime value */}
          {(() => {
            const top10 = [...activeContacts]
              .filter(c => (c.total_revenue || 0) > 0)
              .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
              .slice(0, 5);
            if (top10.length === 0) return null;
            return (
              <div className="mt-3 border border-white/10 bg-[#0d0d0d]">
                <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-[2px] uppercase text-[#888] font-semibold">Top Clients by Revenue</span>
                  </div>
                  <a href="/dashboard/marketing" className="text-[10px] text-[#444] hover:text-white transition-colors">Full list →</a>
                </div>
                <div className="divide-y divide-white/5">
                  {top10.map((c, i) => (
                    <a key={c.id} href={`/admin/contacts/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                      <span className="text-[10px] text-[#333] w-3 shrink-0">{i + 1}</span>
                      <span className="text-xs font-medium flex-1">{c.name}</span>
                      <span className="text-xs font-semibold text-[#4ade80]">${(c.total_revenue || 0).toLocaleString()}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* At-risk clients */}
          {(() => {
            const now = Date.now();
            const atRisk = activeContacts.filter(c => {
              if ((c.total_revenue || 0) === 0) return false;
              const score =
                (c.user_id ? 15 : 0) +
                (c.lead_source ? 10 : 0);
              // Without shoot data here, flag anyone with revenue but no portal and no source
              return score < 15 && (c.total_revenue || 0) > 0;
            }).slice(0, 5);
            if (atRisk.length === 0) return null;
            return (
              <div className="mt-3 border border-red-500/20 bg-red-500/5">
                <div className="px-4 py-2.5 border-b border-red-500/10 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-[10px] tracking-[2px] uppercase text-red-400 font-semibold">Clients at Risk</span>
                  <HelpTip title="Clients at Risk" content="Active clients who've spent money but have incomplete profiles — no portal account or unknown lead source. Check their profiles and fill in the gaps to improve their health score." />
                </div>
                <div className="divide-y divide-red-500/10">
                  {atRisk.map(c => (
                    <a key={c.id} href={`/admin/contacts/${c.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-red-500/5 transition-colors">
                      <span className="text-xs font-medium">{c.name}</span>
                      <div className="flex items-center gap-3">
                        {!c.user_id && <span className="text-[10px] text-red-400/70">No portal</span>}
                        {!c.lead_source && <span className="text-[10px] text-red-400/70">No source</span>}
                        <span className="text-[10px] text-[#4ade80]">${(c.total_revenue || 0).toLocaleString()}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>
      );
    }

    if (s === "Command Center") {
      const asapList = todoLists.find(l => l.name.toLowerCase().includes("asap")) || todoLists[0];
      const generalList = todoLists.find(l => l.name.toLowerCase().includes("general"));

      const TODO_TABS: { key: string; label: string; color: string }[] = [
        { key: "asap",    label: "ASAP",    color: "text-[#fbbf24]" },
        { key: "general", label: "General", color: "text-[#888]" },
        { key: "ryan",    label: "Ryan",    color: "text-[#4ade80]" },
        { key: "leif",    label: "Leif",    color: "text-[#60a5fa]" },
      ];

      function getTabTasks(tab: string) {
        if (tab === "asap") return asapList ? todos.filter(t => t.list_id === asapList.id) : [];
        if (tab === "general") return generalList ? todos.filter(t => t.list_id === generalList.id) : todos.filter(t => !t.list_id || t.list_id !== asapList?.id);
        return todos.filter(t => t.assigned_to === tab);
      }

      function assigneeBadge(a?: string) {
        if (a === "ryan") return <span className="text-[10px] font-bold w-4 h-4 rounded-full bg-[#4ade80]/15 text-[#4ade80] flex items-center justify-center flex-shrink-0">R</span>;
        if (a === "leif") return <span className="text-[10px] font-bold w-4 h-4 rounded-full bg-[#60a5fa]/15 text-[#60a5fa] flex items-center justify-center flex-shrink-0">L</span>;
        return null;
      }

      return (
        <section key={s}>
          <p className={sectionLabel}>Command Center <HelpTip title="Command Center" content="Quick-action buttons for the most common tasks: book a shoot, send a quote, log a call, invite a client to the portal. Shortcuts to avoid navigating deep into the app." /></p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TO DO — tabbed */}
            {(() => {
              const activeTab = todoTab;
              const tabTasks = getTabTasks(activeTab);
              const activeTabDef = TODO_TABS.find(t => t.key === activeTab)!;
              return (
                <div className="bg-[#111] border border-white/10 flex flex-col h-48">
                  {/* Tab bar */}
                  <div className="flex items-center border-b border-white/10 shrink-0">
                    {TODO_TABS.map(tab => {
                      const count = getTabTasks(tab.key).length;
                      const isActive = tab.key === activeTab;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setTodoTab(tab.key)}
                          className={`flex-1 px-2 py-2 text-[10px] tracking-[1.5px] uppercase font-semibold transition-colors border-b-2 ${
                            isActive
                              ? `${tab.color} border-current`
                              : "text-[#333] border-transparent hover:text-[#555]"
                          }`}
                        >
                          {tab.label}
                          {count > 0 && <span className={`ml-1 ${isActive ? "opacity-60" : "opacity-40"}`}>({count})</span>}
                        </button>
                      );
                    })}
                    <a href="/dashboard/todos" className="px-3 py-2 text-[10px] text-[#333] hover:text-[#666] transition-colors whitespace-nowrap border-b-2 border-transparent shrink-0">all →</a>
                  </div>
                  {/* Task list */}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {tabTasks.length === 0 && (
                      <p className="text-xs text-[#333] italic p-3">Nothing in {activeTabDef.label}.</p>
                    )}
                    {tabTasks.map(t => {
                      const title = t.title || t.text;
                      const due = t.due_date ? (() => {
                        const dt = new Date(t.due_date + "T00:00:00");
                        const today = new Date(); today.setHours(0,0,0,0);
                        const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
                        if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: "text-red-400" };
                        if (diff === 0) return { label: "Today", cls: "text-[#fbbf24]" };
                        if (diff === 1) return { label: "Tomorrow", cls: "text-[#fbbf24]" };
                        return { label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }), cls: "text-[#555]" };
                      })() : null;
                      return (
                        <div key={t.id} className="flex items-center gap-2 px-3 py-2 border-b border-white/5 hover:bg-white/[0.02]">
                          <button
                            onClick={async () => {
                              await fetch("/api/admin/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", id: t.id }) });
                              const done = todos.find(x => x.id === t.id);
                              setTodos(prev => prev.filter(x => x.id !== t.id));
                              if (done) setCompletedTodos(prev => [{ ...done, completed_at: new Date().toISOString() }, ...prev]);
                            }}
                            className="w-4 h-4 rounded-full border border-white/25 flex-shrink-0 hover:border-[#4ade80] hover:bg-[#4ade80]/10 transition-all"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate">{title}</p>
                            {due && <p className={`text-[10px] ${due.cls}`}>{due.label}</p>}
                          </div>
                          {assigneeBadge(t.assigned_to)}
                        </div>
                      );
                    })}
                  </div>
                  <a href="/dashboard/todos" className="border-t border-white/10 w-full text-left px-3 py-2 text-xs text-[#333] hover:text-[#666] transition-colors block shrink-0">
                    + Add task or view all lists →
                  </a>
                </div>
              );
            })()}

            {/* NOTIFICATION CENTER */}
            {(() => {
              const CATS: { key: string; label: string; dot: string }[] = [
                { key: "alerts",   label: "Alerts",   dot: "bg-red-500" },
                { key: "shoots",   label: "Shoots",   dot: "bg-[#60a5fa]" },
                { key: "clients",  label: "Clients",  dot: "bg-[#fbbf24]" },
                { key: "marketing",label: "Marketing",dot: "bg-[#f472b6]" },
                { key: "finance",  label: "Finance",  dot: "bg-[#4ade80]" },
                { key: "team",     label: "Team",     dot: "bg-[#fb923c]" },
                { key: "nocturne", label: "Nocturne", dot: "bg-[#a78bfa]" },
              ];
              const CAT_DOT: Record<string, string> = Object.fromEntries(CATS.map(c => [c.key, c.dot]));

              function toggleCat(key: string) {
                setActiveCategories(prev => {
                  const next = new Set(prev);
                  if (next.size === CATS.length) {
                    // All on → show only this one
                    return new Set([key]);
                  }
                  if (next.has(key) && next.size === 1) {
                    // Only one active and clicking it → back to all
                    return new Set(CATS.map(c => c.key));
                  }
                  next.has(key) ? next.delete(key) : next.add(key);
                  return next;
                });
              }

              const filtered = updates.filter(u => activeCategories.has(u.category || "nocturne"));
              const unreadCount = notifReadAt
                ? updates.filter(u => new Date(u.created_at) > notifReadAt).length
                : updates.length;

              return (
                <div className="bg-[#111] border border-white/10 flex flex-col h-80">
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs tracking-[2px] uppercase text-[#888]">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none">{unreadCount}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[10px] tracking-[1px] uppercase text-[#444] hover:text-white transition-colors">Mark all read</button>
                      )}
                      <a href="/dashboard/updates" className="text-[10px] text-[#444] hover:text-white transition-colors">View all →</a>
                    </div>
                  </div>

                  {/* Category filter chips */}
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 overflow-x-auto shrink-0">
                    {CATS.map(cat => {
                      const isActive = activeCategories.has(cat.key);
                      const count = updates.filter(u => (u.category || "nocturne") === cat.key).length;
                      return (
                        <button
                          key={cat.key}
                          onClick={() => toggleCat(cat.key)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide whitespace-nowrap transition-all shrink-0 ${
                            isActive
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-white/5 bg-transparent text-[#444] hover:text-[#666]"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? cat.dot : "bg-[#333]"}`} />
                          {cat.label}
                          {count > 0 && <span className={isActive ? "text-white/60" : "text-[#333]"}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Feed */}
                  <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-white/5">
                    {filtered.length === 0 && <p className="text-xs text-[#333] italic p-3">Nothing in this category.</p>}
                    {filtered.slice(0, 40).map(u => {
                      const isUnread = notifReadAt ? new Date(u.created_at) > notifReadAt : true;
                      const dot = CAT_DOT[u.category || "nocturne"] || "bg-white/40";
                      const isAlert = u.category === "alerts";
                      const parts = u.message.split("\n---\n");
                      const headline = parts[0];
                      const details = parts[1];
                      const isExpanded = expandedNotifId === u.id;
                      return (
                        <div key={u.id} className={`${isAlert ? "bg-red-500/5" : ""} ${isUnread ? "" : "opacity-45"}`}>
                          <div
                            className={`px-3 py-2.5 flex gap-2.5 items-start ${details ? "cursor-pointer hover:bg-white/[0.03]" : u.link ? "" : "hover:bg-white/[0.03]"} transition-colors`}
                            onClick={() => details && setExpandedNotifId(isExpanded ? null : u.id)}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dot} ${isAlert ? "animate-pulse" : ""}`} />
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs leading-snug ${isUnread ? "text-white" : "text-[#666]"}`}>{headline}</p>
                              <p className="text-[10px] text-[#333] mt-0.5">
                                {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                {" · "}
                                {new Date(u.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                {u.by ? ` · ${u.by}` : ""}
                              </p>
                            </div>
                            {details && <span className="text-[10px] text-[#444] shrink-0 mt-0.5">{isExpanded ? "▲" : "▼"}</span>}
                            {!details && u.link && <span className={`text-[10px] shrink-0 mt-0.5 ${dot.replace("bg-", "text-")}`}>→</span>}
                          </div>
                          {details && isExpanded && (
                            <div className="px-6 pb-3 space-y-1">
                              {details.split("\n").filter(Boolean).map((line, i) => (
                                <p key={i} className="text-[10px] text-[#666] leading-relaxed">{line}</p>
                              ))}
                              {u.link && <a href={u.link} className={`text-[10px] ${dot.replace("bg-", "text-")} mt-1 block`}>Open →</a>}
                            </div>
                          )}
                          {!details && u.link && (
                            <a href={u.link} className="absolute inset-0" aria-label={headline} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Post update */}
                  <form onSubmit={postUpdate} className="border-t border-white/10 flex shrink-0">
                    <input value={updateInput} onChange={e => setUpdateInput(e.target.value)} placeholder="Post an update for Leif..."
                      className="flex-1 bg-transparent text-xs px-3 py-2 outline-none placeholder:text-[#333] text-white" />
                    <button type="submit" className="px-3 py-2 text-[#555] hover:text-white transition-colors">→</button>
                  </form>
                </div>
              );
            })()}
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

      const BOARD_STAGES = [
        { key: "pending",   label: "Pending",   color: "text-[#fbbf24]", dim: "border-[#fbbf24]/20 bg-[#fbbf24]/5",  dbStatuses: ["pending"] },
        { key: "scheduled", label: "Scheduled", color: "text-[#60a5fa]", dim: "border-[#60a5fa]/20 bg-[#60a5fa]/5",  dbStatuses: ["scheduled"] },
        { key: "active",    label: "Active",    color: "text-[#f472b6]", dim: "border-[#f472b6]/20 bg-[#f472b6]/5",  dbStatuses: ["en_route", "on_site", "wrapping"] },
        { key: "editing",   label: "Editing",   color: "text-[#facc15]", dim: "border-[#facc15]/20 bg-[#facc15]/5",  dbStatuses: ["editing"] },
        { key: "delivered", label: "Delivered", color: "text-[#34d399]", dim: "border-[#34d399]/20 bg-[#34d399]/5",  dbStatuses: ["delivered"] },
        { key: "paid",      label: "Paid",      color: "text-[#4ade80]", dim: "border-[#4ade80]/20 bg-[#4ade80]/5",  dbStatuses: ["completed"] },
      ];
      const activeShootsForBoard = allShoots.filter(s => s.status !== "cancelled");
      const nowMs = Date.now();

      // Alert detection — mirrors board page logic
      const redShoots = activeShootsForBoard.filter(sh => {
        const scheduledMs = sh.scheduled_at ? new Date(sh.scheduled_at).getTime() : null;
        // No check-in 5+ min after scheduled
        if (sh.status === "scheduled" && !sh.checked_in_at && scheduledMs && nowMs > scheduledMs + 5 * 60000) return true;
        // Editing past 4pm day after shoot
        if (sh.status === "editing" && scheduledMs) {
          const due = new Date(scheduledMs); due.setDate(due.getDate() + 1); due.setHours(16, 0, 0, 0);
          if (nowMs > due.getTime()) return true;
        }
        // Invoice unpaid 24h+ after delivery
        if ((sh.status === "delivered" || sh.status === "completed") && sh.delivered_at && !sh.paid_at) {
          if (nowMs > new Date(sh.delivered_at).getTime() + 24 * 3600000) return true;
        }
        return false;
      });

      const activeCount2 = activeShootsForBoard.filter(s => s.status !== "completed").length;
      const revenueThisMonth = allShoots
        .filter(s => s.scheduled_at?.startsWith(thisMonth) && s.price)
        .reduce((sum, s) => sum + (s.price || 0), 0);

      // DEMO: inject Jules Fernandez as a red scheduled shoot (no check-in)
      const DEMO_RED: ShootEvent = { id: "demo-red-jules", client_name: "Jules Fernandez", client_email: "", address: "1840 Pine St, San Marcos", scheduled_at: new Date(Date.now() - 15 * 60000).toISOString(), status: "scheduled", services: [], notes: "", square_footage: null, photographer_ids: [], price: 225, package_name: "Listing Photos", contact_id: "ce202021-1564-4393-8e95-a75383a14e01", property_type: null, checked_in_at: null, delivered_at: null, paid_at: null };
      const boardShoots = [...activeShootsForBoard, DEMO_RED];
      const allRedShoots = [...redShoots, DEMO_RED];

      return (
        <section key={s} className="-mx-4 md:-mx-8 px-0">
          <div className="px-4 md:px-8 mb-3 flex items-center justify-between">
            <p className={sectionLabel}>Shoots <HelpTip title="Shoots" content="Full shoot log with filters by status and date. Shows the board widget (all 6 stages) and alerts for any shoot needing attention. Click View Board for the full Kanban view." /></p>
            <a href="/dashboard/board" className="text-[10px] tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">Live Board →</a>
          </div>

          {/* Red alert banner */}
          {allRedShoots.length > 0 && (
            <div className="mx-4 md:mx-8 mb-3 flex items-center gap-3 bg-red-500/10 border border-red-500/30 px-4 py-3 rounded-sm">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <p className="text-xs text-red-400 font-semibold flex-1">
                {allRedShoots.length} shoot{allRedShoots.length !== 1 ? "s" : ""} need attention —{" "}
                {allRedShoots.map(sh => sh.client_name || sh.address).join(", ")}
              </p>
              <a href="/dashboard/board" className="text-xs text-red-400 border border-red-500/30 px-3 py-1 hover:bg-red-500/20 transition-colors whitespace-nowrap">View Board →</a>
            </div>
          )}

          {/* Full-width board strip */}
          <div className="border-t border-b border-white/8 bg-[#0d0d0d] px-4 md:px-8 py-4">

            {/* Dot + line tracker */}
            <div className="grid mb-3 relative" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
              <div className="absolute top-[5px] h-px bg-white/10" style={{ left: `calc(100% / 12)`, right: `calc(100% / 12)` }} />
              {BOARD_STAGES.map(stage => {
                const count = boardShoots.filter(sh => stage.dbStatuses.includes(sh.status)).length;
                const hasRed = allRedShoots.some(sh => stage.dbStatuses.includes(sh.status));
                return (
                  <div key={stage.key} className="flex flex-col items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full border-2 relative z-10 transition-colors ${hasRed ? "bg-red-500 border-red-500" : count > 0 ? "bg-white border-white" : "bg-[#0d0d0d] border-white/20"}`} />
                    <span className={`text-[9px] tracking-[1.5px] uppercase font-semibold ${count > 0 ? "text-white" : "text-[#333]"}`}>{stage.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Stage columns */}
            <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
              {BOARD_STAGES.map(stage => {
                const count = boardShoots.filter(sh => stage.dbStatuses.includes(sh.status)).length;
                const hasRed = allRedShoots.some(sh => stage.dbStatuses.includes(sh.status));
                return (
                  <div key={stage.key} className={`border rounded-sm px-3 py-3 h-20 flex flex-col justify-between ${hasRed ? "border-red-500/30 bg-red-500/5" : count > 0 ? stage.dim : "border-white/5 bg-transparent"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] tracking-[2px] uppercase font-semibold ${hasRed ? "text-red-400" : count > 0 ? stage.color : "text-[#333]"}`}>{stage.label}</span>
                      {hasRed && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                    </div>
                    <p className={`text-3xl font-black tabular-nums leading-none ${hasRed ? "text-red-400" : count > 0 ? stage.color : "text-[#222]"}`}>{count}</p>
                  </div>
                );
              })}
            </div>

            {/* Quick stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-white/5 pt-4">
              <div>
                <p className="text-2xl font-black tabular-nums">{activeCount2}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mt-0.5">Active Shoots</p>
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums">{thisMonthCount}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mt-0.5">This Month</p>
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums text-[#4ade80]">{completedCount}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mt-0.5">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums text-[#4ade80]">${revenueThisMonth.toLocaleString()}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mt-0.5">Revenue This Month</p>
              </div>
            </div>
          </div>

          {/* Shoot log — expandable */}
          <div className="px-4 md:px-8 mt-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => { setShootLogExpanded(e => !e); if (!shootLogLoaded) loadShootLog(); }}
                className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors flex items-center gap-2"
              >
                <span>{shootLogExpanded ? "▾" : "▸"}</span> Full Shoot Log
              </button>
              <a href="/admin/shoots" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">View All →</a>
            </div>

            {shootLogExpanded && (
              <div className="space-y-3">
                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  {(["all","scheduled","completed","pending","cancelled"] as const).map(f => (
                    <button key={f} onClick={() => setShootLogFilter(f)} className={`text-[10px] tracking-[1px] uppercase px-3 py-1 border transition-colors ${shootLogFilter === f ? "border-white text-white" : "border-white/10 text-[#444] hover:text-white"}`}>{f}</button>
                  ))}
                  <select value={shootLogMonth} onChange={e => setShootLogMonth(e.target.value)} className="text-[10px] tracking-[1px] uppercase bg-transparent border border-white/10 text-[#444] px-3 py-1 ml-auto">
                    <option value="">All months</option>
                    {months.map(m => <option key={m} value={m!}>{m}</option>)}
                  </select>
                </div>

                {filtered.length === 0 ? (
                  <div className="border border-white/10 p-8 text-center text-[#333] text-sm">No shoots match this filter.</div>
                ) : filtered.map(shoot => {
                  const day = shoot.scheduled_at?.slice(0, 10) || "";
                  const hours = dayHours[day];
                  return (
                    <div key={shoot.id} className="bg-[#111] border border-white/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-medium text-sm truncate">{shoot.address}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase shrink-0 ${statusColor(shoot.status)} bg-white/5`}>{shoot.status}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-[#555]">{shoot.client_name}</span>
                            {shoot.scheduled_at && <span className="text-xs text-[#444]">{new Date(shoot.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>}
                            {shoot.package_name && <span className="text-xs text-[#333]">{shoot.package_name}</span>}
                          </div>
                          {hours && (hours.ryan > 0 || hours.leif > 0) && (
                            <div className="flex gap-3 mt-1">
                              {hours.ryan > 0 && <span className="text-[10px] text-[#333]">R: {fmtH(hours.ryan)}</span>}
                              {hours.leif > 0 && <span className="text-[10px] text-[#333]">L: {fmtH(hours.leif)}</span>}
                            </div>
                          )}
                        </div>
                        {shoot.price != null && <p className="font-bold text-[#4ade80] shrink-0">${shoot.price.toLocaleString()}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      );
    }


    if (s === "Employees") {
      const EMPLOYEE_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];
      const employees = EMPLOYEE_EMAILS
        .map(email => contacts.find(c => c.email === email))
        .filter(Boolean) as typeof contacts;
      return (
        <section key={s}>
          <p className={sectionLabel}>Team <HelpTip title="Team" content="Photographer roster with hours worked this week and this month. Click a name to see their shoot history. Time tracked automatically from shoot check-in to wrap status." /></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {employees.length === 0 && (
              <div className="bg-[#111] border border-white/10 p-6 text-xs text-[#444] italic sm:col-span-2">
                No employee contacts found — add Ryan and Leif as contacts with their work emails.
              </div>
            )}
            {employees.map(emp => (
              <div
                key={emp.id}
                onClick={() => window.location.href = `/admin/contacts/${emp.id}`}
                className="bg-[#111] border border-white/10 p-5 flex items-start gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center text-sm font-bold shrink-0">
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${emp.id}`}
                    alt={emp.name}
                    className="w-full h-full object-cover"
                    onError={e => {
                      const el = e.currentTarget;
                      el.style.display = "none";
                      const parent = el.parentElement;
                      if (parent) {
                        const span = document.createElement("span");
                        span.textContent = emp.name.charAt(0).toUpperCase();
                        parent.appendChild(span);
                      }
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="font-bold text-base leading-tight mb-1">{emp.name}</p>
                  <p className="text-[10px] tracking-[2px] uppercase mb-3">
                    <span className="text-[#fbbf24]">{emp.brokerage || "Photographer"}</span>
                    <span className="text-white/20 mx-1.5">·</span>
                    <span className="text-[#60a5fa]">Luck Images</span>
                  </p>
                  {emp.phone && (
                    <a href={`tel:${emp.phone}`} onClick={e => e.stopPropagation()} className="block text-xs text-[#888] font-mono mb-1 hover:text-white transition-colors">
                      {emp.phone}
                    </a>
                  )}
                  {emp.email && (
                    <a href={`mailto:${emp.email}`} onClick={e => e.stopPropagation()} className="block text-xs text-[#555] hover:text-white transition-colors truncate">
                      {emp.email}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }

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

    if (s === "Quote Builder") {
      const QB_PRIMARY = [
        { id: "listing_photos",     name: "Listing Photos",            tiers: [{ max: 1500, price: 200 }, { max: 2000, price: 250 }, { max: 2500, price: 300 }, { max: 3000, price: 350 }, { price: 400 }] },
        { id: "drone_photos",       name: "Drone Photos (Standalone)", tiers: [{ price: 200 }] },
        { id: "video_bronze",       name: "Video — Bronze",            tiers: [{ price: 200 }] },
        { id: "video_silver",       name: "Video — Silver (w/ Drone)", tiers: [{ price: 300 }] },
        { id: "matterport",         name: "Matterport 3D Tour",        tiers: [{ max: 2000, price: 200 }, { max: 3000, price: 300 }, { max: 4000, price: 400 }, { price: 500 }] },
        { id: "twilight_standalone",name: "Twilight (Standalone)",     tiers: [{ price: 400 }] },
        { id: "virtual_staging",    name: "Virtual Staging",           tiers: [{ price: 25 }] },
        { id: "floor_plan",         name: "Floor Plan",                tiers: [{ max: 2499, price: 50 }, { price: 75 }] },
        { id: "headshots_solo",     name: "Headshots — Solo",          tiers: [{ price: 200 }] },
      ];
      const QB_ADDONS = [
        { id: "drone_5",          name: "Drone Photos (5)",           tiers: [{ price: 100 }],                                                                                      listingOnly: false },
        { id: "drone_10",         name: "Drone Photos (10)",          tiers: [{ price: 150 }],                                                                                      listingOnly: false },
        { id: "twilight_addon",   name: "Twilight Add-On (2 photos)", tiers: [{ price: 150 }],                                                                                      listingOnly: true  },
        { id: "twilight_2nd",     name: "Twilight — 2nd Trip",        tiers: [{ price: 200 }],                                                                                      listingOnly: true  },
        { id: "matterport_addon", name: "Matterport (Add-On)",        tiers: [{ max: 2000, price: 100 }, { max: 3000, price: 150 }, { max: 4000, price: 200 }, { price: 250 }],    listingOnly: false },
        { id: "floor_plan_addon", name: "Floor Plan",                 tiers: [{ max: 2499, price: 50 }, { price: 75 }],                                                            listingOnly: true  },
        { id: "virtual_staging",  name: "Virtual Staging (per photo)",tiers: [{ price: 25 }],                                                                                       listingOnly: true  },
      ];
      const isListingPhotos = qbPrimary === "listing_photos";
      const visibleAddons = QB_ADDONS.filter(a => !a.listingOnly || isListingPhotos);
      function qbGetPrice(tiers: { max?: number; price: number }[], sqft: number) {
        for (const t of tiers) { if (!t.max || sqft <= t.max) return t.price; }
        return tiers[tiers.length - 1].price;
      }
      const sqftNum = parseFloat(qbSqft) || 0;
      const primarySvc = QB_PRIMARY.find(p => p.id === qbPrimary);
      const primaryPrice = primarySvc ? qbGetPrice(primarySvc.tiers, sqftNum) : 0;
      const addonItems = QB_ADDONS.filter(a => qbAddons.has(a.id)).map(a => ({ name: a.name, price: qbGetPrice(a.tiers, sqftNum) }));
      const total = primaryPrice + addonItems.reduce((sum, a) => sum + a.price, 0);

      async function saveQuote() {
        if (!primarySvc) return;
        setQbSaving(true);
        await fetch("/api/admin/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contact_id: qbContact?.id ?? null,
            address: qbAddress || null,
            sqft: qbSqft || null,
            primary_service: primarySvc.name,
            primary_price: primaryPrice,
            addons: addonItems,
            total,
          }),
        });
        setQbSaving(false);
        setQbSaved(true);
        setTimeout(() => setQbSaved(false), 3000);
      }

      async function createContactAndTag() {
        if (!qbNewName.trim()) return;
        setQbCreating(true);
        const { data: newContact } = await createClient().from("contacts").insert({ name: qbNewName.trim(), email: qbNewEmail.trim() || null, type: "lead", stage: "new" }).select().single();
        if (newContact) {
          setContacts(cs => [newContact, ...cs]);
          setQbContact(newContact);
          setQbContactSearch(newContact.name);
          setQbShowNewForm(false);
          setQbNewName("");
          setQbNewEmail("");
        }
        setQbCreating(false);
      }

      const filteredQbContacts = contacts.filter(c =>
        qbContactSearch.length > 0 && c.name.toLowerCase().includes(qbContactSearch.toLowerCase())
      ).slice(0, 6);

      return (
        <section key={s}>
          <div className="flex items-center justify-between mb-4">
            <p className={sectionLabel} style={{ marginBottom: 0 }}>Quote Builder <HelpTip title="Quote Builder" content="Build a custom quote by selecting a package and add-ons. Set a square footage discount, attach it to a contact, and send via email. Saved quotes appear on the client's profile." /></p>
            <a href="/dashboard/quotes" className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">View All →</a>
          </div>
          <div className="bg-[#111] border border-white/10 p-6 space-y-8">

            {/* Contact tagger */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Customer</p>
              {qbContact ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/15 px-3 py-2">
                    <span className="text-sm text-white">{qbContact.name}</span>
                    {qbContact.email && <span className="text-xs text-[#555]">{qbContact.email}</span>}
                  </div>
                  <button onClick={() => { setQbContact(null); setQbContactSearch(""); }} className="text-xs text-[#555] hover:text-white transition-colors">✕ clear</button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={qbContactSearch}
                    onChange={e => { setQbContactSearch(e.target.value); setQbShowDropdown(true); }}
                    onFocus={() => setQbShowDropdown(true)}
                    placeholder="Search existing contact..."
                    className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 w-72 transition-colors"
                  />
                  {qbShowDropdown && filteredQbContacts.length > 0 && (
                    <div className="absolute z-20 top-full left-0 w-72 bg-[#1a1a1a] border border-white/15 divide-y divide-white/5 shadow-xl">
                      {filteredQbContacts.map(c => (
                        <button key={c.id} onClick={() => { setQbContact(c); setQbContactSearch(c.name); setQbShowDropdown(false); }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors">
                          <span className="text-sm text-white">{c.name}</span>
                          <span className="text-xs text-[#555]">{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2">
                    {!qbShowNewForm ? (
                      <button onClick={() => setQbShowNewForm(true)} className="text-xs text-[#555] hover:text-white transition-colors">+ New contact</button>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input value={qbNewName} onChange={e => setQbNewName(e.target.value)} placeholder="Name" className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2 outline-none focus:border-white/30 w-36 transition-colors" />
                        <input value={qbNewEmail} onChange={e => setQbNewEmail(e.target.value)} placeholder="Email (optional)" className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2 outline-none focus:border-white/30 w-44 transition-colors" />
                        <button onClick={createContactAndTag} disabled={qbCreating || !qbNewName.trim()} className="text-xs px-3 py-2 bg-white text-black disabled:opacity-40 transition-all">{qbCreating ? "Creating..." : "Create"}</button>
                        <button onClick={() => setQbShowNewForm(false)} className="text-xs text-[#555] hover:text-white transition-colors">cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Address + Sqft */}
            <div className="flex gap-4 flex-wrap">
              <div className="flex flex-col gap-2">
                <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Property Address</p>
                <input
                  value={qbAddress}
                  onChange={e => setQbAddress(e.target.value)}
                  placeholder="123 Main St, City, TX"
                  className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 w-80 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Square Footage / Acreage</p>
                <input
                  value={qbSqft}
                  onChange={e => setQbSqft(e.target.value)}
                  placeholder="e.g. 2400"
                  className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 w-40 transition-colors"
                />
              </div>
            </div>

            {/* Primary service */}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Primary Service</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {QB_PRIMARY.map(svc => {
                  const price = qbGetPrice(svc.tiers, sqftNum);
                  const sel = qbPrimary === svc.id;
                  return (
                    <button key={svc.id} onClick={() => setQbPrimary(sel ? null : svc.id)}
                      className={`flex items-center justify-between px-4 py-3 border text-left transition-all ${sel ? "border-white bg-white/5" : "border-white/10 hover:border-white/30"}`}>
                      <span className="text-xs">{svc.name}</span>
                      <span className={`text-xs font-bold ml-2 shrink-0 ${sel ? "text-white" : "text-[#555]"}`}>${price}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add-ons */}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Add-Ons</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {visibleAddons.map(addon => {
                  const price = qbGetPrice(addon.tiers, sqftNum);
                  const sel = qbAddons.has(addon.id);
                  return (
                    <button key={addon.id} onClick={() => setQbAddons(prev => { const n = new Set(prev); sel ? n.delete(addon.id) : n.add(addon.id); return n; })}
                      className={`flex items-center justify-between px-4 py-3 border text-left transition-all ${sel ? "border-white bg-white/5" : "border-white/10 hover:border-white/30"}`}>
                      <span className="text-xs">{addon.name}</span>
                      <span className={`text-xs font-bold ml-2 shrink-0 ${sel ? "text-white" : "text-[#555]"}`}>${price}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Total */}
            {primarySvc && (
              <div className="border-t border-white/10 pt-6 flex items-end justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <p className="text-[10px] text-[#555]">{primarySvc.name} — ${primaryPrice}</p>
                  {addonItems.map(a => <p key={a.name} className="text-[10px] text-[#555]">{a.name} — ${a.price}</p>)}
                </div>
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <p className="text-3xl font-bold">${total.toLocaleString()}</p>
                  <button
                    disabled={!qbContact?.email || qbSending || !primarySvc}
                    onClick={async () => {
                      if (!qbContact?.email || !primarySvc) return;
                      setQbSending(true);
                      const html = `<!DOCTYPE html><html><body style="background:#0c0c0c;color:#fff;font-family:Arial,sans-serif;padding:40px;max-width:560px;margin:0 auto">
<p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;margin:0 0 32px">Luck Images — Real Estate Photography</p>
<h1 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;margin:0 0 8px">Your Custom Quote</h1>
${qbAddress ? `<p style="color:#888;font-size:13px;margin:0 0 32px">${qbAddress}</p>` : `<p style="margin:0 0 32px"></p>`}
<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
  <tr style="border-bottom:1px solid #222"><td style="padding:10px 0;font-size:13px">${primarySvc.name}</td><td style="padding:10px 0;font-size:13px;text-align:right;font-weight:700">$${primaryPrice}</td></tr>
  ${addonItems.map(a => `<tr style="border-bottom:1px solid #1a1a1a"><td style="padding:8px 0;font-size:12px;color:#888">${a.name}</td><td style="padding:8px 0;font-size:12px;color:#888;text-align:right">$${a.price}</td></tr>`).join("")}
  <tr><td style="padding:14px 0;font-size:16px;font-weight:900">Total</td><td style="padding:14px 0;font-size:20px;font-weight:900;text-align:right;color:#4ade80">$${total.toLocaleString()}</td></tr>
</table>
<p style="font-size:11px;color:#555;margin:32px 0 0">Questions? Reply to this email or call Ryan directly.</p>
<p style="font-size:11px;color:#333;margin:8px 0 0">luckimages.com</p>
</body></html>`;
                      await fetch("/api/admin/send-email", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contactId: qbContact.id, to: qbContact.email, subject: `Quote from Luck Images${qbAddress ? " — " + qbAddress : ""}`, html }),
                      });
                      setQbSending(false); setQbSent(true); setTimeout(() => setQbSent(false), 4000);
                    }}
                    className="text-xs tracking-[1px] uppercase px-4 py-2 border border-white/20 text-white hover:bg-white hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    {qbSent ? "Sent ✓" : qbSending ? "Sending..." : "Send Quote"}
                  </button>
                  <button onClick={saveQuote} disabled={qbSaving}
                    className="text-xs tracking-[1px] uppercase px-4 py-2 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40">
                    {qbSaved ? "Saved ✓" : qbSaving ? "Saving..." : "Save Quote"}
                  </button>
                  {qbSaved && (
                    <a href="/dashboard/quotes" className="text-xs text-[#4ade80] hover:text-white transition-colors">View in history →</a>
                  )}
                </div>
              </div>
            )}
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
          <a href="/choose-portal" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Portals</a>
          <a href="/dashboard/beta" className="text-xs tracking-[2px] uppercase text-[#a78bfa] hover:text-white transition-colors hidden sm:inline">Beta</a>
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


        {/* ── DAILY OPERATIONS BRIEFING ── */}
        {(() => {
          const todayStr = new Date().toISOString().split("T")[0];
          const todayShoots = allShoots.filter(s => s.scheduled_at?.startsWith(todayStr) && s.status !== "cancelled");
          const nowMs = Date.now();
          const alertShoots = allShoots.filter(sh => {
            const scheduledMs = sh.scheduled_at ? new Date(sh.scheduled_at).getTime() : null;
            if (sh.status === "scheduled" && !sh.checked_in_at && scheduledMs && nowMs > scheduledMs + 5 * 60000) return true;
            if (sh.status === "editing" && scheduledMs) {
              const due = new Date(scheduledMs); due.setDate(due.getDate() + 1); due.setHours(16, 0, 0, 0);
              if (nowMs > due.getTime()) return true;
            }
            if ((sh.status === "delivered") && sh.delivered_at && !sh.paid_at) {
              if (nowMs > new Date(sh.delivered_at).getTime() + 24 * 3600000) return true;
            }
            return false;
          });
          const editingShoots = allShoots.filter(s => s.status === "editing").length;
          const yesterday = new Date(Date.now() - 24 * 3600000).toISOString();
          const newLeads24h = contacts.filter(c => c.created_at > yesterday && c.stage !== "deleted").length;
          const items = [
            { icon: "📷", label: "Today's Shoots", value: todayShoots.length, detail: todayShoots.map(s => s.scheduled_at ? new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "TBD").join(" · ") || null, href: "/dashboard/board", color: todayShoots.length > 0 ? "text-white" : "text-[#444]" },
            { icon: "⚠️", label: "Needs Attention", value: alertShoots.length, detail: alertShoots.length > 0 ? alertShoots.map(s => s.client_name || s.address).join(", ") : null, href: "/dashboard/board", color: alertShoots.length > 0 ? "text-red-400" : "text-[#444]" },
            { icon: "✏️", label: "In Editing", value: editingShoots, detail: null, href: "/dashboard/board", color: editingShoots > 0 ? "text-[#fbbf24]" : "text-[#444]" },
            { icon: "💰", label: "Unpaid Invoices", value: QB.unpaidCount, detail: null, href: "/admin/shoots", color: QB.unpaidCount > 0 ? "text-[#fbbf24]" : "text-[#444]" },
            { icon: "👤", label: "New Leads (24h)", value: newLeads24h, detail: null, href: "/admin/contacts", color: newLeads24h > 0 ? "text-[#60a5fa]" : "text-[#444]" },
          ];
          return (
            <div className="bg-[#0d0d0d] border border-white/8">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
                <p className="text-[10px] tracking-[3px] uppercase text-[#555]">Morning Briefing — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 divide-x divide-white/5">
                {items.map(item => (
                  <a key={item.label} href={item.href} className="px-4 py-4 hover:bg-white/[0.02] transition-colors group flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{item.icon}</span>
                      <span className={`text-2xl font-black tabular-nums ${item.color}`}>{item.value}</span>
                    </div>
                    <p className="text-[10px] tracking-[1.5px] uppercase text-[#444]">{item.label}</p>
                    {item.detail && <p className="text-[10px] text-[#333] truncate">{item.detail}</p>}
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        {order.map(renderSection)}

      </div>
    </main>
  );
}
