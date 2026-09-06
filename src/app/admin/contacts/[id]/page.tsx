"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatPhone, normalizePhone } from "@/lib/format";
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
  referred_by_contact_id: string | null;
  sourced_by: string | null;
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

const LEAD_STAGES = ["new", "contacted", "interested", "follow-up", "invited", "dead"];
const STAGE_COLORS: Record<string, string> = {
  new: "bg-zinc-800 text-zinc-400",
  contacted: "bg-zinc-800 text-zinc-300",
  interested: "bg-blue-950 text-blue-400",
  "follow-up": "bg-yellow-950 text-yellow-400",
  invited: "bg-purple-950 text-purple-400",
  dead: "bg-red-950/50 text-red-600",
};

const TYPE_COLORS: Record<string, { color: string; badge: string; label: string }> = {
  lead:     { color: "#fbbf24", badge: "text-[#fbbf24] bg-[#fbbf24]/10",  label: "Lead" },
  realtor:  { color: "#4ade80", badge: "text-[#4ade80] bg-[#4ade80]/10",  label: "Realtor" },
  employee: { color: "#60a5fa", badge: "text-[#60a5fa] bg-[#60a5fa]/10",  label: "Employee" },
  admin:    { color: "#a78bfa", badge: "text-[#a78bfa] bg-[#a78bfa]/10",  label: "Admin" },
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
  const [quotes, setQuotes] = useState<{ id: string; primary_service: string; primary_price: number; addons: { name: string; price: number }[]; total: number; sqft: string | null; created_at: string }[]>([]);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);

  const [team, setTeam] = useState<{ id: string; name: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [historyTab, setHistoryTab] = useState<"activity" | "actions" | "leads" | "shoots" | "quotes">("activity");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "", lead_source: "", sourced_by: "" });
  const [referralCount, setReferralCount] = useState(0);

  // Invite
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [avatarTs, setAvatarTs] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !contact) return;
    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("contactId", contact.id);
    await fetch("/api/admin/upload-avatar", { method: "POST", body: fd });
    setAvatarTs(Date.now());
    setUploadingAvatar(false);
    if (avatarFileRef.current) avatarFileRef.current.value = "";
  }

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
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", brokerage: c.brokerage || "", stage: c.stage, notes: c.notes || "", lead_source: c.lead_source || "", sourced_by: c.sourced_by || "" });

    // Count contacts who were referred by this person
    const { count } = await supabase.from("contacts").select("id", { count: "exact", head: true }).eq("referred_by_contact_id", id);
    setReferralCount(count || 0);

    setCallLogs(calls || []);
    setEmailLogs(emails || []);
    setShoots(sh || []);

    const quotesRes = await fetch(`/api/admin/quotes?contact_id=${id}`);
    if (quotesRes.ok) setQuotes(await quotesRes.json());
    setAllContacts((allC || []).filter((ct: { id: string }) => ct.id !== id) as Contact[]);

    // Team membership
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id, teams(id, name)")
      .eq("contact_id", id)
      .single();
    if (membership?.teams) {
      const t = membership.teams as unknown as { id: string; name: string };
      setTeam(t);
    } else {
      setTeam(null);
    }

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
    const { data } = await supabase.from("contacts").update({ ...form, phone: normalizePhone(form.phone), lead_source: form.lead_source || null, sourced_by: form.sourced_by || null, updated_at: new Date().toISOString() }).eq("id", contact.id).select().single();
    if (data) setContact(data);
    setSaving(false);
    setEditing(false);
  }


  async function deleteContact() {
    if (!contact) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("contacts").update({ stage: "deleted" }).eq("id", contact.id);
    router.replace("/admin/contacts");
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
    if (contact.email && ADMIN_EMAILS.includes(contact.email)) return { label: "Admin", color: "text-[#a78bfa] bg-[#a78bfa]/10" };
    if (!contact.user_id) return { label: "No Account", color: "text-[#444] bg-white/5" };
    const hasShoot = shoots.some(s => ["completed", "scheduled", "booked"].includes(s.status));
    if (hasShoot) return { label: "Client", color: "text-[#4ade80] bg-[#4ade80]/10" };
    return { label: "Registered", color: "text-[#60a5fa] bg-[#60a5fa]/10" };
  }

  async function updateStage(stage: string) {
    if (!contact) return;
    const supabase = createClient();
    const newStage = stage === "dead" ? "deleted" : stage;
    await supabase.from("contacts").update({ stage: newStage }).eq("id", contact.id);
    setContact(c => c ? { ...c, stage: newStage } : c);
    if (newStage === "deleted") router.push("/admin/contacts");
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
  const pricedShoots = shoots.filter(s => s.price && s.price > 0);
  const totalShootRevenue = pricedShoots.reduce((sum, s) => sum + (s.price || 0), 0);
  const completedShoots = shoots.filter(s => s.status === "completed");
  const avgPerShoot = pricedShoots.length > 0 ? Math.round(totalShootRevenue / pricedShoots.length) : 0;
  const lastShoot = shoots.find(s => s.scheduled_at);

  // Service breakdown — count each service type across all shoots
  const SERVICE_LABELS: Record<string, string> = {
    "Listing Photos": "Listing Photos",
    "Aerial Photos": "Aerial Photos",
    "Aerial Video": "Aerial Video",
    "Floor Plan": "Floor Plans",
    "Matterport": "Matterport",
    "Virtual Staging": "Virtual Staging",
    "Video — Bronze": "Video",
    "Video — Silver (w/ Aerial)": "Video + Aerial",
    "Headshots": "Headshots",
    "Twilight": "Twilight",
  };
  const serviceCount: Record<string, number> = {};
  for (const shoot of shoots) {
    for (const svc of (shoot.services || [])) {
      const label = Object.entries(SERVICE_LABELS).find(([k]) => svc.toLowerCase().includes(k.toLowerCase()))?.[1] || svc;
      serviceCount[label] = (serviceCount[label] || 0) + 1;
    }
  }
  const serviceBreakdown = Object.entries(serviceCount).sort((a, b) => b[1] - a[1]);

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

      {/* Nav bar */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between gap-4">
        <button onClick={() => router.back()} className="text-[#555] text-sm hover:text-white transition-colors">← Back</button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/admin/cold-calls?contact=${contact.id}`)}
            className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all"
          >
            Log Call
          </button>
          <button
            onClick={() => setEditing(true)}
            className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Name hero */}
      <div className="text-center pt-10 pb-6 px-4">
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => avatarFileRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative w-16 h-16 rounded-full overflow-hidden bg-white/10 shrink-0 group cursor-pointer"
            title="Change photo"
          >
            {!avatarError && (
              <img
                src={`${avatarUrl(contact.id)}${avatarTs ? `?t=${avatarTs}` : ""}`}
                alt={contact.name}
                className="w-full h-full object-cover"
                onError={() => setAvatarError(true)}
              />
            )}
            {avatarError && (
              <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white/40 pointer-events-none">
                {contact.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar
                ? <span className="text-[9px] text-white tracking-wide">...</span>
                : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              }
            </div>
          </button>
          <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          <h1 className="text-3xl font-bold tracking-tight text-left">{contact.name}</h1>
        </div>
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
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
              {contact.is_hot && <span className="text-[10px] tracking-[2px] uppercase text-[#fbbf24] border border-[#fbbf24]/30 px-2 py-0.5">Hot Lead</span>}
            </>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 md:px-6 pb-16 space-y-6">

        {/* ═══ MAIN INFO CARD ═══ */}
        <div className="bg-[#111] border border-white/10 divide-y divide-white/5">

          {/* Contact details */}
          <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-5">
            {contact.brokerage && (
              <div className="col-span-2">
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Brokerage</p>
                <p className="text-sm font-medium">{contact.brokerage}</p>
              </div>
            )}
            {contact.phone && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Phone</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <a href={`tel:${contact.phone}`} className="text-sm text-[#4ade80] font-mono">{formatPhone(contact.phone)}</a>
                  <a href={`/dashboard/phone?tab=calls&contact=${contact.id}`} className="text-[10px] tracking-[1px] uppercase border border-white/15 px-2.5 py-1 text-[#888] hover:text-white hover:border-white/30 transition-all">
                    📞 Call
                  </a>
                  <a href={`/dashboard/phone?tab=messages&contact=${contact.id}`} className="text-[10px] tracking-[1px] uppercase border border-white/15 px-2.5 py-1 text-[#888] hover:text-white hover:border-white/30 transition-all">
                    💬 Text
                  </a>
                </div>
              </div>
            )}
            {contact.email && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Email</p>
                <p className="text-sm break-all">{contact.email}</p>
              </div>
            )}
            {contact.type === "lead" && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Lead Stage</p>
                <select
                  value={contact.stage}
                  onChange={e => updateStage(e.target.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border-0 cursor-pointer focus:outline-none ${STAGE_COLORS[contact.stage] || "bg-zinc-800 text-zinc-400"}`}
                >
                  {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Added</p>
              <p className="text-sm text-[#666]">{new Date(contact.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
            {contact.lead_source && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Source</p>
                <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase bg-white/5 border border-white/10 text-[#888]">
                  {CHANNEL_LABELS[contact.lead_source] || contact.lead_source}
                </span>
              </div>
            )}
            {contact.sourced_by && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Sourced By</p>
                <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20">
                  {contact.sourced_by}
                </span>
              </div>
            )}
            {team && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Team</p>
                <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase text-[#a78bfa] bg-[#a78bfa]/10 border border-[#a78bfa]/20">
                  {team.name}
                </span>
              </div>
            )}
            {referralCount > 0 && (
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-1">Referrals Given</p>
                <p className="text-sm font-bold text-[#4ade80]">{referralCount}</p>
              </div>
            )}
          </div>

          {/* Relationship metrics */}
          <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
            <div className="p-4 text-center">
              <p className="text-xl font-bold tabular-nums text-[#4ade80]">
                {totalShootRevenue > 0 ? `$${totalShootRevenue.toLocaleString()}` : "—"}
              </p>
              <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-1">Lifetime Revenue</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xl font-bold tabular-nums">{shoots.length}</p>
              <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-1">Total Shoots</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xl font-bold tabular-nums text-[#4ade80]">
                {avgPerShoot > 0 ? `$${avgPerShoot.toLocaleString()}` : "—"}
              </p>
              <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-1">Avg per Shoot</p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/5">
            <div className="p-4 text-center">
              <p className="text-sm font-semibold tabular-nums">
                {new Date(contact.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
              <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-1">Client Since</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-sm font-semibold tabular-nums">
                {lastShoot?.scheduled_at
                  ? new Date(lastShoot.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—"}
              </p>
              <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-1">Last Booking</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xl font-bold tabular-nums">{completedShoots.length}</p>
              <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-1">Completed</p>
            </div>
          </div>

          {/* Related contacts */}
          {(linkedContacts.length > 0 || showLinkSearch) && (
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] tracking-[2px] uppercase text-[#444]">Related To</p>
                <button onClick={() => setShowLinkSearch(!showLinkSearch)} className="text-[10px] tracking-[1px] uppercase text-[#555] hover:text-white transition-colors">+ Link</button>
              </div>
              {linkedContacts.map(lc => (
                <div key={lc.id} className="flex items-center justify-between gap-3 bg-[#181818] border border-white/5 px-4 py-3">
                  <div className="min-w-0">
                    <button onClick={() => router.push(`/admin/contacts/${lc.id}`)} className="text-sm font-medium hover:underline text-left">{lc.name}</button>
                    <p className="text-[10px] tracking-[1px] uppercase text-[#fbbf24] mt-0.5">{lc.relationship}{lc.brokerage ? ` · ${lc.brokerage}` : ""}</p>
                  </div>
                  <button onClick={() => unlinkContact(lc.link_id)} className="text-[#333] hover:text-red-400 text-xs shrink-0 transition-colors">✕</button>
                </div>
              ))}
              {showLinkSearch && (
                <div className="space-y-2">
                  <select value={linkRelationship} onChange={e => setLinkRelationship(e.target.value)} className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2 outline-none">
                    {RELATIONSHIP_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input autoFocus value={linkSearch} onChange={e => setLinkSearch(e.target.value)} placeholder="Search contacts to link..." className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                  {linkSearch && (
                    <div className="bg-[#181818] border border-white/10 max-h-44 overflow-y-auto divide-y divide-white/5">
                      {filteredLinkSearch.length === 0 && <p className="px-3 py-2.5 text-xs text-[#444]">No results</p>}
                      {filteredLinkSearch.slice(0, 6).map(c => (
                        <button key={c.id} onClick={() => linkContact(c)} disabled={linking} className="w-full text-left px-3 py-2.5 text-xs hover:bg-white/5 transition-colors disabled:opacity-50">
                          <span className="font-medium">{c.name}</span>
                          {c.brokerage && <span className="text-[#555] ml-2">{c.brokerage}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setShowLinkSearch(false); setLinkSearch(""); }} className="text-xs text-[#444] hover:text-white transition-colors">Cancel</button>
                </div>
              )}
            </div>
          )}

          {/* Link button when no linked contacts yet */}
          {linkedContacts.length === 0 && !showLinkSearch && (
            <div className="px-6 py-3">
              <button onClick={() => setShowLinkSearch(true)} className="text-[10px] tracking-[1px] uppercase text-[#444] hover:text-white transition-colors">+ Link Related Contact</button>
            </div>
          )}

          {/* Notes (read-only — edit via Edit button) */}
          {contact.notes && (
            <div className="px-6 py-5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#444] mb-2">Notes</p>
              <p className="text-sm text-[#888] leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          {/* Portal invite */}
          {!contact.user_id && contact.email && (
            <div className="px-6 py-4">
              <button onClick={sendInvite} disabled={inviting || inviteSent} className="w-full py-2.5 text-xs tracking-[1px] uppercase border border-white/10 text-[#666] hover:text-white hover:border-white/30 transition-all disabled:opacity-40">
                {inviting ? "Sending..." : inviteSent ? "Invite Sent ✓" : "Send Portal Invite"}
              </button>
            </div>
          )}
        </div>

        {/* ═══ SERVICE BREAKDOWN ═══ */}
        {serviceBreakdown.length > 0 && (
          <div className="bg-[#111] border border-white/10">
            <div className="px-5 py-3 border-b border-white/5">
              <p className="text-[10px] tracking-[2px] uppercase text-[#444]">Service Breakdown</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/5">
              {serviceBreakdown.map(([name, count]) => (
                <div key={name} className="bg-[#111] px-4 py-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-[#888] truncate">{name}</span>
                  <span className="text-sm font-bold text-white tabular-nums shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ CLIENT HEALTH ═══ */}
        {(() => {
          const now = Date.now();
          const daysSince = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 86400000);
          const lastShootDays = lastShoot?.scheduled_at ? daysSince(lastShoot.scheduled_at) : null;

          // Score signals (max 100)
          const recencyPts = lastShootDays === null ? 0 : lastShootDays < 30 ? 30 : lastShootDays < 60 ? 20 : lastShootDays < 90 ? 10 : 0;
          const freqPts    = shoots.length >= 5 ? 25 : shoots.length >= 3 ? 18 : shoots.length === 2 ? 12 : shoots.length === 1 ? 6 : 0;
          const refPts     = referralCount >= 2 ? 20 : referralCount === 1 ? 12 : 0;
          const portalPts  = contact.user_id ? 15 : 0;
          const sourcePts  = contact.lead_source ? 10 : 0;
          const score      = recencyPts + freqPts + refPts + portalPts + sourcePts;

          const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
          const gradeColor = grade === "A" ? "text-[#4ade80]" : grade === "B" ? "text-[#60a5fa]" : grade === "C" ? "text-[#fbbf24]" : "text-red-400";
          const barColor   = grade === "A" ? "bg-[#4ade80]" : grade === "B" ? "bg-[#60a5fa]" : grade === "C" ? "bg-[#fbbf24]" : "bg-red-500";

          const signals: { label: string; value: string; pts: number; max: number }[] = [
            { label: "Recency",        value: lastShootDays === null ? "No shoots yet" : lastShootDays < 30 ? `Last shoot ${lastShootDays}d ago` : lastShootDays < 60 ? `Last shoot ${lastShootDays}d ago` : `Last shoot ${lastShootDays}d ago`,  pts: recencyPts, max: 30 },
            { label: "Frequency",      value: `${shoots.length} shoot${shoots.length !== 1 ? "s" : ""} total`,  pts: freqPts,    max: 25 },
            { label: "Referrals",      value: referralCount > 0 ? `${referralCount} referral${referralCount !== 1 ? "s" : ""} sent` : "No referrals yet",   pts: refPts,     max: 20 },
            { label: "Portal Account", value: contact.user_id ? "Active account" : "Not registered",           pts: portalPts,  max: 15 },
            { label: "Source Tracked", value: contact.lead_source ? CHANNEL_LABELS[contact.lead_source] || contact.lead_source : "Unknown source",          pts: sourcePts,  max: 10 },
          ];

          return (
            <div className="bg-[#111] border border-white/10">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <p className="text-[10px] tracking-[2px] uppercase text-[#444]">Client Health</p>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
                  </div>
                  <span className={`text-xl font-black tabular-nums ${gradeColor}`}>{grade}</span>
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {signals.map(sig => (
                  <div key={sig.label} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] tracking-[1.5px] uppercase text-[#444] mb-0.5">{sig.label}</p>
                      <p className="text-xs text-[#777]">{sig.value}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${sig.pts > 0 ? barColor : "bg-transparent"}`} style={{ width: `${(sig.pts / sig.max) * 100}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-[#444] w-8 text-right">{sig.pts}/{sig.max}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ═══ HISTORY TABS ═══ */}
        <div className="space-y-4">

          {/* Tab bar */}
          <div className="flex border-b border-white/10 overflow-x-auto">
            <button onClick={() => setHistoryTab("activity")} className={`px-6 py-3 text-xs tracking-[2px] uppercase font-semibold border-b-2 transition-colors whitespace-nowrap ${historyTab === "activity" ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"}`}>
              Activity
              <span className="ml-2 text-[#444]">({callLogs.length + emailLogs.length + shoots.length + quotes.length})</span>
            </button>
            <button onClick={() => setHistoryTab("actions")} className={`px-6 py-3 text-xs tracking-[2px] uppercase font-semibold border-b-2 transition-colors whitespace-nowrap ${historyTab === "actions" ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"}`}>
              Suggested Actions
            </button>
            <button onClick={() => setHistoryTab("leads")} className={`px-6 py-3 text-xs tracking-[2px] uppercase font-semibold border-b-2 transition-colors whitespace-nowrap ${historyTab === "leads" ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"}`}>
              Calls & Emails
              {(callLogs.length + emailLogs.length) > 0 && <span className="ml-2 text-[#444]">({callLogs.length + emailLogs.length})</span>}
            </button>
            <button onClick={() => setHistoryTab("shoots")} className={`px-6 py-3 text-xs tracking-[2px] uppercase font-semibold border-b-2 transition-colors whitespace-nowrap ${historyTab === "shoots" ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"}`}>
              Shoots
              {shoots.length > 0 && <span className="ml-2 text-[#444]">({shoots.length})</span>}
            </button>
            <button onClick={() => setHistoryTab("quotes")} className={`px-6 py-3 text-xs tracking-[2px] uppercase font-semibold border-b-2 transition-colors whitespace-nowrap ${historyTab === "quotes" ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"}`}>
              Quotes
              {quotes.length > 0 && <span className="ml-2 text-[#444]">({quotes.length})</span>}
            </button>
          </div>

          {/* ── Unified Activity Timeline ── */}
          {historyTab === "activity" && (() => {
            type AnyEvent =
              | { kind: "call";  ts: string; data: CallLog }
              | { kind: "email"; ts: string; data: EmailLog }
              | { kind: "shoot"; ts: string; data: typeof shoots[0] }
              | { kind: "quote"; ts: string; data: typeof quotes[0] };

            const events: AnyEvent[] = [
              ...callLogs.map(l  => ({ kind: "call"  as const, ts: l.called_at,   data: l })),
              ...emailLogs.map(l => ({ kind: "email" as const, ts: l.sent_at,      data: l })),
              ...shoots.map(s    => ({ kind: "shoot" as const, ts: s.scheduled_at || "", data: s })),
              ...quotes.map(q    => ({ kind: "quote" as const, ts: q.created_at,   data: q })),
            ].filter(e => e.ts).sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

            if (events.length === 0) return (
              <div className="bg-[#111] border border-white/10 p-10 text-center">
                <p className="text-[#333] text-sm">No activity yet.</p>
              </div>
            );

            return (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/5" />

                <div className="space-y-0">
                  {events.map((event, i) => {
                    const fmtDate = (ts: string) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

                    // Date divider
                    const thisDay = event.ts.slice(0, 10);
                    const prevDay = i > 0 ? events[i - 1].ts.slice(0, 10) : null;
                    const showDivider = thisDay !== prevDay;

                    return (
                      <div key={i}>
                        {showDivider && (
                          <div className="flex items-center gap-3 py-3 pl-10">
                            <span className="text-[10px] tracking-[2px] uppercase text-[#333]">{fmtDate(event.ts)}</span>
                            <div className="flex-1 h-px bg-white/5" />
                          </div>
                        )}

                        <div className="flex gap-4 pb-4 pl-2">
                          {/* Icon dot */}
                          <div className="shrink-0 w-9 flex flex-col items-center pt-1">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] z-10 relative ${
                              event.kind === "shoot" ? "bg-[#60a5fa]/20 border border-[#60a5fa]/40 text-[#60a5fa]" :
                              event.kind === "call"  ? "bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24]" :
                              event.kind === "email" ? "bg-[#a78bfa]/20 border border-[#a78bfa]/40 text-[#a78bfa]" :
                                                       "bg-[#34d399]/20 border border-[#34d399]/40 text-[#34d399]"
                            }`}>
                              {event.kind === "shoot" ? "📷" : event.kind === "call" ? "📞" : event.kind === "email" ? "✉" : "💬"}
                            </div>
                          </div>

                          {/* Card */}
                          <div className="flex-1 bg-[#111] border border-white/8 rounded-sm p-3 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                {event.kind === "shoot" && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase ${STATUS_COLORS[(event.data as typeof shoots[0]).status] || "text-[#555] bg-white/5"}`}>
                                    Shoot · {(event.data as typeof shoots[0]).status}
                                  </span>
                                )}
                                {event.kind === "call" && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase border ${CALL_COLORS[(event.data as CallLog).outcome] || "text-[#555] bg-white/5 border-white/5"}`}>
                                    {CALL_LABELS[(event.data as CallLog).outcome] || (event.data as CallLog).outcome}
                                  </span>
                                )}
                                {event.kind === "email" && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase text-[#818cf8] bg-[#818cf8]/10 border border-[#818cf8]/20">
                                    Email Sent
                                  </span>
                                )}
                                {event.kind === "quote" && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase text-[#34d399] bg-[#34d399]/10 border border-[#34d399]/20">
                                    Quote
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-[#333] shrink-0">{fmtTime(event.ts)}</span>
                            </div>

                            {/* Content */}
                            {event.kind === "shoot" && (() => {
                              const s = event.data as typeof shoots[0];
                              return (
                                <div>
                                  <p className="text-sm font-medium text-white truncate">{s.address}</p>
                                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                    {s.package_name && <span className="text-xs text-[#555]">{s.package_name}</span>}
                                    {!s.package_name && s.services?.length > 0 && <span className="text-xs text-[#555]">{s.services.join(", ")}</span>}
                                    {s.price != null && <span className="text-xs font-bold text-[#4ade80]">${s.price.toLocaleString()}</span>}
                                  </div>
                                </div>
                              );
                            })()}
                            {event.kind === "call" && (() => {
                              const c = event.data as CallLog;
                              return (
                                <div>
                                  {c.listing_address && <p className="text-xs text-[#555]">📍 {c.listing_address}</p>}
                                  {c.notes && <p className="text-xs text-[#666] italic mt-0.5">"{c.notes}"</p>}
                                  <p className="text-[10px] text-[#333] mt-1">by {c.called_by}</p>
                                </div>
                              );
                            })()}
                            {event.kind === "email" && (() => {
                              const e = event.data as EmailLog;
                              return (
                                <div>
                                  <p className="text-sm font-medium">{e.subject}</p>
                                  {e.body && <p className="text-xs text-[#555] mt-0.5 line-clamp-2">{e.body}</p>}
                                  <p className="text-[10px] text-[#333] mt-1">by {e.sent_by}</p>
                                </div>
                              );
                            })()}
                            {event.kind === "quote" && (() => {
                              const q = event.data as typeof quotes[0];
                              return (
                                <div>
                                  <p className="text-sm font-medium">{q.primary_service}</p>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    {q.sqft && <span className="text-xs text-[#555]">{q.sqft} sqft</span>}
                                    <span className="text-xs font-bold text-[#34d399]">${q.total.toLocaleString()}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Suggested Actions ── */}
          {historyTab === "actions" && (() => {
            const now = Date.now();
            const daysSince = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 86400000);
            const lastShootDays = lastShoot?.scheduled_at ? daysSince(lastShoot.scheduled_at) : null;
            const lastCallDays = callLogs[0]?.called_at ? daysSince(callLogs[0].called_at) : null;
            const lastEmailDays = emailLogs[0]?.sent_at ? daysSince(emailLogs[0].sent_at) : null;
            const hasPortalAccount = contact.stage === "client" || !!contact.user_id;
            const lastNoAnswer = callLogs[0]?.outcome === "no_answer";
            const lastOutcome = callLogs[0]?.outcome;

            type Action = { priority: "high" | "medium" | "low"; title: string; reason: string; cta: string; onClick?: () => void; href?: string };
            const actions: Action[] = [];

            // No contact yet
            if (callLogs.length === 0 && emailLogs.length === 0 && shoots.length === 0) {
              actions.push({ priority: "high", title: "Make first contact", reason: "This contact has never been called or emailed.", cta: "Log a Call", href: `/admin/cold-calls?contact=${contact.id}` });
            }

            // Has shoots but no portal invite
            if (shoots.length > 0 && !hasPortalAccount) {
              actions.push({ priority: "high", title: "Send portal invite", reason: "This client has completed shoots but hasn't been invited to the portal yet.", cta: "Send Invite", onClick: () => setHistoryTab("activity") });
            }

            // Never quoted
            if (quotes.length === 0 && shoots.length === 0) {
              actions.push({ priority: "high", title: "Send a quote", reason: "No quote has ever been sent to this contact.", cta: "Build Quote", href: `/dashboard/quotes?contact=${contact.id}` });
            }

            // Last call was no-answer
            if (lastNoAnswer) {
              actions.push({ priority: "high", title: "Follow up — no answer", reason: `Last call on ${new Date(callLogs[0].called_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} went unanswered.`, cta: "Log Call", href: `/admin/cold-calls?contact=${contact.id}` });
            }

            // Interested but no shoot booked
            if (isInterested && shoots.length === 0) {
              actions.push({ priority: "high", title: "Book a shoot", reason: "This contact expressed interest but has never had a shoot scheduled.", cta: "Book Shoot", href: `/dashboard` });
            }

            // Big spender, inactive 60+ days
            if (totalShootRevenue >= 500 && lastShootDays !== null && lastShootDays >= 60) {
              actions.push({ priority: "high", title: "Re-engage top client", reason: `${contact.name} has spent $${totalShootRevenue.toLocaleString()} but hasn't booked in ${lastShootDays} days.`, cta: "Send Email", href: `/dashboard/outreach?template=reengagement&contact=${contact.id}` });
            }

            // Inactive 90+ days
            if (lastShootDays !== null && lastShootDays >= 90) {
              actions.push({ priority: "medium", title: "Re-engagement outreach", reason: `No shoots in ${lastShootDays} days. A check-in could bring them back.`, cta: "Log Call", href: `/admin/cold-calls?contact=${contact.id}` });
            } else if (lastShootDays !== null && lastShootDays >= 45) {
              actions.push({ priority: "low", title: "Check in soon", reason: `Last shoot was ${lastShootDays} days ago — a good time to reconnect before they go quiet.`, cta: "Log Call", href: `/admin/cold-calls?contact=${contact.id}` });
            }

            // No activity in 30+ days (lead, never shot)
            if (shoots.length === 0 && lastCallDays !== null && lastCallDays >= 30) {
              actions.push({ priority: "medium", title: "Revive cold lead", reason: `Last contact was ${lastCallDays} days ago and no shoot has ever been booked.`, cta: "Log Call", href: `/admin/cold-calls?contact=${contact.id}` });
            }

            // Quoted but never booked
            if (quotes.length > 0 && shoots.length === 0) {
              const daysSinceQuote = daysSince(quotes[quotes.length - 1].created_at);
              if (daysSinceQuote >= 3) {
                actions.push({ priority: "medium", title: "Follow up on quote", reason: `A quote was sent ${daysSinceQuote} day${daysSinceQuote !== 1 ? "s" : ""} ago but no shoot was ever booked.`, cta: "Send Follow-up", href: `/dashboard/outreach?template=reengagement&contact=${contact.id}` });
              }
            }

            // Never emailed
            if (emailLogs.length === 0 && shoots.length > 0) {
              actions.push({ priority: "low", title: "Send an email", reason: "This client has had shoots but has never received an email from you.", cta: "Send Email", href: `/dashboard/outreach?template=thank_you&contact=${contact.id}` });
            }

            // Google review request — after a completed shoot
            if (shoots.some(s => ["delivered", "completed"].includes(s.status)) && contact.email) {
              const firstName = contact.name.split(" ")[0];
              const subject = encodeURIComponent("Would you mind leaving us a review?");
              const body = encodeURIComponent(`Hi ${firstName},\n\nThank you so much for working with Luck Images! If you had a great experience, we'd love it if you could take a moment to leave us a Google review — it helps other clients find us.\n\nhttps://search.google.com/local/writereview?placeid=ChIJHe2jnlT862ifXEoTm94j1A\n\nThank you!\nRyan`);
              actions.push({ priority: "low", title: "Request a Google review", reason: `${contact.name} has completed shoots — happy clients are your best source of Google reviews.`, cta: "Send Request", href: `/dashboard/outreach?template=google_review&contact=${contact.id}` });
            }

            // Last outcome was call_again
            if (lastOutcome === "call_again" && lastCallDays !== null && lastCallDays >= 2) {
              actions.push({ priority: "medium", title: "Call again — flagged", reason: `You marked this contact as 'call again' ${lastCallDays} day${lastCallDays !== 1 ? "s" : ""} ago.`, cta: "Log Call", href: `/admin/cold-calls?contact=${contact.id}` });
            }

            const PRIORITY_STYLES = {
              high:   { bar: "bg-red-500",    badge: "text-red-400 bg-red-500/10 border-red-500/20",   label: "High" },
              medium: { bar: "bg-[#fbbf24]",  badge: "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20", label: "Medium" },
              low:    { bar: "bg-[#60a5fa]",  badge: "text-[#60a5fa] bg-[#60a5fa]/10 border-[#60a5fa]/20", label: "Low" },
            };

            const sorted = [...actions].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));

            return (
              <div className="space-y-3">
                {sorted.length === 0 ? (
                  <div className="bg-[#111] border border-white/10 p-10 text-center">
                    <p className="text-[#4ade80] text-sm font-semibold mb-1">All clear</p>
                    <p className="text-[#333] text-xs">No suggested actions right now. This contact is in good shape.</p>
                  </div>
                ) : sorted.map((action, i) => {
                  const s = PRIORITY_STYLES[action.priority];
                  return (
                    <div key={i} className="bg-[#111] border border-white/10 flex overflow-hidden">
                      <div className={`w-1 shrink-0 ${s.bar}`} />
                      <div className="flex-1 p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase border ${s.badge}`}>{s.label}</span>
                            <p className="text-sm font-semibold text-white">{action.title}</p>
                          </div>
                          <p className="text-xs text-[#555]">{action.reason}</p>
                        </div>
                        {action.href ? (
                          <a href={action.href} className="shrink-0 text-xs tracking-[1px] uppercase font-semibold border border-white/20 px-4 py-2 text-white hover:bg-white hover:text-black transition-all whitespace-nowrap">
                            {action.cta} →
                          </a>
                        ) : (
                          <button onClick={action.onClick} className="shrink-0 text-xs tracking-[1px] uppercase font-semibold border border-white/20 px-4 py-2 text-white hover:bg-white hover:text-black transition-all whitespace-nowrap">
                            {action.cta} →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-[#333] text-right pt-1">Based on shoot history, call logs, and quotes</p>
              </div>
            );
          })()}

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

          {/* ── Quotes ── */}
          {historyTab === "quotes" && (
            <div className="space-y-3">
              {quotes.length === 0 ? (
                <div className="bg-[#111] border border-white/10 p-10 text-center">
                  <p className="text-[#333] text-sm">No quotes yet.</p>
                  <p className="text-[#333] text-xs mt-2">Build a quote from the KPI Dashboard and save it to this profile.</p>
                </div>
              ) : (
                quotes.map(q => (
                  <div key={q.id} className="bg-[#111] border border-white/10 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{q.primary_service}</p>
                        {q.sqft && <p className="text-xs text-[#555]">{q.sqft} sq ft</p>}
                        {q.addons?.length > 0 && (
                          <p className="text-xs text-[#555]">+ {q.addons.map((a: { name: string }) => a.name).join(", ")}</p>
                        )}
                        <p className="text-[10px] text-[#444]">{new Date(q.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                      </div>
                      <p className="text-lg font-bold text-[#4ade80] shrink-0">${q.total?.toLocaleString()}</p>
                    </div>
                  </div>
                ))
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
              {contact.type === "lead" && (
                <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                  className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30">
                  {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <select value={form.lead_source} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30">
                <option value="">Source — how did they find us?</option>
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={form.sourced_by} onChange={e => setForm(f => ({ ...f, sourced_by: e.target.value }))}
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30">
                <option value="">Sourced by — who brought this client?</option>
                <option value="Ryan">Ryan</option>
                <option value="Leif">Leif</option>
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
              <div className="pt-3 border-t border-white/5 mt-1">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setConfirmDelete(true); }}
                  className="w-full py-2.5 text-xs tracking-[1px] uppercase text-red-500/60 hover:text-red-400 hover:border-red-500/30 border border-transparent transition-all"
                >
                  Delete Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-[#111] border border-red-500/20 w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold tracking-[2px] uppercase mb-2">Delete Contact?</p>
            <p className="text-xs text-[#666] mb-6">
              This will permanently delete <span className="text-white font-medium">{contact.name}</span> and all their lead history. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 text-xs tracking-[1px] uppercase border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={deleteContact}
                disabled={deleting}
                className="flex-1 py-3 text-xs tracking-[1px] uppercase bg-red-600 text-white font-bold hover:bg-red-500 transition-colors disabled:opacity-40"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
