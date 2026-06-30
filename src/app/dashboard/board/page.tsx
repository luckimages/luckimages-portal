"use client";

import { useEffect, useState, useCallback } from "react";
import ContactChip from "@/components/ContactChip";
import ShootGallery from "@/components/ShootGallery";

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  checked_in_at: string | null;
  delivered_at: string | null;
  paid_at: string | null;
  status: string;
  client_name: string;
  client_email: string;
  package_name: string | null;
  services: string[];
  price: number | null;
  photographer_ids: string[];
  notes: string | null;
  property_type: string | null;
  square_footage: number | null;
  contact_id: string | null;
};

const STAGES: { key: string; label: string; color: string; dim: string; dbStatuses: string[] }[] = [
  { key: "pending",   label: "Pending",   color: "text-[#fbbf24]", dim: "border-[#fbbf24]/20 bg-[#fbbf24]/5",  dbStatuses: ["pending"] },
  { key: "scheduled", label: "Scheduled", color: "text-[#60a5fa]", dim: "border-[#60a5fa]/20 bg-[#60a5fa]/5",  dbStatuses: ["scheduled"] },
  { key: "active",    label: "Active",    color: "text-[#f472b6]", dim: "border-[#f472b6]/20 bg-[#f472b6]/5",  dbStatuses: ["en_route", "on_site"] },
  { key: "editing",   label: "Editing",   color: "text-[#facc15]", dim: "border-[#facc15]/20 bg-[#facc15]/5",  dbStatuses: ["wrapping", "editing"] },
  { key: "delivered", label: "Delivered", color: "text-[#34d399]", dim: "border-[#34d399]/20 bg-[#34d399]/5",  dbStatuses: ["delivered", "completed"] },
];

function stageKey(shoot: Shoot): string {
  for (const s of STAGES) {
    if (s.dbStatuses.includes(shoot.status)) return s.key;
  }
  return "pending";
}

// "no-show"     → scheduled but no check-in 5+ min after shoot time → RED
// "late"        → checked in late (>5 min past scheduled_at) → YELLOW, persists
// "on-time"     → checked in within 5 min → GREEN, persists
// "editing-due" → in editing past 4pm the day after shoot → RED
// null          → no special state (pending/scheduled before time)
type AlertStatus = "no-show" | "late" | "on-time" | "editing-due" | "paid" | null;

function getAlertStatus(shoot: Shoot): AlertStatus {
  const now = Date.now();
  const scheduledMs = shoot.scheduled_at ? new Date(shoot.scheduled_at).getTime() : null;

  // Paid: green
  if (shoot.paid_at) return "paid";

  // Payment overdue: delivered 24h+ ago and not paid
  if ((shoot.status === "delivered" || shoot.status === "completed") && shoot.delivered_at) {
    if (now > new Date(shoot.delivered_at).getTime() + 24 * 3600000) return "no-show";
    return null;
  }

  // Editing overdue: not delivered by 4pm day after shoot (wrapping = same editing phase)
  if (["editing", "wrapping"].includes(shoot.status) && scheduledMs) {
    const dayAfter = new Date(scheduledMs);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(16, 0, 0, 0);
    if (now > dayAfter.getTime()) return "editing-due";
  }

  // Check-in states
  if (shoot.checked_in_at && scheduledMs) {
    const lateMs = new Date(shoot.checked_in_at).getTime() - scheduledMs;
    return lateMs > 5 * 60 * 1000 ? "late" : "on-time";
  }

  // No check-in timestamp but clearly on-site — treat as late, not no-show
  if (!shoot.checked_in_at && ["on_site", "wrapping"].includes(shoot.status) && scheduledMs) {
    if (now > scheduledMs + 5 * 60 * 1000) return "late";
  }

  // No check-in and still en route or scheduled — no-show
  if (!shoot.checked_in_at && ["scheduled", "en_route"].includes(shoot.status) && scheduledMs) {
    if (now > scheduledMs + 5 * 60 * 1000) return "no-show";
  }

  return null;
}

