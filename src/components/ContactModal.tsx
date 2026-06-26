"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatPhone, normalizePhone } from "@/lib/format";

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
};

type CallLog = {
  id: string;
  outcome: string;
  notes: string | null;
  called_at: string;
  called_by: string;
  listing_address: string | null;
};

type EmailLog = {
  id: string;
  subject: string;
  body: string | null;
  sent_at: string;
  sent_by: string;
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

type LinkedContact = {
  id: string;
  name: string;
  brokerage: string | null;
  phone: string | null;
  email: string | null;
  stage: string;
  relationship: string;
  link_id: string;
};

const STAGES = ["lead", "interested", "follow-up", "booked", "client", "dead"];
const STAGE_COLORS: Record<string, string> = {
  lead: "bg-zinc-700 text-zinc-300",
  interested: "bg-blue-900 text-blue-300",
  "follow-up": "bg-yellow-900 text-yellow-300",
  booked: "bg-green-900 text-green-300",
  client: "bg-emerald-900 text-emerald-300",
  dead: "bg-red-950 text-red-400",
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
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-[#4ade80] bg-[#4ade80]/10",
  scheduled: "text-[#60a5fa] bg-[#60a5fa]/10",
  pending: "text-[#fbbf24] bg-[#fbbf24]/10",
  cancelled: "text-[#555] bg-white/5",
};

interface Props {
  contactId: string;
  onClose: () => void;
  onContactUpdated?: () => void;
}

export default function ContactModal({ contactId, onClose, onContactUpdated }: Props) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyTab, setHistoryTab] = useState<"leads" | "shoots">("leads");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const loadContact = useCallback(async () => {
    const supabase = createClient();
    const [{ data: c }, { data: calls }, { data: emails }] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", contactId).single(),
      supabase.from("cold_calls").select("*").eq("contact_id", contactId).order("called_at", { ascending: false }),
      supabase.from("email_log").select("*").eq("contact_id", contactId).order("sent_at", { ascending: false }),
    ]);

    if (!c) { onClose(); return; }

    const shootFilter = c.user_id
      ? `contact_id.eq.${contactId},client_id.eq.${c.user_id}`
      : `contact_id.eq.${contactId}`;
    const { data: sh } = await supabase
      .from("shoots")
      .select("id, address, scheduled_at, status, package_name, services, price")
      .or(shootFilter)
      .order("scheduled_at", { ascending: false });

    setContact(c);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", brokerage: c.brokerage || "", stage: c.stage, notes: c.notes || "" });
    setCallLogs(calls || []);
    setEmailLogs(emails || []);
    setShoots(sh || []);

    const { data: links } = await supabase
      .from("contact_links")
      .select("id, contact_id_a, contact_id_b, relationship")
      .or(`contact_id_a.eq.${contactId},contact_id_b.eq.${contactId}`);

    if (links && links.length > 0) {
      const otherIds = links.map((l: { contact_id_a: string; contact_id_b: string }) =>
        l.contact_id_a === contactId ? l.contact_id_b : l.contact_id_a
      );
      const { data: linkedC } = await supabase.from("contacts").select("id, name, brokerage, phone, email, stage").in("id", otherIds);
      const enriched = (linkedC || []).map((lc: { id: string; name: string; brokerage: string | null; phone: string | null; email: string | null; stage: string }) => {
        const link = links.find((l: { contact_id_a: string; contact_id_b: string; id: string; relationship: string }) =>
          l.contact_id_a === lc.id || l.contact_id_b === lc.id
        );
        return { ...lc, relationship: link?.relationship || "Related", link_id: link?.id || "" };
      });
      setLinkedContacts(enriched);
    } else {
      setLinkedContacts([]);
    }

    setLoading(false);
  }, [contactId, onClose]);

  useEffect(() => {
    setLoading(true);
    setAvatarError(false);
    setAvatarUrl(`${supabaseUrl}/storage/v1/object/public/avatars/${contactId}?t=${Date.now()}`);
    loadContact();
  }, [contactId, loadContact, supabaseUrl]);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from("contacts").update({
      ...form,
      phone: normalizePhone(form.phone),
      updated_at: new Date().toISOString(),
    }).eq("id", contact.id).select().single();
    if (data) setContact(data);
    setSaving(false);
    setEditing(false);
    onContactUpdated?.();
  }

  async function deleteContact() {
    if (!contact) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("contacts").update({ stage: "deleted" }).eq("id", contact.id);
    setDeleting(false);
    onContactUpdated?.();
    onClose();
  }

  async function updateStage(stage: string) {
    if (!contact) return;
    const supabase = createClient();
    await supabase.from("contacts").update({ stage }).eq("id", contact.id);
    setContact(c => c ? { ...c, stage } : c);
    onContactUpdated?.();
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !contact) return;
    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append("file", e.target.files[0]);
    fd.append("contactId", contact.id);
    const res = await fetch("/api/admin/upload-avatar", { method: "POST", body: fd });
    if (res.ok) {
      setAvatarError(false);
      setAvatarUrl(`${supabaseUrl}/storage/v1/object/public/avatars/${contact.id}?t=${Date.now()}`);
    }
    setUploadingAvatar(false);
    if (avatarFileRef.current) avatarFileRef.current.value = "";
  }

  const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

  function portalStatus(): { label: string; color: string } {
    if (!contact) return { label: "No Account", color: "text-[#444] bg-white/5" };
    if (contact.email && ADMIN_EMAILS.includes(contact.email)) return { label: "Admin", color: "text-[#a78bfa] bg-[#a78bfa]/10" };
    if (!contact.user_id) return { label: "No Account", color: "text-[#444] bg-white/5" };
    const hasShoot = shoots.some(s => ["completed", "scheduled", "booked"].includes(s.status));
    if (hasShoot) return { label: "Client", color: "text-[#4ade80] bg-[#4ade80]/10" };
    return { label: "Registered", color: "text-[#60a5fa] bg-[#60a5fa]/10" };
  }

  const totalShootRevenue = shoots.filter(s => s.price).reduce((sum, s) => sum + (s.price || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      <div
        className="relative bg-[#0f0f0f] border border-white/15 w-full max-w-2xl h-[82vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
          <p className="text-xs tracking-[2px] uppercase text-[#555]">Contact</p>
          <div className="flex items-center gap-3">
            {contact && (
              <Link
                href={`/admin/contacts/${contactId}`}
                className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors"
              >
                Open Full Page →
              </Link>
            )}
            <button onClick={onClose} className="text-[#555] hover:text-white transition-colors text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-xs text-[#444] tracking-[3px] uppercase">Loading...</div>
          ) : !contact ? null : (
            <div className="p-5 space-y-5">

              {/* Avatar + name + badges */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center text-xl font-bold">
                    {!avatarError && avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={contact.name}
                        className="w-full h-full object-cover"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <span>{contact.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <button
                    onClick={() => avatarFileRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#222] border border-white/20 flex items-center justify-center hover:bg-[#333] transition-colors disabled:opacity-40"
                    title="Upload photo"
                  >
                    <span className="text-[10px]">📷</span>
                  </button>
                  <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold tracking-tight">{contact.name}</h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {contact.email && ADMIN_EMAILS.includes(contact.email) ? (
                      <>
                        {contact.brokerage && (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide uppercase text-[#fbbf24] bg-[#fbbf24]/10">
                            {contact.brokerage}
                          </span>
                        )}
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide uppercase text-[#a78bfa] bg-[#a78bfa]/10">
                          Admin
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide uppercase ${STAGE_COLORS[contact.stage] || "bg-zinc-700 text-zinc-300"}`}>
                          {contact.stage}
                        </span>
                        {(() => { const ps = portalStatus(); return (
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide uppercase ${ps.color}`}>
                            {ps.label}
                          </span>
                        ); })()}
                      </>
                    )}
                    {contact.is_hot && <span className="text-[10px] tracking-[2px] uppercase text-[#fbbf24] border border-[#fbbf24]/30 px-2 py-0.5">Hot</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs tracking-[1px] uppercase border border-white/10 px-3 py-1.5 text-[#888] hover:text-white hover:border-white/30 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs tracking-[1px] uppercase border border-red-500/20 px-3 py-1.5 text-red-500/50 hover:text-red-400 hover:border-red-500/40 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Main info card */}
              <div className="bg-[#111] border border-white/10 divide-y divide-white/5">
                <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
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
                      <a href={`mailto:${contact.email}`} className="text-sm text-[#60a5fa] break-all hover:underline">{contact.email}</a>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Stage</p>
                    <select
                      value={contact.stage}
                      onChange={e => updateStage(e.target.value)}
                      className={`text-xs px-3 py-1.5 rounded-full border-0 cursor-pointer focus:outline-none ${STAGE_COLORS[contact.stage] || "bg-zinc-700 text-zinc-300"}`}
                    >
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {contact.notes && (
                  <div className="px-5 py-4">
                    <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-2">Notes</p>
                    <textarea
                      readOnly
                      value={contact.notes}
                      rows={3}
                      className="w-full bg-transparent text-sm text-[#888] leading-relaxed resize-none outline-none"
                    />
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-3 divide-x divide-white/5">
                  <div className="p-4 text-center">
                    <p className="text-xl font-bold tabular-nums">{callLogs.length}</p>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-1">Calls</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-xl font-bold tabular-nums text-[#4ade80]">{shoots.length}</p>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-1">Shoots</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-xl font-bold tabular-nums text-[#4ade80]">
                      {totalShootRevenue > 0 ? `$${totalShootRevenue.toLocaleString()}` : "—"}
                    </p>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-1">Revenue</p>
                  </div>
                </div>

                {/* Related contacts */}
                {linkedContacts.length > 0 && (
                  <div className="p-5 space-y-2">
                    <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-2">Related To</p>
                    {linkedContacts.map(lc => (
                      <div key={lc.id} className="flex items-center justify-between gap-3 bg-[#181818] border border-white/5 px-4 py-2.5">
                        <div className="min-w-0">
                          <Link
                            href={`/admin/contacts/${lc.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {lc.name}
                          </Link>
                          <p className="text-[10px] tracking-[1px] uppercase text-[#fbbf24] mt-0.5">
                            {lc.relationship}{lc.brokerage ? ` · ${lc.brokerage}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* History tabs */}
              <div>
                <div className="flex border-b border-white/10">
                  <button
                    onClick={() => setHistoryTab("leads")}
                    className={`px-5 py-2.5 text-xs tracking-[2px] uppercase font-semibold border-b-2 transition-colors ${historyTab === "leads" ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"}`}
                  >
                    Lead History
                    {callLogs.length > 0 && <span className="ml-2 text-[#444]">({callLogs.length + emailLogs.length})</span>}
                  </button>
                  <button
                    onClick={() => setHistoryTab("shoots")}
                    className={`px-5 py-2.5 text-xs tracking-[2px] uppercase font-semibold border-b-2 transition-colors ${historyTab === "shoots" ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"}`}
                  >
                    Shoot History
                    {shoots.length > 0 && <span className="ml-2 text-[#444]">({shoots.length})</span>}
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {historyTab === "leads" && (
                    <>
                      {callLogs.length === 0 && emailLogs.length === 0 ? (
                        <div className="bg-[#111] border border-white/10 p-8 text-center">
                          <p className="text-[#333] text-sm">No lead activity yet.</p>
                        </div>
                      ) : (
                        [...callLogs.map(l => ({ kind: "call" as const, ts: l.called_at, data: l })),
                         ...emailLogs.map(l => ({ kind: "email" as const, ts: l.sent_at, data: l }))]
                          .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
                          .map((event, i) => (
                          <div key={i} className="bg-[#111] border border-white/10 p-4">
                            {event.kind === "call" && (() => {
                              const call = event.data as CallLog;
                              return (
                                <>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase border ${CALL_COLORS[call.outcome] || "text-[#555] bg-white/5 border-white/5"}`}>
                                      {CALL_LABELS[call.outcome] || call.outcome}
                                    </span>
                                    <span className="text-[10px] text-[#333]">
                                      {new Date(call.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                  </div>
                                  {call.notes && <p className="text-xs text-[#666] italic mt-1">"{call.notes}"</p>}
                                </>
                              );
                            })()}
                            {event.kind === "email" && (() => {
                              const email = event.data as EmailLog;
                              return (
                                <>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase text-[#818cf8] bg-[#818cf8]/10 border border-[#818cf8]/20">
                                      Email Sent
                                    </span>
                                    <span className="text-[10px] text-[#333]">
                                      {new Date(email.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium">{email.subject}</p>
                                </>
                              );
                            })()}
                          </div>
                        ))
                      )}
                    </>
                  )}

                  {historyTab === "shoots" && (
                    <>
                      {shoots.length === 0 ? (
                        <div className="bg-[#111] border border-white/10 p-8 text-center">
                          <p className="text-[#333] text-sm">No shoots yet.</p>
                        </div>
                      ) : (
                        shoots.map(shoot => (
                          <div key={shoot.id} className="bg-[#111] border border-white/10 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <p className="font-medium text-sm truncate">{shoot.address}</p>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase shrink-0 ${STATUS_COLORS[shoot.status] || "text-[#555] bg-white/5"}`}>
                                    {shoot.status}
                                  </span>
                                </div>
                                {shoot.scheduled_at && (
                                  <span className="text-xs text-[#555]">
                                    {new Date(shoot.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                {shoot.price != null
                                  ? <p className="font-bold text-[#4ade80]">${shoot.price.toLocaleString()}</p>
                                  : <p className="text-[#333] text-xs">—</p>
                                }
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit form overlay */}
      {editing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
          <div className="bg-[#111] border border-white/15 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-bold tracking-[2px] uppercase">Edit Contact</p>
              <button onClick={() => setEditing(false)} className="text-[#555] hover:text-white">✕</button>
            </div>
            <form onSubmit={saveEdit} className="space-y-3">
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Name *"
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone"
                  className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Email"
                  className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
              </div>
              <input value={form.brokerage} onChange={e => setForm(f => ({ ...f, brokerage: e.target.value }))}
                placeholder="Brokerage"
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30">
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes"
                rows={3}
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 resize-none placeholder:text-[#333]" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditing(false)}
                  className="flex-1 py-3 text-xs tracking-[1px] uppercase border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 text-xs tracking-[1px] uppercase bg-white text-black hover:bg-[#ddd] transition-colors font-bold disabled:opacity-40">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm overlay */}
      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-[#111] border border-red-500/20 w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold tracking-[2px] uppercase mb-2">Delete Contact?</p>
            <p className="text-xs text-[#666] mb-6">
              This will soft-delete <span className="text-white font-medium">{contact?.name}</span>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 text-xs tracking-[1px] uppercase border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-all">
                Cancel
              </button>
              <button onClick={deleteContact} disabled={deleting}
                className="flex-1 py-3 text-xs tracking-[1px] uppercase bg-red-600 text-white font-bold hover:bg-red-500 transition-colors disabled:opacity-40">
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
