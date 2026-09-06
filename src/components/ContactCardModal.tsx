"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { formatPhone } from "@/lib/format";
import { ADMIN_EMAILS } from "@/lib/constants";
import { avatarUrl } from "@/lib/avatarUrl";

const CHANNEL_LABELS: Record<string, string> = {
  "referral":          "Referral",
  "google-seo":        "Google SEO",
  "google-business":   "Google Business",
  "yelp":              "Yelp",
  "instagram":         "Instagram",
  "facebook":          "Facebook",
  "linkedin-business": "LinkedIn (Luck Images)",
  "linkedin-personal": "LinkedIn (Ryan Luck)",
  "cold-call":         "Cold Call",
  "cold-email":        "Cold Email",
  "zillow":            "Zillow / Realtor.com",
  "networking":        "Networking",
  "partnership":       "Partner Referral",
  "direct-mail":       "Direct Mail",
  "other":             "Other",
};

const STAGE_COLORS: Record<string, string> = {
  new: "bg-zinc-800 text-zinc-400",
  contacted: "bg-zinc-800 text-zinc-300",
  interested: "bg-blue-950 text-blue-400",
  "follow-up": "bg-yellow-950 text-yellow-400",
  invited: "bg-purple-950 text-purple-400",
  dead: "bg-red-950/50 text-red-600",
};

const TYPE_COLORS: Record<string, { badge: string; label: string }> = {
  lead:     { badge: "text-[#fbbf24] bg-[#fbbf24]/10",  label: "Lead" },
  realtor:  { badge: "text-[#4ade80] bg-[#4ade80]/10",  label: "Realtor" },
  employee: { badge: "text-[#60a5fa] bg-[#60a5fa]/10",  label: "Employee" },
  admin:    { badge: "text-[#a78bfa] bg-[#a78bfa]/10",  label: "Admin" },
};

const CALL_COLORS: Record<string, string> = {
  interested: "text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20",
  call_again: "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20",
  dead: "text-[#555] bg-white/5 border-white/5",
};

const CALL_LABELS: Record<string, string> = {
  interested: "Interested",
  call_again: "Call Again",
  dead: "Dead",
  no_answer: "No Answer",
  not_interested: "Not Interested",
  callback: "Callback",
  booked: "Booked",
  left_voicemail: "Left Voicemail",
  sent_text: "Sent Text",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-[#4ade80] bg-[#4ade80]/10",
  scheduled: "text-[#60a5fa] bg-[#60a5fa]/10",
  pending: "text-[#fbbf24] bg-[#fbbf24]/10",
  cancelled: "text-[#555] bg-white/5",
};
type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  type: string;
  stage: string;
  notes: string | null;
  total_invoices: number;
  total_revenue: number;
  is_hot: boolean;
  user_id: string | null;
  created_at: string;
  lead_source: string | null;
};

type CallLog = {
  id: string;
  outcome: string;
  notes: string | null;
  called_at: string;
  called_by: string;
  listing_address: string | null;
};

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  status: string;
  package_name: string | null;
  services: string[];
  price: number | null;
};

interface Props {
  contactId: string | null;
  onClose: () => void;
}

