"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import ContactAvatar from "@/components/ContactAvatar";
import ContactChip from "@/components/ContactChip";
import ShootGallery from "@/components/ShootGallery";
import { ADMIN_EMAILS } from "@/lib/constants";

// ── Shared types ──────────────────────────────────────────────────────────────

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  checked_in_at: string | null;
  delivered_at: string | null;
  paid_at: string | null;
  services: string[];
  notes: string | null;
  square_footage: number | null;
  property_type: string | null;
  client_id: string | null;
  client_name: string;
  client_email: string;
  contact_id: string | null;
  contact_name: string | null;
  status: string;
  photographer_ids: string[];
  price: number | null;
  package_name: string | null;
};

type Contact = { id: string; name: string; brokerage: string | null };
type Photographer = { id: string; name: string; email: string };

// ── Log-view helpers ──────────────────────────────────────────────────────────

const TRACKER_STAGES = [
  { key: "scheduled", label: "Scheduled" },
  { key: "en_route",  label: "En Route" },
  { key: "on_site",   label: "On Site" },
  { key: "wrapping",  label: "Wrapped Up" },
  { key: "delivered", label: "Delivered" },
];
const TRACKER_ORDER = ["pending", "scheduled", "en_route", "on_site", "wrapping", "editing", "delivered", "completed"];

