"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatPhone, normalizePhone } from "@/lib/format";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

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

const RELATIONSHIP_TYPES = ["Spouse", "Partner", "Colleague", "Team", "Referral", "Other"];

export default function ContactProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);

  const [loading, setLoading] = useState(true);
  const [historyTab, setHistoryTab] = useState<"leads" | "shoots">("leads");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "" });
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Invite
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  // Related contacts
  const [linkSearch, setLinkSearch] = useState("");
  const [linkRelationship, setLinkRelationship] = useState("Spouse");
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [linking, setLinking] = useState(false);

  const loadContact = useCallback(async () => {
    const supabase = createClient();
    const [{ data: c }, { data: calls }, { data: emails }, { data: allC }] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).single(),
      supabase.from("cold_calls").select("*").eq("contact_id", id).order("called_at", { ascending: false }),
      supabase.from("email_log").select("*").eq("contact_id", id).order("sent_at", { ascending: false }),
      supabase.from("contacts").select("id, name, brokerage, phone, email, stage").order("name"),
    ]);

    // Query shoots by contact_id OR by client_id if they have a linked portal account
    const shootFilter = c?.user_id
      ? `contact_id.eq.${id},client_id.eq.${c.user_id}`
      : `contact_id.eq.${id}`;
    const { data: sh } = await supabase
      .from("shoots")
      .select("id, address, scheduled_at, status, package_name, services, price")
      .or(shootFilter)
      .order("scheduled_at", { ascending: false });
    if (!c) { router.replace("/admin/contacts"); return; }
    setContact(c);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", brokerage: c.brokerage || "", stage: c.stage, notes: c.notes || "" });
    setNoteInput(c.notes || "");
    setCallLogs(calls || []);
    setEmailLogs(emails || []);
    setShoots(sh || []);
    setAllContacts((allC || []).filter((ct: { id: string }) => ct.id !== id) as Contact[]);

    // Load linked contacts
    const { data: links } = await supabase
      .from("contact_links")
      .select("id, contact_id_a, contact_id_b, relationship")
      .or(`contact_id_a.eq.${id},contact_id_b.eq.${id}`);

    if (links && links.length > 0) {
      const otherIds = links.map((l: { contact_id_a: string; contact_id_b: string }) =>
        l.contact_id_a === id ? l.contact_id_b : l.contact_id_a
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
  }, [id, router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
      else loadContact();
    });
  }, [router, loadContact]);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from("contacts").update({ ...form, phone: normalizePhone(form.phone), updated_at: new Date().toISOString() }).eq("id", contact.id).select().single();
    if (data) setContact(data);
    setSaving(false);
    setEditing(false);
  }

  async function saveNote() {
    if (!contact) return;
    setSavingNote(true);
    const supabase = createClient();
    await supabase.from("contacts").update({ notes: noteInput }).eq("id", contact.id);
    setContact(c => c ? { ...c, notes: noteInput } : c);
    setSavingNote(false);
  }

  async function sendInvite() {
    if (!contact?.email || inviting) return;
    setInviting(true);
    await fetch("/api/admin/invite-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: contact.id }),
    });
    setInviting(false);
    setInviteSent(true);
    await loadContact();
  }

  function portalStatus(): { label: string; color: string } {
    if (!contact) return { label: "No Account", color: "text-[#444] bg-white/5" };
    if (!contact.user_id) return { label: "No Account", color: "text-[#444] bg-white/5" };
    const hasShoot = shoots.some(s => ["completed", "scheduled", "booked"].includes(s.status));
    if (hasShoot) return { label: "Client", color: "text-[#4ade80] bg-[#4ade80]/10" };
    return { label: "Registered", color: "text-[#60a5fa] bg-[#60a5fa]/10" };
  }

  async function updateStage(stage: string) {
    if (!contact) return;
    const supabase = createClient();
    await supabase.from("contacts").update({ stage }).eq("id", contact.id);
    setContact(c => c ? { ...c, stage } : c);
  }

  async function linkContact(other: Contact) {
    setLinking(true);
    const supabase = createClient();
    await supabase.from("contact_links").insert({
      contact_id_a: id,
      contact_id_b: other.id,
      relationship: linkRelationship,
    });
    setLinking(false);
    setShowLinkSearch(false);
    setLinkSearch("");
    await loadContact();
  }

  async function unlinkContact(linkId: string) {
    const supabase = createClient();
    await supabase.from("contact_links").delete().eq("id", linkId);
    await loadContact();
  }

  const callAgainCount = callLogs.filter(l => l.outcome === "call_again").length;
  const isInterested = callLogs.some(l => l.outcome === "interested");
  const totalShootRevenue = shoots.filter(s => s.price).reduce((sum, s) => sum + (s.price || 0), 0);

  const filteredLinkSearch = allContacts.filter(c =>
    linkSearch &&
    (c.name.toLowerCase().includes(linkSearch.toLowerCase()) ||
     (c.brokerage || "").toLowerCase().includes(linkSearch.toLowerCase())) &&
    !linkedContacts.find(lc => lc.id === c.id)
  );

  if (loading) {
    return <div className="min-h-screen bg-[#0c0c0c] text-[#555] flex items-center justify-center text-xs tracking-[3px] uppercase">Loading...</div>;
  }
  if (!contact) return null;

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">

      {/* Header */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-[#555] text-sm hover:text-white transition-colors">← Back</button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-bold text-lg">{contact.name}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase ${STAGE_COLORS[contact.stage] || "bg-zinc-700 text-zinc-300"}`}>
              {contact.stage}
            </span>
            {(() => { const ps = portalStatus(); return (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase ${ps.color}`}>
                {ps.label}
              </span>
            ); })()}
            {shoots.length > 0 && ["lead", "interested", "follow-up"].includes(contact.stage) === false && (
              <span className="text-[10px] tracking-[2px] uppercase text-[#4ade80] border border-[#4ade80]/30 px-2 py-0.5">Lead Converted</span>
            )}
            {contact.is_hot && <span className="text-[10px] tracking-[2px] uppercase text-[#fbbf24] border border-[#fbbf24]/30 px-2 py-0.5">Hot Lead</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/admin/cold-calls?contact=${contact.id}`)}
            className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all"
          >
            Call
          </button>
          <button
            onClick={() => setEditing(true)}
            className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

        {/* ═══ LEFT column ═══ */}
        <div className="space-y-5">

          {/* Contact Info */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-4">
            <p className="text-xs tracking-[3px] uppercase text-[#555]">Contact Info</p>
            <div className="space-y-3">
              {contact.brokerage && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-0.5">Brokerage</p>
                  <p className="text-sm">{contact.brokerage}</p>
                </div>
              )}
              {contact.phone && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-0.5">Phone</p>
                  <a href={`tel:${contact.phone}`} className="text-sm text-[#4ade80] font-mono">{formatPhone(contact.phone)}</a>
                </div>
              )}
              {contact.email && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-0.5">Email</p>
                  <p className="text-sm break-all">{contact.email}</p>
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
              {totalShootRevenue > 0 && (
                <div>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-0.5">Total Revenue</p>
                  <p className="text-sm font-bold text-[#4ade80]">${totalShootRevenue.toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-0.5">Added</p>
                <p className="text-xs text-[#555]">{new Date(contact.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
              <div className="border-t border-white/5 pt-3">
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-2">Portal Access</p>
                {contact.user_id ? (
                  <div className="space-y-1">
                    <div className={`text-[10px] px-2 py-1 font-semibold tracking-wide uppercase inline-block rounded-full ${portalStatus().color}`}>
                      {portalStatus().label}
                    </div>
                    <p className="text-[10px] text-[#333]">Account linked to this contact</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-[#333]">No portal account yet</p>
                    {contact.email && (
                      <button
                        onClick={sendInvite}
                        disabled={inviting || inviteSent}
                        className="w-full py-2 text-[10px] tracking-[2px] uppercase border border-white/10 text-[#888] hover:text-white hover:border-white/30 transition-all disabled:opacity-40"
                      >
                        {inviting ? "Sending..." : inviteSent ? "Invite Sent ✓" : "Send Invite Link"}
                      </button>
                    )}
                    {!contact.email && <p className="text-[10px] text-[#333] italic">Add an email to send invite</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Related To */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs tracking-[3px] uppercase text-[#555]">Related To</p>
              <button
                onClick={() => setShowLinkSearch(!showLinkSearch)}
                className="text-[10px] tracking-[1px] uppercase text-[#555] hover:text-white transition-colors"
              >
                + Link
              </button>
            </div>

            {linkedContacts.length === 0 && !showLinkSearch && (
              <p className="text-xs text-[#333] italic">No linked contacts</p>
            )}

            {linkedContacts.map(lc => (
              <div key={lc.id} className="bg-[#181818] border border-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      onClick={() => router.push(`/admin/contacts/${lc.id}`)}
                      className="text-sm font-medium hover:underline text-left truncate block"
                    >
                      {lc.name}
                    </button>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#fbbf24] mt-0.5">{lc.relationship}</p>
                    {lc.brokerage && <p className="text-xs text-[#444] mt-0.5">{lc.brokerage}</p>}
                    {lc.phone && <a href={`tel:${lc.phone}`} className="text-xs text-[#4ade80] font-mono mt-0.5 block">{formatPhone(lc.phone)}</a>}
                  </div>
                  <button
                    onClick={() => unlinkContact(lc.link_id)}
                    className="text-[#333] hover:text-red-400 text-xs shrink-0 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-[10px] text-[#333]">Shared portal — same shoots, invoices & media</p>
                </div>
              </div>
            ))}

            {showLinkSearch && (
              <div className="space-y-2">
                <select
                  value={linkRelationship}
                  onChange={e => setLinkRelationship(e.target.value)}
                  className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2 outline-none"
                >
                  {RELATIONSHIP_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input
                  autoFocus
                  value={linkSearch}
                  onChange={e => setLinkSearch(e.target.value)}
                  placeholder="Search contacts to link..."
                  className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
                />
                {linkSearch && (
                  <div className="bg-[#181818] border border-white/10 max-h-44 overflow-y-auto divide-y divide-white/5">
                    {filteredLinkSearch.length === 0 && <p className="px-3 py-2.5 text-xs text-[#444]">No results</p>}
                    {filteredLinkSearch.slice(0, 6).map(c => (
                      <button
                        key={c.id}
                        onClick={() => linkContact(c)}
                        disabled={linking}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.brokerage && <span className="text-[#555] ml-2">{c.brokerage}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => { setShowLinkSearch(false); setLinkSearch(""); }}
                  className="text-xs text-[#444] hover:text-white transition-colors">Cancel</button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-3">
            <p className="text-xs tracking-[3px] uppercase text-[#555]">Stats</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0e0e0e] border border-white/5 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{callLogs.length}</p>
                <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Calls</p>
              </div>
              <div className="bg-[#0e0e0e] border border-white/5 p-3 text-center">
                <p className={`text-2xl font-bold tabular-nums ${isInterested ? "text-[#4ade80]" : ""}`}>
                  {isInterested ? "+" : callAgainCount > 0 ? callAgainCount : "—"}
                </p>
                <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">
                  {isInterested ? "Interested" : callAgainCount > 0 ? "Retries" : "No Activity"}
                </p>
              </div>
              <div className="bg-[#0e0e0e] border border-white/5 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{emailLogs.length}</p>
                <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Emails</p>
              </div>
              <div className="bg-[#0e0e0e] border border-white/5 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-[#4ade80]">{shoots.length}</p>
                <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-0.5">Shoots</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-3">
            <p className="text-xs tracking-[3px] uppercase text-[#555]">Notes</p>
            <textarea
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              rows={4}
              placeholder="Notes about this contact..."
              className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 resize-none placeholder:text-[#333]"
            />
            <button
              onClick={saveNote}
              disabled={savingNote || noteInput === (contact.notes || "")}
              className="w-full py-2 text-xs tracking-[1px] uppercase border border-white/10 text-[#888] hover:text-white hover:border-white/30 transition-all disabled:opacity-30"
            >
              {savingNote ? "Saving..." : "Save Notes"}
            </button>
          </div>
        </div>

        {/* ═══ RIGHT: History tabs ═══ */}
        <div className="md:col-span-2 space-y-4">

          {/* Tab bar */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setHistoryTab("leads")}
              className={`px-6 py-3 text-xs tracking-[2px] uppercase font-semibold border-b-2 transition-colors ${historyTab === "leads" ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"}`}
            >
              Lead History
              {callLogs.length > 0 && <span className="ml-2 text-[#444]">({callLogs.length + emailLogs.length})</span>}
            </button>
            <button
              onClick={() => setHistoryTab("shoots")}
              className={`px-6 py-3 text-xs tracking-[2px] uppercase font-semibold border-b-2 transition-colors ${historyTab === "shoots" ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"}`}
            >
              Invoice History
              {shoots.length > 0 && <span className="ml-2 text-[#444]">({shoots.length})</span>}
            </button>
          </div>

          {/* ── Lead History ── */}
          {historyTab === "leads" && (
            <div className="space-y-3">
              {callLogs.length === 0 && emailLogs.length === 0 ? (
                <div className="bg-[#111] border border-white/10 p-10 text-center">
                  <p className="text-[#333] text-sm mb-4">No lead activity yet.</p>
                  <button
                    onClick={() => router.push(`/admin/cold-calls?contact=${contact.id}`)}
                    className="text-xs tracking-[1px] uppercase border border-white/10 px-6 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all"
                  >
                    Log First Call →
                  </button>
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
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase border ${CALL_COLORS[call.outcome] || "text-[#555] bg-white/5 border-white/5"}`}>
                                {CALL_LABELS[call.outcome] || call.outcome}
                              </span>
                              <span className="text-xs text-[#555]">Cold Call</span>
                            </div>
                            <span className="text-[10px] text-[#333]">
                              {new Date(call.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          {call.listing_address && <p className="text-xs text-[#555]">📍 {call.listing_address}</p>}
                          {call.notes && <p className="text-xs text-[#666] italic mt-1">"{call.notes}"</p>}
                          <p className="text-[10px] text-[#333] mt-1.5">by {call.called_by}</p>
                        </>
                      );
                    })()}
                    {event.kind === "email" && (() => {
                      const email = event.data as EmailLog;
                      return (
                        <>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase text-[#818cf8] bg-[#818cf8]/10 border border-[#818cf8]/20">
                              Email Sent
                            </span>
                            <span className="text-[10px] text-[#333]">
                              {new Date(email.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{email.subject}</p>
                          {email.body && <p className="text-xs text-[#555] mt-1 line-clamp-2">{email.body}</p>}
                          <p className="text-[10px] text-[#333] mt-1.5">by {email.sent_by}</p>
                        </>
                      );
                    })()}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Invoice History ── */}
          {historyTab === "shoots" && (
            <div className="space-y-3">
              {linkedContacts.length > 0 && (
                <div className="bg-[#fbbf24]/5 border border-[#fbbf24]/20 px-4 py-2.5 flex items-center gap-2">
                  <span className="text-[10px] tracking-[2px] uppercase text-[#fbbf24]">Shared portal</span>
                  <span className="text-xs text-[#888]">—</span>
                  <span className="text-xs text-[#666]">
                    {linkedContacts.map(lc => lc.name).join(", ")} see these same shoots
                  </span>
                </div>
              )}

              {shoots.length === 0 ? (
                <div className="bg-[#111] border border-white/10 p-10 text-center">
                  <p className="text-[#333] text-sm">No shoots yet.</p>
                </div>
              ) : (
                shoots.map(shoot => (
                  <div key={shoot.id} className="bg-[#111] border border-white/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-medium text-sm truncate">{shoot.address}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase shrink-0 ${STATUS_COLORS[shoot.status] || "text-[#555] bg-white/5"}`}>
                            {shoot.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {shoot.scheduled_at && (
                            <span className="text-xs text-[#555]">
                              {new Date(shoot.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                          {shoot.package_name && <span className="text-xs text-[#444]">{shoot.package_name}</span>}
                          {!shoot.package_name && shoot.services?.length > 0 && (
                            <span className="text-xs text-[#444]">{shoot.services.join(", ")}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {shoot.price != null
                          ? <p className="font-bold text-[#4ade80]">${shoot.price.toLocaleString()}</p>
                          : <p className="text-[#333] text-xs">No price</p>
                        }
                      </div>
                    </div>
                  </div>
                ))
              )}

              {shoots.length > 0 && totalShootRevenue > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border border-white/5 bg-[#0e0e0e]">
                  <span className="text-xs tracking-[2px] uppercase text-[#555]">Total Revenue</span>
                  <span className="font-bold text-[#4ade80]">${totalShootRevenue.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => setEditing(false)}>
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
    </div>
  );
}