export default function ContactCardModal({ contactId, onClose }: Props) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setImgError(false);
    const supabase = createClient();
    const [{ data: c }, { data: calls }] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).single(),
      supabase.from("cold_calls").select("id,outcome,notes,called_at,called_by,listing_address").eq("contact_id", id).order("called_at", { ascending: false }),
    ]);
    if (!c) { setLoading(false); return; }

    const shootFilter = c.user_id
      ? `contact_id.eq.${id},client_id.eq.${c.user_id}`
      : `contact_id.eq.${id}`;
    const { data: sh } = await supabase
      .from("shoots")
      .select("id, address, scheduled_at, status, package_name, services, price")
      .or(shootFilter)
      .order("scheduled_at", { ascending: false });

    setContact(c);
    setCallLogs(calls || []);
    setShoots(sh || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (contactId) load(contactId);
    else { setContact(null); setCallLogs([]); setShoots([]); }
  }, [contactId, load]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!contactId) return null;

  const pricedShoots = shoots.filter(s => s.price && s.price > 0);
  const totalShootRevenue = pricedShoots.reduce((sum, s) => sum + (s.price || 0), 0);
  const completedShoots = shoots.filter(s => s.status === "completed");
  const avgPerShoot = pricedShoots.length > 0 ? Math.round(totalShootRevenue / pricedShoots.length) : 0;
  const lastShoot = shoots.find(s => s.scheduled_at);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111] border border-white/15 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-[#555] hover:text-white text-xl leading-none transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        {loading || !contact ? (
          <div className="flex items-center justify-center h-48 text-[#555] text-xs tracking-[3px] uppercase">
            {loading ? "Loading..." : "Contact not found"}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center pt-8 pb-5 px-6">
              <div className="flex items-center justify-center gap-4 mb-3">
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white/10 shrink-0">
                  {!imgError && (
                    <img
                      src={avatarUrl(contact.id)}
                      alt={contact.name}
                      className="w-full h-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white/40 pointer-events-none">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-left">{contact.name}</h2>
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {contact.email && ADMIN_EMAILS.includes(contact.email) ? (
                  <>
                    {contact.brokerage && (
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase text-[#fbbf24] bg-[#fbbf24]/10">
                        {contact.brokerage}
                      </span>
                    )}
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase text-[#a78bfa] bg-[#a78bfa]/10">
                      Admin
                    </span>
                  </>
                ) : (
                  <>
                    {(() => { const tc = TYPE_COLORS[contact.type] || TYPE_COLORS.lead; return (
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase ${tc.badge}`}>
                        {tc.label}
                      </span>
                    ); })()}
                    {contact.type === "lead" && (
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase ${STAGE_COLORS[contact.stage] || "bg-zinc-800 text-zinc-400"}`}>
                        {contact.stage}
                      </span>
                    )}
                    {contact.is_hot && (
                      <span className="text-[10px] tracking-[2px] uppercase text-[#fbbf24] border border-[#fbbf24]/30 px-2 py-0.5">
                        Hot Lead
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="px-5 pb-6 space-y-4">

              {/* Contact info */}
              <div className="bg-[#0e0e0e] border border-white/8">
                <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4">
                  {contact.brokerage && (
                    <div className="col-span-2">
                      <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Brokerage</p>
                      <p className="text-sm font-medium">{contact.brokerage}</p>
                    </div>
                  )}
                  {contact.phone && (
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Phone</p>
                      <a href={`tel:${contact.phone}`} className="text-sm text-[#4ade80] font-mono">{formatPhone(contact.phone)}</a>
                    </div>
                  )}
                  {contact.email && (
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Email</p>
                      <p className="text-sm break-all">{contact.email}</p>
                    </div>
                  )}
                  {contact.lead_source && (
                    <div>
                      <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Source</p>
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase bg-white/5 border border-white/10 text-[#888]">
                        {CHANNEL_LABELS[contact.lead_source] || contact.lead_source}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Added</p>
                    <p className="text-sm text-[#666]">
                      {new Date(contact.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Revenue metrics */}
                <div className="grid grid-cols-3 divide-x divide-white/5 border-t border-white/5">
                  <div className="p-3 text-center">
                    <p className="text-lg font-bold tabular-nums text-[#4ade80]">
                      {totalShootRevenue > 0 ? `$${totalShootRevenue.toLocaleString()}` : "—"}
                    </p>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Revenue</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-lg font-bold tabular-nums">{shoots.length}</p>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Shoots</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-lg font-bold tabular-nums text-[#4ade80]">
                      {avgPerShoot > 0 ? `$${avgPerShoot.toLocaleString()}` : "—"}
                    </p>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Avg/Shoot</p>
                  </div>
                </div>

                {/* More metrics */}
                <div className="grid grid-cols-3 divide-x divide-white/5 border-t border-white/5">
                  <div className="p-3 text-center">
                    <p className="text-sm font-semibold tabular-nums">
                      {new Date(contact.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </p>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Client Since</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-sm font-semibold tabular-nums">
                      {lastShoot?.scheduled_at
                        ? new Date(lastShoot.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </p>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Last Booking</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-lg font-bold tabular-nums">{completedShoots.length}</p>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Completed</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {contact.notes && (
                <div className="bg-[#0e0e0e] border border-white/8 px-4 py-4">
                  <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-2">Notes</p>
                  <p className="text-sm text-[#888] leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
                </div>
              )}

              {/* Lead History */}
              {callLogs.length > 0 && (
                <div className="bg-[#0e0e0e] border border-white/8">
                  <p className="px-4 py-2.5 text-[10px] tracking-[2px] uppercase text-[#444] border-b border-white/5">
                    Lead History ({callLogs.length})
                  </p>
                  <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
                    {callLogs.map(call => (
                      <div key={call.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex flex-wrap gap-1">
                            {call.outcome.split(",").map(tag => (
                              <span
                                key={tag}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase border ${CALL_COLORS[tag] || "text-[#555] bg-white/5 border-white/5"}`}
                              >
                                {CALL_LABELS[tag] || tag}
                              </span>
                            ))}
                          </div>
                          <span className="text-[10px] text-[#333] shrink-0">
                            {new Date(call.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        {call.listing_address && <p className="text-xs text-[#444]">📍 {call.listing_address}</p>}
                        {call.notes && <p className="text-xs text-[#555] italic mt-0.5">"{call.notes}"</p>}
                        <p className="text-[10px] text-[#333] mt-0.5">by {call.called_by}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shoots */}
              {shoots.length > 0 && (
                <div className="bg-[#0e0e0e] border border-white/8">
                  <p className="px-4 py-2.5 text-[10px] tracking-[2px] uppercase text-[#444] border-b border-white/5">
                    Shoots ({shoots.length})
                  </p>
                  <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
                    {shoots.map(shoot => (
                      <div key={shoot.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-medium truncate">{shoot.address}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase shrink-0 ${STATUS_COLORS[shoot.status] || "text-[#555] bg-white/5"}`}>
                              {shoot.status}
                            </span>
                          </div>
                          {shoot.scheduled_at && (
                            <p className="text-xs text-[#444]">
                              {new Date(shoot.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                        </div>
                        {shoot.price != null && (
                          <p className="font-bold text-[#4ade80] shrink-0">${shoot.price.toLocaleString()}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="flex gap-2">
                <a
                  href={`/admin/cold-calls?contact=${contact.id}`}
                  className="flex-1 text-center text-xs tracking-[1px] uppercase font-semibold border border-white/10 px-3 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all"
                >
                  📞 Log Call
                </a>
                <a
                  href={`/admin/contacts/${contact.id}`}
                  className="flex-1 text-center text-xs tracking-[1px] uppercase font-semibold border border-white/10 px-3 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all"
                >
                  View Full Profile
                </a>
              </div>

              {/* Open full profile link */}
              <div className="text-center pt-1">
                <a
                  href={`/admin/contacts/${contact.id}`}
                  className="text-[10px] tracking-[1px] uppercase text-[#444] hover:text-white transition-colors"
                >
                  Open Full Profile →
                </a>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