function isBehindSchedule(shoot: Shoot): boolean {
  return getAlertStatus(shoot) === "no-show";
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

function ShootCard({ shoot, onClick }: { shoot: Shoot; onClick: () => void }) {
  const alert = getAlertStatus(shoot);
  const style = alert ? ALERT_STYLES[alert] : null;
  const stage = STAGES.find(s => s.dbStatuses.includes(shoot.status));
  const mins = alert === "no-show" ? minutesBehind(shoot) : 0;

  return (
    <div
      className={`border rounded-sm p-3 flex flex-col gap-1.5 cursor-pointer hover:brightness-110 transition-all ${style ? `${style.border} ${style.bg}` : "border-white/8 bg-white/[0.02]"}`}
      onClick={onClick}
    >
      {/* Alert badge */}
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

      {/* Client + time */}
      <div>
        <ContactChip contactId={shoot.contact_id} name={shoot.client_name || shoot.client_email || "Client"} size="sm" />
        {shoot.scheduled_at && (
          <p className={`text-[10px] mt-0.5 ${alert === "no-show" ? "text-red-400" : "text-[#555]"}`}>{fmtScheduled(shoot.scheduled_at)}</p>
        )}
      </div>

      {/* Address */}
      <p className="text-[10px] text-[#666] truncate leading-snug">{shoot.address}</p>

      {/* Services / package */}
      {(shoot.package_name || shoot.services?.length > 0) && (
        <p className="text-[10px] text-[#444] truncate">
          {shoot.package_name || shoot.services?.slice(0, 2).join(", ")}
          {!shoot.package_name && shoot.services?.length > 2 ? ` +${shoot.services.length - 2}` : ""}
        </p>
      )}

      {/* Price */}
      {shoot.price != null && (
        <p className={`text-xs font-bold mt-0.5 ${stage?.color || "text-white"}`}>${shoot.price.toLocaleString()}</p>
      )}

      {/* Expand hint */}
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[9px] text-[#333] tracking-wide">click to expand</span>
        {["delivered", "completed"].includes(shoot.status) && !shoot.paid_at && (
          <span className="text-[9px] text-[#4ade80] tracking-wide">unpaid</span>
        )}
      </div>
    </div>
  );
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

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

type Photographer = { id: string; name: string; email: string };

function ShootModal({ shoot, photographers, onClose, onMarkPaid, onSave }: {
  shoot: Shoot;
  photographers: Photographer[];
  onClose: () => void;
  onMarkPaid: (id: string) => void;
  onSave: (id: string, patch: Partial<Shoot>) => void;
}) {
  const alert = getAlertStatus(shoot);
  const style = alert ? ALERT_STYLES[alert] : null;
  const stage = STAGES.find(s => s.dbStatuses.includes(shoot.status));
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
        {/* Header */}
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
            <p className="text-sm font-semibold">{shoot.address}</p>
            {!["pending", "cancelled", "delivered", "completed", "paid"].includes(shoot.status) && (
              <ShootTracker status={shoot.status} />
            )}
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors text-lg leading-none shrink-0">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6 mt-4 gap-0">
          {(["info", "edit", "media"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-[10px] tracking-[2px] uppercase px-4 py-2.5 border-b-2 transition-colors ${tab === t ? "border-white text-white" : "border-transparent text-[#444] hover:text-[#888]"}`}>
              {t === "info" ? "Info" : t === "edit" ? "✏️ Edit" : "📁 Media"}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-5 text-sm">
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Date & Time</p>
                <p>{shoot.scheduled_at
                  ? new Date(shoot.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · " + new Date(shoot.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                  : "TBD"}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Realtor</p>
                {shoot.client_name ? (
                  <div className="flex items-center gap-2 mt-1">
                    {shoot.contact_id && (
                      <img
                        src={`${SUPABASE_URL}/storage/v1/object/public/avatars/${shoot.contact_id}`}
                        alt={shoot.client_name}
                        className="w-8 h-8 rounded-full object-cover shrink-0 bg-white/5"
                        onError={e => {
                          const el = e.currentTarget;
                          el.style.display = "none";
                          const sib = el.nextElementSibling as HTMLElement | null;
                          if (sib) sib.style.display = "flex";
                        }}
                      />
                    )}
                    {shoot.contact_id && (
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 items-center justify-center text-xs font-bold shrink-0" style={{ display: "none" }}>
                        {shoot.client_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      {shoot.contact_id
                        ? <a href={`/admin/contacts/${shoot.contact_id}`} className="font-medium text-sm hover:text-[#a78bfa] transition-colors" onClick={e => e.stopPropagation()}>{shoot.client_name}</a>
                        : <p className="font-medium text-sm">{shoot.client_name}</p>}
                      {shoot.client_email && <p className="text-xs text-[#555]">{shoot.client_email}</p>}
                    </div>
                  </div>
                ) : <p className="text-[#555] italic text-sm">—</p>}
              </div>
              {shoot.property_type && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Property Type</p>
                  <p>{shoot.property_type}</p>
                </div>
              )}
              {shoot.square_footage && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Size</p>
                  <p>{shoot.square_footage.toLocaleString()} {["Lot","Land"].includes(shoot.property_type || "") ? "acres" : "sq ft"}</p>
                </div>
              )}
              {shoot.price && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Price</p>
                  <p className="font-semibold text-[#4ade80]">${shoot.price.toLocaleString()}</p>
                </div>
              )}
              {shoot.checked_in_at && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Checked In</p>
                  <p>{new Date(shoot.checked_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                </div>
              )}
              {shoot.delivered_at && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Delivered</p>
                  <p>{new Date(shoot.delivered_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {new Date(shoot.delivered_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                </div>
              )}
              {shoot.paid_at && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Paid</p>
                  <p className="text-[#4ade80]">{new Date(shoot.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
              )}
            </div>

            {shoot.services?.length > 0 && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {shoot.services.map((svc: string) => (
                    <span key={svc} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80]">{svc}</span>
                  ))}
                </div>
              </div>
            )}

            {assignedPhotographers.length > 0 && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-2">Photographer(s)</p>
                <div className="flex flex-wrap gap-3">
                  {assignedPhotographers.map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <img
                        src={`${SUPABASE_URL}/storage/v1/object/public/avatars/${p.id}`}
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
                <p className="text-sm text-[#888] leading-relaxed">{parsed.notes}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
              {shoot.contact_id && (
                <a href={`/admin/contacts/${shoot.contact_id}`} onClick={e => e.stopPropagation()}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 border border-white/20 text-white hover:bg-white/5 transition-colors">
                  View Profile →
                </a>
              )}
              {["delivered", "completed"].includes(shoot.status) && !shoot.paid_at && !shoot.id.startsWith("demo-") && (
                <button onClick={handleMarkPaid} disabled={markingPaid}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 border border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/10 transition-colors disabled:opacity-40">
                  {markingPaid ? "Marking..." : "Mark Paid ✓"}
                </button>
              )}
              {shoot.status === "scheduled" && shoot.contact_id && (
                <a href={`/dashboard/outreach?template=preshoot_checklist&contact=${shoot.contact_id}`} onClick={e => e.stopPropagation()}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 border border-white/10 text-[#888] hover:text-white transition-colors">
                  Send Checklist →
                </a>
              )}
              {["delivered", "completed"].includes(shoot.status) && shoot.contact_id && (
                <a href={`/dashboard/outreach?template=thank_you&contact=${shoot.contact_id}`} onClick={e => e.stopPropagation()}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 border border-white/10 text-[#888] hover:text-white transition-colors">
                  Send Thank You →
                </a>
              )}
            </div>
            <button onClick={onClose} className="w-full py-2.5 text-xs tracking-[2px] uppercase border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">Close</button>
          </div>
        )}

        {tab === "edit" && (
          <div className="p-6 space-y-5">
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Listing Address</p>
              <input value={esAddress} onChange={e => { setEsAddress(e.target.value); setEsSaved(false); }}
                className="w-full bg-[#1a1a1a] border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30" />
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
                  const assigned = esPhotographers.includes(p.id);
                  return (
                    <button key={p.id} type="button"
                      onClick={() => { setEsSaved(false); setEsPhotographers(prev => assigned ? prev.filter(x => x !== p.id) : [...prev, p.id]); }}
                      className={`flex items-center gap-2 text-xs px-3 py-2 border transition-colors ${assigned ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                      <img
                        src={`${SUPABASE_URL}/storage/v1/object/public/avatars/${p.id}`}
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

export default function BoardPage() {
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedShoot, setSelectedShoot] = useState<Shoot | null>(null);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);

  const load = useCallback(async () => {
    const [shootRes, pgRes] = await Promise.all([
      fetch("/api/admin/shoots?full=1"),
      fetch("/api/admin/photographers"),
    ]);
    if (shootRes.ok) {
      const data: Shoot[] = await shootRes.json();
      setShoots(data.filter(s => s.status !== "cancelled"));
      setLastRefresh(new Date());
    }
    if (pgRes.ok) {
      const pg = await pgRes.json();
      setPhotographers(pg);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const activeStages = STAGES;

  const behindCount = shoots.filter(s => ["no-show", "editing-due"].includes(getAlertStatus(s) ?? "")).length;
  const activeCount = shoots.filter(s => stageKey(s) !== "paid").length;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 gap-4 shrink-0">
        <div className="flex items-center gap-6">
          <a href="/" className="text-lg font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">← Dashboard</a>
        </div>
        <div className="flex items-center gap-4">
          {behindCount > 0 && (
            <div className="flex items-center gap-2 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold">{behindCount} behind schedule</span>
            </div>
          )}
          <span className="text-[10px] text-[#333]">
            Updated {lastRefresh.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </span>
          <button onClick={load} className="text-xs text-[#444] hover:text-white transition-colors">↻ Refresh</button>
        </div>
      </header>

      {/* Page title */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">Live</p>
            <h1 className="text-2xl font-black tracking-tight uppercase">Shoot Board</h1>
          </div>
          <span className="text-xs text-[#444]">{activeCount} active shoot{activeCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-6 pb-8">

          {/* Step tracker — dots centered over each column */}
          <div className="grid mb-4 relative" style={{ gridTemplateColumns: `repeat(${activeStages.length}, minmax(0, 1fr))` }}>
            {/* Connecting line behind dots */}
            <div className="absolute top-[5px] left-[calc(100%/(${activeStages.length}*2))] right-[calc(100%/(${activeStages.length}*2))] h-px bg-white/10" style={{ left: `calc(100% / ${activeStages.length * 2})`, right: `calc(100% / ${activeStages.length * 2})` }} />
            {activeStages.map((stage) => {
              const count = shoots.filter(s => stageKey(s) === stage.key).length;
              const hasAlert = shoots.filter(s => stageKey(s) === stage.key).some(s => ["no-show", "editing-due"].includes(getAlertStatus(s) ?? ""));
              return (
                <div key={stage.key} className="flex flex-col items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full border-2 relative z-10 transition-colors ${hasAlert ? "bg-red-500 border-red-500" : count > 0 ? "bg-white border-white" : "bg-[#0c0c0c] border-white/20"}`} />
                  <span className={`text-[9px] tracking-[1.5px] uppercase font-semibold ${count > 0 ? "text-white" : "text-[#333]"}`}>{stage.label}</span>
                </div>
              );
            })}
          </div>

          {/* Active stages board */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${activeStages.length}, minmax(0, 1fr))` }}>

            {activeStages.map(stage => {
              const stageShots = shoots.filter(s => stageKey(s) === stage.key);
              const behindInStage = stageShots.filter(s => ["no-show", "editing-due"].includes(getAlertStatus(s) ?? ""));

              return (
                <div key={stage.key} className="flex flex-col gap-2">

                  {/* Column header — fixed height so all columns align */}
                  <div className="border border-white/8 bg-white/[0.02] rounded-sm px-3 py-3 h-20 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] tracking-[2px] uppercase font-semibold text-[#444]">
                        {stage.label}
                      </span>
                      {behindInStage.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                      )}
                    </div>
                    <div>
                      <p className="text-3xl font-black tabular-nums leading-none text-white">{stageShots.length}</p>
                      {behindInStage.length > 0 && (
                        <p className="text-[10px] text-red-400 mt-0.5">{behindInStage.length} behind</p>
                      )}
                    </div>
                  </div>

                  {/* Cards — always visible on full board */}
                  {stageShots.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {/* Sort: behind schedule first, then by time */}
                      {[...stageShots]
                        .sort((a, b) => {
                          const priority = { "no-show": 0, "editing-due": 0, "late": 1, "on-time": 2, null: 3, "paid": 4 } as Record<string, number>;
                          const ap = priority[getAlertStatus(a) ?? "null"] ?? 3;
                          const bp = priority[getAlertStatus(b) ?? "null"] ?? 3;
                          if (ap !== bp) return ap - bp;
                          return (a.scheduled_at || "").localeCompare(b.scheduled_at || "");
                        })
                        .map(shoot => <ShootCard key={shoot.id} shoot={shoot} onClick={() => setSelectedShoot(shoot)} />)
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>


        </div>
      )}

      {selectedShoot && (
        <ShootModal
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
    </main>
  );
}