function ShootTracker({ status }: { status: string }) {
  const cur = TRACKER_ORDER.indexOf(status);
  return (
    <div className="flex items-start gap-0 mt-2">
      {TRACKER_STAGES.map((stage, i) => {
        const idx = TRACKER_ORDER.indexOf(stage.key);
        const effectiveIdx = status === "editing" ? TRACKER_ORDER.indexOf("editing") : cur;
        const isDone = effectiveIdx > idx || status === "completed";
        const isActive = !isDone && (effectiveIdx === idx || (stage.key === "wrapping" && status === "editing"));
        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isDone ? "bg-[#4ade80]" : isActive ? "bg-white" : "bg-white/15"}`} />
              <span className={`text-[8px] tracking-[1px] uppercase whitespace-nowrap ${isActive ? "text-white" : isDone ? "text-[#4ade80]/70" : "text-[#333]"}`}>{stage.label}</span>
            </div>
            {i < TRACKER_STAGES.length - 1 && (
              <div className={`w-8 h-px mb-3.5 ${isDone ? "bg-[#4ade80]/30" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-[#4ade80] bg-[#4ade80]/10",
  scheduled: "text-[#60a5fa] bg-[#60a5fa]/10",
  pending: "text-[#fbbf24] bg-[#fbbf24]/10",
  cancelled: "text-[#555] bg-white/5",
  en_route: "text-[#a78bfa] bg-[#a78bfa]/10",
  on_site: "text-[#f472b6] bg-[#f472b6]/10",
  wrapping: "text-[#fb923c] bg-[#fb923c]/10",
  editing: "text-[#fb923c] bg-[#fb923c]/10",
  delivered: "text-[#4ade80] bg-[#4ade80]/5",
};

const PACKAGES = [
  { label: "Photos Only", price: 175 },
  { label: "Drone Only", price: 200 },
  { label: "Photo + Drone", price: 325 },
  { label: "Video", price: 250 },
  { label: "Matterport", price: 225 },
  { label: "Twilight", price: 250 },
  { label: "Full Package", price: 750 },
  { label: "Custom", price: 0 },
];

// ── Board-view helpers ────────────────────────────────────────────────────────

const BOARD_STAGES: { key: string; label: string; color: string; dim: string; dbStatuses: string[] }[] = [
  { key: "pending",   label: "Pending",   color: "text-[#fbbf24]", dim: "border-[#fbbf24]/20 bg-[#fbbf24]/5",  dbStatuses: ["pending"] },
  { key: "scheduled", label: "Scheduled", color: "text-[#60a5fa]", dim: "border-[#60a5fa]/20 bg-[#60a5fa]/5",  dbStatuses: ["scheduled"] },
  { key: "active",    label: "Active",    color: "text-[#f472b6]", dim: "border-[#f472b6]/20 bg-[#f472b6]/5",  dbStatuses: ["en_route", "on_site"] },
  { key: "editing",   label: "Editing",   color: "text-[#facc15]", dim: "border-[#facc15]/20 bg-[#facc15]/5",  dbStatuses: ["wrapping", "editing"] },
  { key: "delivered", label: "Delivered", color: "text-[#34d399]", dim: "border-[#34d399]/20 bg-[#34d399]/5",  dbStatuses: ["delivered", "completed"] },
];

function boardStageKey(shoot: Shoot): string {
  for (const s of BOARD_STAGES) {
    if (s.dbStatuses.includes(shoot.status)) return s.key;
  }
  return "pending";
}

type AlertStatus = "no-show" | "late" | "on-time" | "editing-due" | "paid" | null;

function getAlertStatus(shoot: Shoot): AlertStatus {
  const now = Date.now();
  const scheduledMs = shoot.scheduled_at ? new Date(shoot.scheduled_at).getTime() : null;
  if (shoot.paid_at) return "paid";
  if ((shoot.status === "delivered" || shoot.status === "completed") && shoot.delivered_at) {
    if (now > new Date(shoot.delivered_at).getTime() + 24 * 3600000) return "no-show";
    return null;
  }
  if (["editing", "wrapping"].includes(shoot.status) && scheduledMs) {
    const dayAfter = new Date(scheduledMs);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(16, 0, 0, 0);
    if (now > dayAfter.getTime()) return "editing-due";
  }
  if (shoot.checked_in_at && scheduledMs) {
    const lateMs = new Date(shoot.checked_in_at).getTime() - scheduledMs;
    return lateMs > 5 * 60 * 1000 ? "late" : "on-time";
  }
  if (!shoot.checked_in_at && ["on_site", "wrapping"].includes(shoot.status) && scheduledMs) {
    if (now > scheduledMs + 5 * 60 * 1000) return "late";
  }
  if (!shoot.checked_in_at && ["scheduled", "en_route"].includes(shoot.status) && scheduledMs) {
    if (now > scheduledMs + 5 * 60 * 1000) return "no-show";
  }
  return null;
}

function minutesBehind(shoot: Shoot): number {
  if (!shoot.scheduled_at) return 0;
  return Math.floor((Date.now() - new Date(shoot.scheduled_at).getTime()) / 60000);
}

function fmtScheduled(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const ALERT_STYLES: Record<string, { border: string; bg: string; dot: string; text: string; label: string }> = {
  "no-show":     { border: "border-red-500/40",    bg: "bg-red-500/5",    dot: "bg-red-500",    text: "text-red-400",    label: "No check-in" },
  "late":        { border: "border-yellow-400/40", bg: "bg-yellow-400/5", dot: "bg-yellow-400", text: "text-yellow-400", label: "Checked in late" },
  "on-time":     { border: "border-green-400/40",  bg: "bg-green-400/5",  dot: "bg-green-400",  text: "text-green-400",  label: "On time" },
  "paid":        { border: "border-green-400/40",  bg: "bg-green-400/5",  dot: "bg-green-400",  text: "text-green-400",  label: "Paid" },
  "editing-due": { border: "border-red-500/40",    bg: "bg-red-500/5",    dot: "bg-red-500",    text: "text-red-400",    label: "Delivery overdue" },
};

function parseNotes(raw: string | null): { access: string; notes: string } {
  const str = raw || "";
  const m = str.match(/^ACCESS: (.*?)(\n\n[\s\S]*)?$/);
  if (m) return { access: m[1] || "", notes: (m[2] || "").replace(/^\n\n/, "").trim() };
  return { access: "", notes: str };
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ── Board card ────────────────────────────────────────────────────────────────

function BoardCard({ shoot, onClick }: { shoot: Shoot; onClick: () => void }) {
  const alert = getAlertStatus(shoot);
  const style = alert ? ALERT_STYLES[alert] : null;
  const stage = BOARD_STAGES.find(s => s.dbStatuses.includes(shoot.status));
  const mins = alert === "no-show" ? minutesBehind(shoot) : 0;

  return (
    <div
      className={`border rounded-sm p-3 flex flex-col gap-1.5 cursor-pointer hover:brightness-110 transition-all ${style ? `${style.border} ${style.bg}` : "border-white/8 bg-white/[0.02]"}`}
      onClick={onClick}
    >
      {style && (
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot} ${alert === "no-show" || alert === "editing-due" ? "animate-pulse" : ""}`} />
          <span className={`text-[10px] font-semibold tracking-wide ${style.text}`}>
            {alert === "no-show" && ["delivered", "completed"].includes(shoot.status)
              ? "Invoice unpaid"
              : alert === "no-show"
              ? `${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`} — no check-in`
              : style.label}
          </span>
        </div>
      )}
      <div>
        <ContactChip contactId={shoot.contact_id} name={shoot.client_name || shoot.client_email || "Client"} size="sm" />
        {shoot.scheduled_at && (
          <p className={`text-[10px] mt-0.5 ${alert === "no-show" ? "text-red-400" : "text-[#555]"}`}>{fmtScheduled(shoot.scheduled_at)}</p>
        )}
      </div>
      <p className="text-[10px] text-[#666] truncate leading-snug">{shoot.address}</p>
      {(shoot.package_name || shoot.services?.length > 0) && (
        <p className="text-[10px] text-[#444] truncate">
          {shoot.package_name || shoot.services?.slice(0, 2).join(", ")}
          {!shoot.package_name && shoot.services?.length > 2 ? ` +${shoot.services.length - 2}` : ""}
        </p>
      )}
      {shoot.price != null && (
        <p className={`text-xs font-bold mt-0.5 ${stage?.color || "text-white"}`}>${shoot.price.toLocaleString()}</p>
      )}
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[9px] text-[#333] tracking-wide">click to expand</span>
        {["delivered", "completed"].includes(shoot.status) && !shoot.paid_at && (
          <span className="text-[9px] text-[#4ade80] tracking-wide">unpaid</span>
        )}
      </div>
    </div>
  );
}

// ── Board modal ───────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

function BoardModal({ shoot, photographers, onClose, onMarkPaid, onSave }: {
  shoot: Shoot;
  photographers: Photographer[];
  onClose: () => void;
  onMarkPaid: (id: string) => void;
  onSave: (id: string, patch: Partial<Shoot>) => void;
}) {
  const alert = getAlertStatus(shoot);
  const style = alert ? ALERT_STYLES[alert] : null;
  const stage = BOARD_STAGES.find(s => s.dbStatuses.includes(shoot.status));
  const mins = alert === "no-show" ? minutesBehind(shoot) : 0;
  const [markingPaid, setMarkingPaid] = useState(false);
  const [tab, setTab] = useState<"info" | "edit" | "media">("info");

  const parsed = parseNotes(shoot.notes);
  const [esAccess, setEsAccess] = useState(parsed.access);
  const [esNotes, setEsNotes] = useState(parsed.notes);
  const [esDatetime, setEsDatetime] = useState(shoot.scheduled_at ? toDatetimeLocal(shoot.scheduled_at) : "");
  const [esAddress, setEsAddress] = useState(shoot.address || "");
  const [esPhotographers, setEsPhotographers] = useState<string[]>(shoot.photographer_ids || []);
  const [esSaving, setEsSaving] = useState(false);
  const [esSaved, setEsSaved] = useState(false);

  async function handleMarkPaid() {
    setMarkingPaid(true);
    await fetch("/api/admin/shoots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: shoot.id, status: "paid" }) });
    onMarkPaid(shoot.id);
    setMarkingPaid(false);
    onClose();
  }

  async function handleSave() {
    setEsSaving(true);
    const combinedNotes = [esAccess ? `ACCESS: ${esAccess}` : "", esNotes].filter(Boolean).join("\n\n") || null;
    const scheduledAtISO = esDatetime ? new Date(esDatetime).toISOString() : null;
    const res = await fetch("/api/admin/shoots", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shoot.id, address: esAddress, scheduled_at: scheduledAtISO, photographer_ids: esPhotographers, notes: combinedNotes }),
    });
    if (res.ok) {
      onSave(shoot.id, { address: esAddress, scheduled_at: scheduledAtISO || shoot.scheduled_at, photographer_ids: esPhotographers, notes: combinedNotes || "" });
      setEsSaved(true);
    }
    setEsSaving(false);
  }

  const assignedPhotographers = photographers.filter(p => (shoot.photographer_ids || []).includes(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className={`relative bg-[#141414] border ${style ? style.border : "border-[#4ade80]/20"} w-full max-w-2xl max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {style ? (
                <>
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${alert === "no-show" || alert === "editing-due" ? "animate-pulse" : ""}`} />
                  <p className={`text-[10px] tracking-[3px] uppercase ${style.text}`}>
                    {alert === "no-show" && ["delivered", "completed"].includes(shoot.status)
                      ? "Invoice unpaid"
                      : alert === "no-show"
                      ? `${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`} — no check-in`
                      : style.label}
                  </p>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                  <p className="text-[10px] tracking-[3px] uppercase text-[#4ade80]">{shoot.status.replace(/_/g, " ")}</p>
                </>
              )}
            </div>
            <h2 className="text-lg font-black tracking-tight leading-tight">{shoot.address}</h2>
            {shoot.scheduled_at && <p className="text-xs text-[#555] mt-1">{fmtScheduled(shoot.scheduled_at)}</p>}
          </div>
          <button onClick={onClose} className="text-[#444] hover:text-white transition-colors text-xl leading-none shrink-0 ml-4">✕</button>
        </div>

        <div className="flex gap-0 px-6 pt-4 pb-0 border-b border-white/10">
          {(["info", "edit", "media"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-[10px] tracking-[2px] uppercase transition-colors border-b-2 -mb-px ${tab === t ? "border-white text-white" : "border-transparent text-[#444] hover:text-white"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="p-6 space-y-5">
            <ShootTracker status={shoot.status} />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Client</p>
                <ContactChip contactId={shoot.contact_id} name={shoot.client_name || shoot.client_email || "—"} />
              </div>
              {shoot.price != null && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Price</p>
                  <p className={`font-bold text-lg ${stage?.color || "text-white"}`}>${shoot.price.toLocaleString()}</p>
                </div>
              )}
              {shoot.square_footage && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Sq Ft</p>
                  <p className="text-[#ccc]">{shoot.square_footage.toLocaleString()} sq ft</p>
                </div>
              )}
            </div>
            {(shoot.package_name || shoot.services?.length > 0) && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {(shoot.package_name ? [shoot.package_name] : shoot.services).map(svc => (
                    <span key={svc} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80]">{svc}</span>
                  ))}
                </div>
              </div>
            )}
            {assignedPhotographers.length > 0 && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Photographers</p>
                <div className="flex gap-2 flex-wrap">
                  {assignedPhotographers.map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-xs text-[#888]">
                      <img src={`${SUPABASE_URL}/storage/v1/object/public/avatars/${p.id}`} alt={p.name}
                        className="w-5 h-5 rounded-full object-cover bg-white/5" onError={e => { e.currentTarget.style.display = "none"; }} />
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {parsed.access && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Property Access</p>
                <p className="text-sm text-[#aaa]">{parsed.access}</p>
              </div>
            )}
            {parsed.notes && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Notes</p>
                <p className="text-sm text-[#888] whitespace-pre-wrap">{parsed.notes}</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              {(shoot.status === "delivered" || shoot.status === "completed") && !shoot.paid_at && (
                <button onClick={handleMarkPaid} disabled={markingPaid}
                  className="flex-1 py-2.5 text-xs tracking-[2px] uppercase font-semibold bg-[#4ade80] text-black hover:bg-[#34d399] transition-colors disabled:opacity-40">
                  {markingPaid ? "Marking..." : "Mark as Paid ✓"}
                </button>
              )}
              <button onClick={() => setTab("edit")} className="flex-1 py-2.5 text-xs tracking-[2px] uppercase border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">
                Edit Details
              </button>
            </div>
          </div>
        )}

        {tab === "edit" && (
          <div className="p-6 space-y-4">
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Date & Time</p>
              <input type="datetime-local" value={esDatetime} onChange={e => { setEsDatetime(e.target.value); setEsSaved(false); }}
                className="w-full bg-[#1a1a1a] border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30" />
            </div>
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Address</p>
              <input value={esAddress} onChange={e => { setEsAddress(e.target.value); setEsSaved(false); }}
                className="w-full bg-[#1a1a1a] border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30" />
            </div>
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Photographers</p>
              <div className="flex flex-wrap gap-2">
                {photographers.map(p => {
                  const assigned = esPhotographers.includes(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => { setEsPhotographers(prev => assigned ? prev.filter(id => id !== p.id) : [...prev, p.id]); setEsSaved(false); }}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs border transition-all ${assigned ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white"}`}>
                      <img src={`${SUPABASE_URL}/storage/v1/object/public/avatars/${p.id}`} alt={p.name}
                        className="w-5 h-5 rounded-full object-cover bg-white/5 shrink-0" onError={e => { e.currentTarget.style.display = "none"; }} />
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
              <button onClick={handleSave} disabled={esSaving}
                className="flex-1 py-2.5 text-xs tracking-[2px] uppercase font-semibold bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-40">
                {esSaving ? "Saving..." : esSaved ? "Saved ✓" : "Save Changes"}
              </button>
              <button onClick={() => setTab("info")} className="px-6 py-2.5 text-xs tracking-[2px] uppercase border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {tab === "media" && (
          <div className="p-6">
            <ShootGallery shootId={shoot.id} services={shoot.services || []} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const VIEWS = ["log", "schedule", "board"] as const;
type View = (typeof VIEWS)[number];

function ShootsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [loading, setLoading] = useState(true);

  // View navigation
  const [view, setView] = useState<View>(() => {
    const v = searchParams.get("view");
    return (VIEWS as readonly string[]).includes(v ?? "") ? (v as View) : "log";
  });
  const touchStartX = useRef<number | null>(null);

  // Log-view state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");

  // Schedule-view state
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() };
  });

  // Board-view state
  const [selectedShoot, setSelectedShoot] = useState<Shoot | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Edit modal (log/schedule)
  const [editShoot, setEditShoot] = useState<Shoot | null>(null);
  const [editForm, setEditForm] = useState({ price: "", package_name: "", notes: "", status: "" });
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const loadShoots = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const res = await fetch("/api/admin/shoots?full=1");
    if (res.ok) {
      const raw = await res.json();
      const contactIds = [...new Set(raw.map((s: Shoot) => s.contact_id).filter(Boolean))] as string[];
      let contactMap: Record<string, string> = {};
      if (contactIds.length > 0) {
        const { data } = await supabase.from("contacts").select("id, name").in("id", contactIds);
        for (const c of data || []) contactMap[c.id] = c.name;
      }
      setShoots(raw.map((s: Shoot) => ({ ...s, contact_name: s.contact_id ? contactMap[s.contact_id] || null : null })));
      setLastRefresh(new Date());
    }
    const { data: c } = await supabase.from("contacts").select("id, name, brokerage").order("name");
    setContacts(c || []);
    const pgRes = await fetch("/api/admin/photographers");
    if (pgRes.ok) setPhotographers(await pgRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
      else loadShoots();
    });
  }, [router, loadShoots]);

  // Auto-refresh board every 30s
  useEffect(() => {
    if (view !== "board") return;
    const id = setInterval(loadShoots, 30000);
    return () => clearInterval(id);
  }, [view, loadShoots]);

  // Arrow key navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") setView(v => { const i = VIEWS.indexOf(v); return VIEWS[Math.max(0, i - 1)]; });
      if (e.key === "ArrowRight") setView(v => { const i = VIEWS.indexOf(v); return VIEWS[Math.min(VIEWS.length - 1, i + 1)]; });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = shoots.filter(s => {
    const name = s.contact_name || s.client_name || s.client_email || "";
    const matchSearch = !search ||
      s.address.toLowerCase().includes(search.toLowerCase()) ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      (s.package_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.services || []).some(sv => sv.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    const matchMonth = !filterMonth || (s.scheduled_at || "").startsWith(filterMonth);
    return matchSearch && matchStatus && matchMonth;
  }).sort((a, b) => new Date(b.scheduled_at || 0).getTime() - new Date(a.scheduled_at || 0).getTime());

  const availableMonths = [...new Set(shoots.map(s => s.scheduled_at?.slice(0, 7)).filter(Boolean) as string[])].sort().reverse();

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
      " · " + new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function formatMonthHeading(ym: string) {
    const [y, m] = ym.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function openEdit(shoot: Shoot) {
    setEditShoot(shoot);
    setEditForm({ price: shoot.price != null ? String(shoot.price) : "", package_name: shoot.package_name || "", notes: shoot.notes || "", status: shoot.status });
    setEditContactId(shoot.contact_id || null);
    setEditContactName(shoot.contact_name || shoot.client_name || "");
    setContactSearch("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editShoot) return;
    setSaving(true);
    await fetch("/api/admin/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editShoot.id,
        status: editForm.status,
        price: editForm.price ? Number(editForm.price) : null,
        package_name: editForm.package_name || null,
        contact_id: editContactId,
        notes: editForm.notes || null,
      }),
    });
    setSaving(false);
    setEditShoot(null);
    await loadShoots();
  }

  async function quickStatus(id: string, status: string) {
    setStatusError(e => ({ ...e, [id]: "" }));
    const res = await fetch("/api/admin/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      const d = await res.json();
      setStatusError(e => ({ ...e, [id]: d.error || "Failed" }));
      return;
    }
    setShoots(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }

  async function syncSheet() {
    setSyncing(true); setSyncMsg("");
    const res = await fetch("/api/admin/sync-shoots-sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger: "manual" }) });
    const data = await res.json();
    setSyncMsg(data.ok ? `✓ Synced ${data.rows} rows at ${data.syncedAt}` : `✗ ${data.error}`);
    setSyncing(false);
  }

  // Board computed
  const boardShoots = shoots.filter(s => s.status !== "cancelled");
  const behindCount = boardShoots.filter(s => ["no-show", "editing-due"].includes(getAlertStatus(s) ?? "")).length;

  // Log shoot card
  function LogShootCard({ shoot }: { shoot: Shoot }) {
    const [expanded, setExpanded] = useState(false);
    const clientDisplay = shoot.contact_name || shoot.client_name || shoot.client_email || null;
    const err = statusError[shoot.id];
    const shootPhotographers = photographers.filter(p => (shoot.photographer_ids || []).includes(p.id));
    const inProgress = !["pending", "cancelled", "delivered", "completed"].includes(shoot.status);
    return (
      <div className={`bg-[#111] border border-white/10 transition-colors ${shoot.status === "pending" ? "border-l-2 border-l-[#fbbf24]/50" : ""} ${expanded ? "border-white/20" : "hover:border-white/20"}`}>
        <div className="flex items-start justify-between gap-4 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{shoot.address}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {shoot.scheduled_at && <span className="text-xs text-[#888]">{formatDate(shoot.scheduled_at)}</span>}
              {clientDisplay && (
                <span className="flex items-center gap-1.5 text-xs text-[#666]">
                  <ContactAvatar contactId={shoot.contact_id} name={clientDisplay} size={18} />
                  {clientDisplay}
                </span>
              )}
              {shoot.price != null && <span className="text-xs font-bold text-[#4ade80]">${shoot.price.toLocaleString()}</span>}
            </div>
            {(shoot.package_name || (shoot.services?.length > 0)) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(shoot.package_name ? [shoot.package_name] : shoot.services).map(svc => (
                  <span key={svc} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-white/5 border border-white/10 text-[#888]">{svc}</span>
                ))}
              </div>
            )}
            {inProgress && <ShootTracker status={shoot.status} />}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] tracking-[2px] uppercase px-2 py-1 ${STATUS_COLORS[shoot.status] || "text-[#555] bg-white/5"}`}>{shoot.status.replace(/_/g, " ")}</span>
            <button onClick={e => { e.stopPropagation(); openEdit(shoot); }} className="text-[10px] uppercase tracking-[1px] text-[#444] hover:text-white transition-colors px-2">Edit</button>
            <span className="text-[#555] text-xs px-1 select-none">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
        {expanded && (
          <div className="border-t border-white/5">
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Date & Time</p>
                <p className="text-[#ccc]">{shoot.scheduled_at ? formatDate(shoot.scheduled_at) : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Realtor</p>
                {clientDisplay ? (
                  <span className="flex items-center gap-1.5 text-[#ccc]">
                    <ContactAvatar contactId={shoot.contact_id} name={clientDisplay} size={20} />
                    {clientDisplay}
                  </span>
                ) : <p className="text-[#444] italic">—</p>}
              </div>
              {shoot.price != null && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Price</p>
                  <p className="text-[#4ade80] font-semibold">${shoot.price.toLocaleString()}</p>
                </div>
              )}
              {shoot.square_footage && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Sq Ft</p>
                  <p className="text-[#ccc]">{shoot.square_footage.toLocaleString()} sq ft</p>
                </div>
              )}
              {shoot.services?.length > 0 && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Services</p>
                  <div className="flex flex-wrap gap-1.5">
                    {shoot.services.map(svc => (
                      <span key={svc} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80]">{svc}</span>
                    ))}
                  </div>
                </div>
              )}
              {shootPhotographers.length > 0 && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Photographer(s)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {shootPhotographers.map(p => (
                      <span key={p.id} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-white/5 border border-white/10 text-[#888]">{p.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {shoot.notes && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Notes</p>
                  <p className="text-[#888] text-xs">{shoot.notes}</p>
                </div>
              )}
            </div>
            <div className="px-4 pb-4 border-t border-white/5 pt-4">
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-3">Media</p>
              <ShootGallery shootId={shoot.id} services={shoot.services || []} />
            </div>
            <div className="px-4 pb-4 flex gap-2 flex-wrap border-t border-white/5 pt-3">
              {shoot.status === "pending" && (
                <button onClick={() => quickStatus(shoot.id, "scheduled")}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 bg-[#4ade80]/10 border border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/20 transition-colors">
                  Confirm
                </button>
              )}
              {(shoot.status === "pending" || shoot.status === "scheduled") && (
                <>
                  <button onClick={() => quickStatus(shoot.id, "completed")}
                    className="text-xs tracking-[1px] uppercase px-4 py-2 bg-white/5 border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">
                    Mark Complete
                  </button>
                  <button onClick={() => quickStatus(shoot.id, "cancelled")}
                    className="text-xs tracking-[1px] uppercase px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
                    Cancel
                  </button>
                </>
              )}
              {shoot.status === "completed" && (
                <button onClick={() => quickStatus(shoot.id, "scheduled")}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/20 transition-colors">
                  ↩ Undo Complete
                </button>
              )}
              {shoot.status === "cancelled" && (
                <button onClick={() => quickStatus(shoot.id, "scheduled")}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 bg-white/5 border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">
                  ↩ Reopen
                </button>
              )}
              {err && <p className="text-xs text-red-400 self-center">{err}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  const VIEW_LABELS: Record<View, string> = { log: "Shoot Log", schedule: "Schedule", board: "Board" };

  return (
    <div
      className="min-h-screen bg-[#0c0c0c] text-white"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 60) {
          const i = VIEWS.indexOf(view);
          if (dx < 0 && i < VIEWS.length - 1) setView(VIEWS[i + 1]);
          if (dx > 0 && i > 0) setView(VIEWS[i - 1]);
        }
        touchStartX.current = null;
      }}
    >
      {/* Nav */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between gap-4">
        <button onClick={() => router.push("/dashboard?page=apps")} className="text-[#555] text-sm hover:text-white transition-colors shrink-0">← Dashboard</button>

        {/* 3-tab toggle */}
        <div className="flex border border-white/10 overflow-hidden">
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-xs tracking-[1px] uppercase px-4 py-2 transition-colors ${view === v ? "bg-white text-black font-bold" : "text-[#555] hover:text-white"}`}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {view === "board" && behindCount > 0 && (
            <div className="flex items-center gap-1.5 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold">{behindCount} behind</span>
            </div>
          )}
          {view === "board" && (
            <span className="text-[10px] text-[#333] hidden md:block">
              {lastRefresh.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button onClick={syncSheet} disabled={syncing}
            className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all disabled:opacity-40">
            {syncing ? "Syncing..." : "↑ Sync"}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`px-4 md:px-8 py-2 text-xs font-medium ${syncMsg.startsWith("✓") ? "bg-[#4ade80]/10 text-[#4ade80]" : "bg-red-900/20 text-red-400"}`}>
          {syncMsg}
        </div>
      )}

      {/* ── LOG VIEW ── */}
      {view === "log" && (
        <>
          <div className="max-w-4xl mx-auto px-4 md:px-8 pt-10 pb-4 flex items-end justify-between">
            <h1 className="text-4xl font-black tracking-tight leading-none uppercase">Shoot Log</h1>
            <a href="/dashboard/quotes" className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all">
              + New Quote
            </a>
          </div>

          <div className="max-w-4xl mx-auto px-4 md:px-8 pb-4 flex items-center gap-3 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search address, client, package..."
              className="flex-1 min-w-[200px] bg-[#111] border border-white/10 text-white text-xs px-4 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-[#111] border border-white/10 text-xs text-[#888] px-3 py-2.5 outline-none focus:border-white/30">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="en_route">En Route</option>
              <option value="on_site">On Site</option>
              <option value="wrapping">Wrapped Up</option>
              <option value="editing">Editing</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className="bg-[#111] border border-white/10 text-xs text-[#888] px-3 py-2.5 outline-none focus:border-white/30">
              <option value="">All months</option>
              {availableMonths.map(m => <option key={m} value={m}>{formatMonthHeading(m)}</option>)}
            </select>
            {(search || filterStatus !== "all" || filterMonth) && (
              <button onClick={() => { setSearch(""); setFilterStatus("all"); setFilterMonth(""); }}
                className="text-xs text-[#555] hover:text-white transition-colors">Clear</button>
            )}
            <span className="text-xs text-[#444] ml-auto">{filtered.length} shoots</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-xs text-[#444] tracking-[3px] uppercase">Loading...</div>
          ) : (
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
              {filtered.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-xs text-[#444] tracking-[3px] uppercase">No shoots found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(s => <LogShootCard key={s.id} shoot={s} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── SCHEDULE VIEW ── */}
      {view === "schedule" && (() => {
        const { year, month } = calMonth;
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startOffset = (firstDay.getDay() + 6) % 7;
        const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
        const cells = Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          return dayNum >= 1 && dayNum <= lastDay.getDate() ? dayNum : null;
        });
        const today = new Date();
        const monthLabel = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
        const monthShoots = shoots.filter(s => s.scheduled_at?.startsWith(monthStr));
        const monthRevenue = monthShoots.reduce((sum, s) => sum + (s.price || 0), 0);
        const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        function prevMonth() { setCalMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }); }
        function nextMonth() { setCalMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }); }

        return (
          <div className="px-4 md:px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button onClick={prevMonth} className="text-[#555] hover:text-white transition-colors text-lg px-1">‹</button>
                <h2 className="text-sm font-bold tracking-[3px] uppercase">{monthLabel}</h2>
                <button onClick={nextMonth} className="text-[#555] hover:text-white transition-colors text-lg px-1">›</button>
                {(year !== today.getFullYear() || month !== today.getMonth()) && (
                  <button onClick={() => setCalMonth({ year: today.getFullYear(), month: today.getMonth() })}
                    className="text-xs tracking-[1px] uppercase text-[#444] hover:text-white transition-colors">Today</button>
                )}
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-xs text-[#555]">{monthShoots.length} shoot{monthShoots.length !== 1 ? "s" : ""}</p>
                  {monthRevenue > 0 && <p className="text-sm font-bold text-[#4ade80]">${monthRevenue.toLocaleString()}</p>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-[10px] tracking-[2px] uppercase text-[#444] py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-white/5">
              {cells.map((dayNum, i) => {
                if (dayNum === null) return <div key={i} className="bg-[#0c0c0c] min-h-[110px]" />;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === dayNum;
                const dayEvents = shoots.filter(s => s.scheduled_at && new Date(s.scheduled_at).toISOString().split("T")[0] === dateStr);
                return (
                  <div key={i} className={`bg-[#0e0e0e] min-h-[110px] p-2 flex flex-col gap-1 ${isToday ? "ring-1 ring-inset ring-white/20" : ""}`}>
                    <p className={`text-xs font-bold mb-1 ${isToday ? "text-white" : "text-[#444]"}`}>{dayNum}</p>
                    {dayEvents.map(shoot => {
                      const time = new Date(shoot.scheduled_at!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                      const clientDisplay = shoot.contact_name || shoot.client_name || null;
                      return (
                        <button key={shoot.id} onClick={() => openEdit(shoot)}
                          className={`w-full text-left px-1.5 py-1 text-[10px] leading-tight rounded-sm border transition-colors hover:brightness-125 ${
                            shoot.status === "pending"   ? "bg-[#fbbf24]/10 border-[#fbbf24]/20 text-[#fbbf24]" :
                            shoot.status === "completed" ? "bg-[#4ade80]/10 border-[#4ade80]/20 text-[#4ade80]" :
                            shoot.status === "cancelled" ? "bg-white/[0.03] border-white/5 text-[#444]" :
                                                          "bg-[#4ade80]/5 border-[#4ade80]/15 text-[#aaa]"
                          }`}>
                          <p className="font-semibold truncate">{clientDisplay || shoot.address.split(",")[0]}</p>
                          <p className="opacity-60 truncate mt-0.5">{time}</p>
                          <p className={`text-[9px] tracking-[1px] uppercase opacity-50 mt-0.5 ${STATUS_COLORS[shoot.status]?.split(" ")[0] || ""}`}>
                            {shoot.status.replace(/_/g, " ")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {monthShoots.filter(s => !s.scheduled_at).length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-2">No date scheduled</p>
                <div className="flex flex-wrap gap-2">
                  {monthShoots.filter(s => !s.scheduled_at).map(s => (
                    <button key={s.id} onClick={() => openEdit(s)}
                      className="text-xs px-3 py-1.5 bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/20 transition-colors">
                      {s.address.split(",")[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── BOARD VIEW ── */}
      {view === "board" && (
        loading ? (
          <div className="flex items-center justify-center py-20 text-xs text-[#444] tracking-[3px] uppercase">Loading...</div>
        ) : (
          <div className="px-6 py-6">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">Live</p>
                <h1 className="text-2xl font-black tracking-tight uppercase">Shoot Board</h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[#444]">{boardShoots.length} active shoot{boardShoots.length !== 1 ? "s" : ""}</span>
                <button onClick={loadShoots} className="text-xs text-[#444] hover:text-white transition-colors">↻ Refresh</button>
              </div>
            </div>

            {/* Stage tracker */}
            <div className="grid mb-4 relative" style={{ gridTemplateColumns: `repeat(${BOARD_STAGES.length}, minmax(0, 1fr))` }}>
              <div className="absolute h-px bg-white/10" style={{ top: "5px", left: `calc(100% / ${BOARD_STAGES.length * 2})`, right: `calc(100% / ${BOARD_STAGES.length * 2})` }} />
              {BOARD_STAGES.map(stage => {
                const count = boardShoots.filter(s => boardStageKey(s) === stage.key).length;
                const hasAlert = boardShoots.filter(s => boardStageKey(s) === stage.key).some(s => ["no-show", "editing-due"].includes(getAlertStatus(s) ?? ""));
                return (
                  <div key={stage.key} className="flex flex-col items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full border-2 relative z-10 transition-colors ${hasAlert ? "bg-red-500 border-red-500" : count > 0 ? "bg-white border-white" : "bg-[#0c0c0c] border-white/20"}`} />
                    <span className={`text-[9px] tracking-[1.5px] uppercase font-semibold ${count > 0 ? "text-white" : "text-[#333]"}`}>{stage.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Columns */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${BOARD_STAGES.length}, minmax(0, 1fr))` }}>
              {BOARD_STAGES.map(stage => {
                const stageShots = boardShoots.filter(s => boardStageKey(s) === stage.key);
                const behindInStage = stageShots.filter(s => ["no-show", "editing-due"].includes(getAlertStatus(s) ?? ""));
                return (
                  <div key={stage.key} className="flex flex-col gap-2">
                    <div className="border border-white/8 bg-white/[0.02] rounded-sm px-3 py-3 h-20 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] tracking-[2px] uppercase font-semibold text-[#444]">{stage.label}</span>
                        {behindInStage.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                      </div>
                      <div>
                        <p className="text-3xl font-black tabular-nums leading-none text-white">{stageShots.length}</p>
                        {behindInStage.length > 0 && <p className="text-[10px] text-red-400 mt-0.5">{behindInStage.length} behind</p>}
                      </div>
                    </div>
                    {stageShots.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {[...stageShots]
                          .sort((a, b) => {
                            const priority: Record<string, number> = { "no-show": 0, "editing-due": 0, "late": 1, "on-time": 2, "null": 3, "paid": 4 };
                            const ap = priority[getAlertStatus(a) ?? "null"] ?? 3;
                            const bp = priority[getAlertStatus(b) ?? "null"] ?? 3;
                            if (ap !== bp) return ap - bp;
                            return (a.scheduled_at || "").localeCompare(b.scheduled_at || "");
                          })
                          .map(shoot => <BoardCard key={shoot.id} shoot={shoot} onClick={() => setSelectedShoot(shoot)} />)
                        }
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Edit modal (log/schedule) */}
      {editShoot && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => setEditShoot(null)}>
          <div className="bg-[#111] border border-white/15 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-xs font-bold tracking-[3px] uppercase">Edit Shoot</p>
                <p className="text-sm mt-1 text-[#888] truncate max-w-[280px]">{editShoot.address}</p>
                <p className="text-xs text-[#444] mt-0.5">{editShoot.scheduled_at ? formatDate(editShoot.scheduled_at) : "—"}</p>
              </div>
              <button onClick={() => setEditShoot(null)} className="text-[#555] hover:text-white text-lg leading-none">✕</button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Package</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PACKAGES.map(pkg => (
                    <button key={pkg.label} type="button"
                      onClick={() => setEditForm(f => ({ ...f, package_name: pkg.label === f.package_name ? "" : pkg.label, price: pkg.price && pkg.label !== f.package_name ? String(pkg.price) : f.price }))}
                      className={`text-xs px-3 py-1.5 border transition-all ${editForm.package_name === pkg.label ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white"}`}>
                      {pkg.label}{pkg.price ? ` · $${pkg.price}` : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Price</p>
                <div className="flex items-center bg-[#181818] border border-white/10">
                  <span className="text-xs text-[#555] px-3">$</span>
                  <input type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0" className="flex-1 bg-transparent text-white text-sm px-2 py-2.5 outline-none" />
                </div>
              </div>
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Status</p>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30">
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Contact / Client</p>
                {editContactId ? (
                  <div className="flex items-center justify-between bg-[#181818] border border-white/10 px-4 py-2.5">
                    <span className="text-sm text-white">{editContactName}</span>
                    <button type="button" onClick={() => { setEditContactId(null); setEditContactName(""); }}
                      className="text-[#444] hover:text-white text-xs transition-colors">✕ Remove</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Search contacts..."
                      className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    {contactSearch && (
                      <div className="absolute top-full left-0 right-0 bg-[#181818] border border-white/10 border-t-0 max-h-40 overflow-y-auto z-10 divide-y divide-white/5">
                        {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || (c.brokerage || "").toLowerCase().includes(contactSearch.toLowerCase())).slice(0, 6).map(c => (
                          <button key={c.id} type="button"
                            onClick={() => { setEditContactId(c.id); setEditContactName(c.name); setContactSearch(""); }}
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors">
                            <span className="font-medium">{c.name}</span>
                            {c.brokerage && <span className="text-[#555] ml-2">{c.brokerage}</span>}
                          </button>
                        ))}
                        {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).length === 0 && (
                          <p className="px-4 py-2.5 text-xs text-[#444]">No contacts found</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Notes</p>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 resize-none placeholder:text-[#333]" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditShoot(null)}
                  className="flex-1 py-3 text-xs tracking-[1px] uppercase border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 text-xs tracking-[1px] uppercase bg-white text-black font-bold hover:bg-[#ddd] transition-colors disabled:opacity-40">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Board modal */}
      {selectedShoot && (
        <BoardModal
          shoot={selectedShoot}
          photographers={photographers}
          onClose={() => setSelectedShoot(null)}
          onMarkPaid={id => setShoots(prev => prev.map(s => s.id === id ? { ...s, paid_at: new Date().toISOString(), status: "paid" } : s))}
          onSave={(id, patch) => {
            setShoots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
            setSelectedShoot(prev => prev?.id === id ? { ...prev, ...patch } : prev);
          }}
        />
      )}
    </div>
  );
}

export default function ShootsPageWrapper() {
  return (
    <Suspense>
      <ShootsPage />
    </Suspense>
  );
}
