"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { normalizePhone } from "@/lib/format";
import { useContactModal } from "@/context/ContactModalContext";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  stage: string;
};

type CallLog = {
  id: string;
  contact_id: string;
  called_at: string;
  outcome: string;
  notes: string | null;
  listing_address: string | null;
  listing_url: string | null;
  called_by: string;
};

type LogTab = "all" | "interested" | "call_again" | "closed" | "dead";
type CallTag = "no_answer" | "left_voicemail" | "sent_text" | "send_info" | "interested" | "closed" | "dead" | "new_address";

const CALL_TAGS: { key: CallTag; label: string; emoji: string; color: string; sub: string }[] = [
  { key: "no_answer", label: "No Answer", emoji: "📵", color: "#a78bfa", sub: "didn't pick up" },
  { key: "left_voicemail", label: "Left Voicemail", emoji: "🎙️", color: "#fbbf24", sub: "call back tomorrow" },
  { key: "sent_text", label: "Sent Text", emoji: "💬", color: "#60a5fa", sub: "texted from your phone" },
  { key: "send_info", label: "Send Info", emoji: "📨", color: "#c084fc", sub: "wants pricing + portfolio" },
  { key: "interested", label: "Interested", emoji: "🔥", color: "#4ade80", sub: "marks as lead" },
  { key: "closed", label: "Closed", emoji: "✅", color: "#34d399", sub: "registered in portal" },
  { key: "dead", label: "Dead", emoji: "💀", color: "#f87171", sub: "not interested" },
  { key: "new_address", label: "New Address", emoji: "📍", color: "#94a3b8", sub: "save address, no contact made" },
];

function hasTag(outcome: string, tag: string): boolean {
  return outcome.split(",").includes(tag);
}

function stageFromOutcome(outcome: string): string {
  if (hasTag(outcome, "dead")) return "dead";
  if (hasTag(outcome, "closed")) return "client";
  if (hasTag(outcome, "interested")) return "lead";
  return "follow-up";
}

function TagBubbles({ selected, onToggle, disabled }: { selected: Set<CallTag>; onToggle: (t: CallTag) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CALL_TAGS.map(t => {
        const active = selected.has(t.key);
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onToggle(t.key)}
            disabled={disabled}
            style={active ? { borderColor: t.color, color: t.color, background: `${t.color}1a` } : undefined}
            className="px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-semibold tracking-wide text-[#888] hover:border-white/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function toggleTag(prev: Set<CallTag>, key: CallTag): Set<CallTag> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else {
    next.add(key);
    if (key === "interested") { next.delete("dead"); next.delete("closed"); }
    if (key === "closed") { next.delete("dead"); next.delete("interested"); }
    if (key === "dead") { next.delete("interested"); next.delete("closed"); }
  }
  return next;
}

function buildPitchHtml(firstName: string): string {
  const BASE = "https://luckimages.com";
  const HERO_IMG = "https://images.squarespace-cdn.com/content/v1/61213811ee51ff1fda7a3bc4/97b5ff64-2aa4-43d2-a8a1-18af3072bbee/banner-1.jpg";

  const serviceRow = (label: string, price: string, href: string) =>
    `<tr>
      <td style="padding:11px 0;font-size:13px;border-bottom:1px solid #1e1e1e;">
        <a href="${href}" style="color:#ccc;text-decoration:none;">${label} <span style="font-size:10px;color:#444;">↗</span></a>
      </td>
      <td style="padding:11px 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;border-bottom:1px solid #1e1e1e;">${price}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <tr><td style="padding:0;">
    <div style="background-image:url(${HERO_IMG});background-size:cover;background-position:center;padding:64px 32px 56px;text-align:center;position:relative;">
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);"></div>
      <div style="position:relative;z-index:1;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.5);">Real Estate Media · Austin, TX</p>
        <h1 style="margin:0 0 20px;font-size:44px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;color:#fff;line-height:1;">LUCK IMAGES</h1>
        <p style="margin:0 auto 32px;font-size:14px;line-height:1.8;color:rgba(255,255,255,0.75);max-width:400px;">Hey ${firstName}, thanks for taking the time to chat. Here's everything we offer — reach out whenever a listing comes up and we'll get you taken care of.</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="padding-right:10px;">
              <a href="${BASE}/pricing" style="display:inline-block;background:#fff;color:#000;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 24px;text-decoration:none;">View Pricing →</a>
            </td>
            <td>
              <a href="${BASE}" style="display:inline-block;border:1px solid rgba(255,255,255,0.4);color:#fff;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:13px 24px;text-decoration:none;">Our Work →</a>
            </td>
          </tr>
        </table>
      </div>
    </div>
  </td></tr>

  <tr><td style="padding:32px;">
    <div style="background:rgba(0,0,0,0.75);border:1px solid #222;padding:28px;">
      <p style="margin:0 0 20px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#555;">Services &amp; Starting Prices</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${serviceRow("Listing Photos", "from $150", `${BASE}/photo`)}
        ${serviceRow("Aerial Photography", "$100 add-on · $200 solo", `${BASE}/drone`)}
        ${serviceRow("Matterport 3D Tour", "$150", `${BASE}/360`)}
        ${serviceRow("Twilight Photography", "$100 add-on · $200 solo", `${BASE}/twilight`)}
        ${serviceRow("Virtual Staging", "$30 / image", `${BASE}/virtual-staging`)}
        ${serviceRow("Walk-Through Video", "contact for pricing", `${BASE}/reels`)}
        <tr>
          <td style="padding:11px 0 0;font-size:13px;color:#ccc;">Floor Plan</td>
          <td style="padding:11px 0 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;">$50</td>
        </tr>
      </table>
      <p style="margin:18px 0 0;font-size:11px;color:#444;">Photos scale with sq ft. Next-day delivery. Same-day rush available.</p>
    </div>
  </td></tr>

  <tr><td style="border-top:1px solid #1a1a1a;padding:24px 32px 40px;">
    <p style="margin:0;font-size:13px;color:#888;line-height:1.7;">Ready to book or have questions? Just reply — I can usually get out within 24–48 hours.</p>
    <p style="margin:16px 0 0;font-size:13px;color:#fff;font-weight:700;">Ryan Luck</p>
    <p style="margin:2px 0 0;font-size:11px;color:#444;">Luck Images · ryan@luckimages.com · luckimages.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export default function ColdCallsPageWrapper() {
  return <Suspense><ColdCallsPage /></Suspense>;
}

function ColdCallsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openContact } = useContactModal();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);

  const [weekCalls, setWeekCalls] = useState(0);
  const [weekLeads, setWeekLeads] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const DAILY_GOAL = 20;

  const [zillow, setZillow] = useState("");
  const [zillowLoading, setZillowLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [addressFromZillow, setAddressFromZillow] = useState(false);
  const [listingUrl, setListingUrl] = useState("");

  const [contact, setContact] = useState<Contact | null>(null);
  const [additionalContacts, setAdditionalContacts] = useState<Contact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactInput, setAddContactInput] = useState("");
  const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "", brokerage: "" });
  const [contactMode, setContactMode] = useState<"none" | "new" | "search">("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [contactInput, setContactInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);

  const [primaryService, setPrimaryService] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());

  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const [showPitch, setShowPitch] = useState(false);
  const [pitchSubject, setPitchSubject] = useState("Real Estate Photography — Luck Images");
  const [sendingPitch, setSendingPitch] = useState(false);
  const [pitchSent, setPitchSent] = useState(false);
  const [pitchContact, setPitchContact] = useState<Contact | null>(null);

  const [logTab, setLogTab] = useState<LogTab>("all");
  const [callerName, setCallerName] = useState("ryan");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<CallTag>>(new Set());
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<Set<CallTag>>(new Set());
  const [editNotes, setEditNotes] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: cs }, { data: logs }] = await Promise.all([
      supabase.from("contacts").select("id,name,email,phone,brokerage,stage").order("name"),
      supabase.from("cold_calls").select("*").order("called_at", { ascending: false }),
    ]);
    setContacts(cs || []);
    setCallLogs(logs || []);

    const today = new Date().toISOString().split("T")[0];
    setTodayCount((logs || []).filter((l: CallLog) => l.called_at.startsWith(today)).length);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const wl = (logs || []).filter((l: CallLog) => new Date(l.called_at) >= weekStart);
    setWeekCalls(wl.length);
    setWeekLeads(wl.filter((l: CallLog) => l.outcome === "interested").length);

    const pid = searchParams.get("contact");
    if (pid && cs) {
      const found = (cs as Contact[]).find(c => c.id === pid);
      if (found) setContact(found);
    }
  }, [searchParams]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
      else setCallerName(data.user.email?.split("@")[0] || "ryan");
    });
    loadData();
  }, [router, loadData]);

  async function selectContact(c: Contact) {
    setContact(c);
    setAdditionalContacts([]);
    setShowAddContact(false);
    setAddContactInput("");
    // Auto-load linked contacts (team members)
    const supabase = createClient();
    const { data: links } = await supabase
      .from("contact_links")
      .select("contact_id_a, contact_id_b")
      .or(`contact_id_a.eq.${c.id},contact_id_b.eq.${c.id}`);
    if (links && links.length > 0) {
      const otherIds = links.map((l: { contact_id_a: string; contact_id_b: string }) =>
        l.contact_id_a === c.id ? l.contact_id_b : l.contact_id_a
      );
      const { data: linked } = await supabase.from("contacts").select("id, name, email, phone, brokerage, stage").in("id", otherIds);
      setAdditionalContacts((linked || []) as Contact[]);
    }
  }

  async function importZillow() {
    if (!zillow.trim()) return;
    setZillowLoading(true);
    try {
      const res = await fetch("/api/admin/zillow-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: zillow }),
      });
      const data = await res.json();
      if (data.address) { setAddress(data.address); setAddressFromZillow(true); setListingUrl(zillow.trim()); }
      if (data.agentName && !contact) {
        setContactForm({
          name: data.agentName,
          phone: data.agentPhone || "",
          email: "",
          brokerage: data.brokerage || "",
        });
        setContactMode("new");
      }
    } catch { /* ignore */ }
    setZillow("");
    setZillowLoading(false);
  }

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactForm.name.trim()) return;
    const supabase = createClient();
    const { data } = await supabase.from("contacts").insert({
      name: contactForm.name,
      phone: normalizePhone(contactForm.phone),
      email: contactForm.email || null,
      brokerage: contactForm.brokerage || null,
      stage: "lead",
      type: "lead",
    }).select().single();
    if (data) setContact(data as Contact);
    setContactMode("none");
    await loadData();
  }

  async function logCall() {
    if (!contact || selectedTags.size === 0) return;
    setLogging(true);
    const supabase = createClient();
    const outcome = [...selectedTags].join(",");
    await supabase.from("cold_calls").insert({
      contact_id: contact.id,
      outcome,
      notes: notes || null,
      listing_address: address || null,
      listing_url: listingUrl || null,
      called_by: callerName,
    });
    await supabase.from("contacts").update({ stage: stageFromOutcome(outcome) }).eq("id", contact.id);
    setLogging(false);

    showFlash(
      selectedTags.has("dead") ? "Marked dead" :
      selectedTags.has("interested") ? "Logged as interested 🔥 — remember to follow up tomorrow" :
      selectedTags.has("send_info") ? "Info sent — follow up in ~1 week 📨" :
      selectedTags.has("left_voicemail") ? "Voicemail logged — call back tomorrow" :
      "Logged"
    );

    setNotes("");
    setPrimaryService(null);
    setSelectedAddOns(new Set());
    setAddress("");
    setAddressFromZillow(false);
    setListingUrl("");
    setContact(null);
    setContactMode("none");
    setContactForm({ name: "", phone: "", email: "", brokerage: "" });
    setSelectedTags(new Set());
    await loadData();
  }

  async function saveEditedLog(log: CallLog) {
    if (editTags.size === 0) return;
    const supabase = createClient();
    const outcome = [...editTags].join(",");
    await supabase.from("cold_calls").update({ outcome, notes: editNotes || null }).eq("id", log.id);

    // Recompute the contact's stage from their most recent call log (by date), not necessarily the edited one.
    const { data: mostRecent } = await supabase
      .from("cold_calls")
      .select("outcome, called_at")
      .eq("contact_id", log.contact_id)
      .order("called_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mostRecent) {
      await supabase.from("contacts").update({ stage: stageFromOutcome(mostRecent.outcome) }).eq("id", log.contact_id);
    }

    setEditingLogId(null);
    showFlash("Log updated");
    await loadData();
  }

  async function deleteLog(log: CallLog) {
    const supabase = createClient();
    await supabase.from("cold_calls").delete().eq("id", log.id);
    // Recompute stage from remaining logs
    const { data: remaining } = await supabase
      .from("cold_calls")
      .select("outcome, called_at")
      .eq("contact_id", log.contact_id)
      .order("called_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (remaining) {
      await supabase.from("contacts").update({ stage: stageFromOutcome(remaining.outcome) }).eq("id", log.contact_id);
    }
    setEditingLogId(null);
    showFlash("Log deleted");
    await loadData();
  }

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  async function sendPitch() {
    const target = pitchContact;
    if (!target?.email) return;
    setSendingPitch(true);
    const firstName = target.name.split(" ")[0];
    await fetch("/api/admin/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: target.id,
        to: target.email,
        subject: pitchSubject,
        html: buildPitchHtml(firstName),
        body: `Hi ${firstName},\n\nThanks for the call. Sending our full pricing + portfolio at luckimages.com.\n\nRyan Luck\nLuck Images`,
      }),
    });
    setSendingPitch(false);
    setPitchSent(true);
    showFlash("Pitch email sent ✓");
  }

  // ── Derived ────────────────────────────────────────────────────
  const attemptCounts: Record<string, number> = {};
  callLogs.forEach(l => {
    if (!hasTag(l.outcome, "interested") && !hasTag(l.outcome, "dead"))
      attemptCounts[l.contact_id] = (attemptCounts[l.contact_id] || 0) + 1;
  });

  type EnrichedLog = CallLog & { contact: Contact | undefined; attempts: number };
  const enrichedLogs: EnrichedLog[] = callLogs.map(l => ({
    ...l,
    contact: contacts.find(c => c.id === l.contact_id),
    attempts: attemptCounts[l.contact_id] || 0,
  }));

  // Latest call per contact for bucketed tabs
  const latestByContact: Record<string, EnrichedLog> = {};
  enrichedLogs.forEach(l => {
    if (!latestByContact[l.contact_id]) latestByContact[l.contact_id] = l;
  });
  const latestLogs = Object.values(latestByContact);

  // All unique listing addresses per contact with their URLs (most recent first, blanks excluded)
  const contactListings: Record<string, { address: string; url: string | null }[]> = {};
  enrichedLogs.forEach(l => {
    if (!l.listing_address) return;
    if (!contactListings[l.contact_id]) contactListings[l.contact_id] = [];
    if (!contactListings[l.contact_id].find(x => x.address === l.listing_address))
      contactListings[l.contact_id].push({ address: l.listing_address, url: l.listing_url || null });
  });

  function stagePriority(outcome: string): number {
    if (hasTag(outcome, "interested")) return 0;
    if (!hasTag(outcome, "closed") && !hasTag(outcome, "dead")) return 1; // call again
    if (hasTag(outcome, "closed")) return 2;
    return 3; // dead
  }

  const tabLogs: Record<LogTab, EnrichedLog[]> = {
    all: [...latestLogs].sort((a, b) => stagePriority(a.outcome) - stagePriority(b.outcome) || new Date(b.called_at).getTime() - new Date(a.called_at).getTime()),
    interested: latestLogs.filter(l => hasTag(l.outcome, "interested") && !hasTag(l.outcome, "closed") && !hasTag(l.outcome, "dead")),
    call_again: latestLogs.filter(l => !hasTag(l.outcome, "interested") && !hasTag(l.outcome, "closed") && !hasTag(l.outcome, "dead")).sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime()),
    closed: latestLogs.filter(l => hasTag(l.outcome, "closed")),
    dead: latestLogs.filter(l => hasTag(l.outcome, "dead")),
  };

  const TAB_LABELS: Record<LogTab, string> = {
    all: "All",
    interested: `Interested (${tabLogs.interested.length})`,
    call_again: `Call Again (${tabLogs.call_again.length})`,
    closed: `Closed (${tabLogs.closed.length})`,
    dead: `Dead (${tabLogs.dead.length})`,
  };

  const filteredContacts = contacts.filter(c =>
    searchQuery &&
    (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (c.brokerage || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
     (c.phone || "").includes(searchQuery))
  );

  return (
    <div className="h-screen flex flex-col bg-[#0c0c0c] text-white overflow-hidden">

      {/* Header */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-[#555] text-sm hover:text-white transition-colors">
            ← Back
          </button>
          <h1 className="text-sm font-bold tracking-[3px] uppercase">Cold Calls</h1>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[#222] overflow-hidden">
              <div className="h-full bg-[#4ade80] transition-all" style={{ width: `${Math.min((todayCount / DAILY_GOAL) * 100, 100)}%` }} />
            </div>
            <span className="text-xs font-bold text-[#4ade80] tabular-nums">{todayCount}/{DAILY_GOAL} today</span>
          </div>
          <select value={callerName} onChange={e => setCallerName(e.target.value)}
            className="bg-[#181818] border border-white/10 px-2 py-1 text-xs text-white focus:outline-none">
            <option value="ryan">Ryan</option>
            <option value="leif">Leif</option>
          </select>
        </div>
      </div>

      {/* Week stats */}
      <div className="border-b border-white/10 bg-[#0e0e0e] px-4 md:px-8 py-3 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums">{weekCalls}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">calls this week</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#4ade80]">{weekLeads}</span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">interested</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums text-[#fbbf24]">
            {weekCalls > 0 ? Math.round((weekLeads / weekCalls) * 100) : 0}%
          </span>
          <span className="text-xs tracking-[2px] uppercase text-[#555]">conversion</span>
        </div>
      </div>

      {/* Flash */}
      {flash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#4ade80] text-black text-xs font-bold tracking-[2px] uppercase px-6 py-3 shadow-xl pointer-events-none">
          {flash}
        </div>
      )}

      <div className="flex-1 overflow-hidden max-w-6xl w-full mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* ═══ LEFT: Dialer or Expanded Log ═══ */}
        <div className="space-y-4 relative overflow-y-auto min-h-0">

          {/* Expanded contact panel — overlays the new call block */}
          {expandedLog && (() => {
            const log = enrichedLogs.find(l => l.id === expandedLog);
            if (!log) return null;
            const allCallsForContact = enrichedLogs.filter(l => l.contact_id === log.contact_id).sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime());
            const tagMeta = Object.fromEntries(CALL_TAGS.map(t => [t.key, t]));
            const mostRecent = allCallsForContact[0];
            const currentStage = mostRecent ? stageFromOutcome(mostRecent.outcome) : "new";
            const recentOutcome = mostRecent?.outcome || "";
            const isSendInfo = hasTag(recentOutcome, "send_info") && !hasTag(recentOutcome, "interested") && !hasTag(recentOutcome, "dead");
            const STAGE_META: Record<string, { label: string; color: string; next: string }> = {
              dead: { label: "Dead", color: "#f87171", next: "Marked dead — no action needed unless they reach back out." },
              client: { label: "Closed", color: "#34d399", next: "Registered in the portal as a client." },
              lead: { label: "Interested", color: "#4ade80", next: "Call back tomorrow to follow up. Once they're ready to book, send a Portal Invite to convert them to a client." },
              "follow-up": isSendInfo
                ? { label: "Info Sent", color: "#c084fc", next: "Pricing + portfolio sent — wait ~1 week then call back. Ask what they thought of the work and tell them about the new client portal." }
                : { label: "No Response", color: "#a78bfa", next: "Hasn't given a verdict yet — keep calling back." },
              new: { label: "New", color: "#888", next: "No calls logged yet." },
            };
            const meta = STAGE_META[currentStage] || STAGE_META.new;

            return (
              <div className="absolute inset-0 z-10 bg-[#0c0c0c] space-y-4 overflow-y-auto">
                {/* Contact card */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-[4px] uppercase text-[#555]">Contact</p>
                    {log.contact ? (
                      <button
                        onClick={() => openContact(log.contact!.id)}
                        className="text-lg font-bold mt-1 hover:underline text-left"
                      >
                        {log.contact.name}
                      </button>
                    ) : (
                      <p className="text-lg font-bold mt-1">Unknown</p>
                    )}
                    {log.contact?.brokerage && <p className="text-xs text-[#444]">{log.contact.brokerage}</p>}
                    {(contactListings[log.contact_id] || []).length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {contactListings[log.contact_id].map(l => (
                          <p key={l.address} className="text-sm text-[#555]">
                            📍 {l.url
                              ? <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-white hover:underline">{l.address}</a>
                              : <span className="text-white">{l.address}</span>}
                          </p>
                        ))}
                      </div>
                    )}
                    {log.contact?.phone && <a href={`tel:${log.contact.phone}`} className="text-sm text-[#4ade80] font-mono mt-1 block">{log.contact.phone}</a>}
                    {log.contact?.email && <p className="text-xs text-[#444] mt-0.5">{log.contact.email}</p>}
                  </div>
                  <button onClick={() => { setExpandedLog(null); setEditingLogId(null); }} className="text-[#444] hover:text-white text-xl leading-none shrink-0 mt-1">✕</button>
                </div>

                {/* Status + next step */}
                <div className="bg-[#111] border border-white/10 p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                    <span className="text-xs font-bold tracking-[1px] uppercase" style={{ color: meta.color }}>{meta.label}</span>
                  </div>
                  <p className="text-xs text-[#888]">{meta.next}</p>
                </div>

                {/* Call history — editable */}
                <div className="bg-[#111] border border-white/10 divide-y divide-white/5">
                  <p className="px-4 py-2 text-[10px] tracking-[2px] uppercase text-[#555]">Lead History ({allCallsForContact.length})</p>
                  {allCallsForContact.map(c => {
                    const isEditing = editingLogId === c.id;
                    if (isEditing) {
                      return (
                        <div key={c.id} className="px-4 py-3 space-y-2 bg-white/[0.02]">
                          <TagBubbles selected={editTags} onToggle={key => setEditTags(prev => toggleTag(prev, key))} />
                          <textarea
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            rows={2}
                            placeholder="Notes..."
                            className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2 outline-none focus:border-white/30 resize-none placeholder:text-[#333]"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setEditingLogId(null)} className="text-xs px-3 py-1.5 border border-white/10 text-[#555] hover:text-white transition-colors">
                              Cancel
                            </button>
                            <button onClick={() => deleteLog(c)}
                              className="text-xs px-3 py-1.5 border border-red-900/40 text-red-500 hover:bg-red-900/20 transition-colors">
                              Delete
                            </button>
                            <button onClick={() => saveEditedLog(c)} disabled={editTags.size === 0}
                              className="flex-1 text-xs tracking-[1px] uppercase bg-white text-black py-1.5 hover:bg-[#ddd] transition-colors font-bold disabled:opacity-30">
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={c.id} className="px-4 py-3 group">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            {c.outcome.split(",").map(tag => {
                              const tm = tagMeta[tag as CallTag];
                              return (
                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide"
                                  style={{ color: tm?.color || "#888", background: `${tm?.color || "#888"}1a` }}>
                                  {tm ? `${tm.emoji} ${tm.label}` : tag}
                                </span>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-[#333]">
                              {new Date(c.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {c.called_by}
                            </span>
                            <button
                              onClick={() => { setEditingLogId(c.id); setEditTags(new Set(c.outcome.split(",") as CallTag[])); setEditNotes(c.notes || ""); }}
                              className="text-[#444] hover:text-white text-xs transition-colors"
                            >
                              ✎
                            </button>
                          </div>
                        </div>
                        {c.listing_address && <p className="text-xs text-[#444] mt-0.5">📍 {c.listing_address}</p>}
                        {c.notes && <p className="text-xs text-[#444] italic mt-0.5">&ldquo;{c.notes}&rdquo;</p>}
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      if (log.contact) {
                        selectContact(log.contact);
                        setContactInput("");
                        setCreatingNew(false);
                      }
                      setExpandedLog(null);
                      setEditingLogId(null);
                    }}
                    className="w-full text-xs tracking-[1px] uppercase font-bold py-3 border border-white/10 text-white hover:bg-white/5 transition-colors"
                  >
                    📞 Log New Call
                  </button>
                  {log.contact && (
                    <button
                      onClick={() => {
                        setPitchContact(log.contact!);
                        setPitchSent(false);
                        setPitchSubject("Real Estate Photography — Luck Images");
                        setShowPitch(true);
                        setExpandedLog(null);
                        setEditingLogId(null);
                      }}
                      className="w-full text-xs tracking-[1px] uppercase font-bold py-3 border border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/10 transition-colors"
                    >
                      ✉ Send Media / Pricing Follow-up
                    </button>
                  )}
                  {log.contact && currentStage === "lead" && (
                    <a
                      href={`/dashboard/outreach?contact=${log.contact.id}&template=portal_invite`}
                      className="block w-full text-center text-xs tracking-[1px] uppercase font-bold py-3 border border-[#60a5fa]/30 text-[#60a5fa] hover:bg-[#60a5fa]/10 transition-colors"
                    >
                      🔑 Send Portal Invite
                    </a>
                  )}
                  {log.contact && (
                    <a
                      href={`/admin/contacts/${log.contact.id}`}
                      className="block w-full text-center text-xs tracking-[1px] uppercase py-3 border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-colors"
                    >
                      ↗ View Full Contact Profile
                    </a>
                  )}
                </div>
              </div>
            );
          })()}

          <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            New Call
          </p>

          {/* Zillow import */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-3">
            <p className="text-xs tracking-[2px] uppercase text-[#555]">Zillow Listing URL</p>
            <div className="flex gap-2">
              <input
                value={zillow}
                onChange={e => setZillow(e.target.value)}
                onKeyDown={e => e.key === "Enter" && importZillow()}
                placeholder="https://zillow.com/homedetails/..."
                className="flex-1 bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
              />
              <button
                onClick={importZillow}
                disabled={zillowLoading || !zillow.trim()}
                className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all disabled:opacity-40 shrink-0"
              >
                {zillowLoading ? "..." : "Import"}
              </button>
            </div>
            {addressFromZillow && address ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[#4ade80]">📍 {address}</p>
                <button onClick={() => { setAddress(""); setAddressFromZillow(false); setListingUrl(""); }} className="text-[#444] hover:text-white text-xs">✕</button>
              </div>
            ) : (
              <input
                value={address}
                onChange={e => { setAddress(e.target.value); setAddressFromZillow(false); }}
                placeholder="Or type address manually..."
                className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
              />
            )}
          </div>

          {/* Dead lead warning */}
          {contact && latestByContact[contact.id] && hasTag(latestByContact[contact.id].outcome, "dead") && (
            <div className="flex items-center gap-3 bg-[#f87171]/10 border border-[#f87171]/40 px-4 py-3">
              <span className="text-[#f87171] text-lg">⚠️</span>
              <p className="text-xs font-bold tracking-[1px] uppercase text-[#f87171]">Warning: this lead has been marked dead</p>
            </div>
          )}

          {/* Contact */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-3">
            <p className="text-xs tracking-[2px] uppercase text-[#555]">Agent / Contact</p>

            {contact ? (
              <div className="space-y-2">
                {/* Primary contact + any linked team members */}
                {[contact, ...additionalContacts].map((c, idx) => (
                  <div key={c.id} className="bg-[#181818] border border-white/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <button onClick={() => openContact(c.id)} className="font-semibold hover:underline text-left">{c.name}</button>
                        {c.brokerage && <p className="text-xs text-[#555] mt-0.5">{c.brokerage}</p>}
                        {attemptCounts[c.id] > 0 && (
                          <p className="text-xs text-[#fbbf24] mt-1">
                            📞 {attemptCounts[c.id]} previous attempt{attemptCounts[c.id] !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (idx === 0) { setContact(null); setAdditionalContacts([]); setShowAddContact(false); setContactForm({ name: "", phone: "", email: "", brokerage: "" }); setContactMode("none"); }
                          else setAdditionalContacts(prev => prev.filter(x => x.id !== c.id));
                        }}
                        className="text-[#444] hover:text-white text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add another contact to this call */}
                {!showAddContact ? (
                  <button onClick={() => setShowAddContact(true)} className="text-[10px] tracking-[1px] uppercase text-[#444] hover:text-white transition-colors">
                    + Add team member
                  </button>
                ) : (
                  <div className="relative">
                    <input
                      autoFocus
                      value={addContactInput}
                      onChange={e => setAddContactInput(e.target.value)}
                      onBlur={() => setTimeout(() => setShowAddContact(false), 150)}
                      placeholder="Search contact to add..."
                      className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
                    />
                    {addContactInput.trim().length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 bg-[#181818] border border-white/10 border-t-0 max-h-40 overflow-y-auto divide-y divide-white/5">
                        {contacts.filter(c =>
                          c.id !== contact.id &&
                          !additionalContacts.find(a => a.id === c.id) &&
                          (c.name.toLowerCase().includes(addContactInput.toLowerCase()) ||
                           (c.brokerage || "").toLowerCase().includes(addContactInput.toLowerCase()))
                        ).slice(0, 6).map(c => (
                          <button key={c.id} onMouseDown={() => { setAdditionalContacts(prev => [...prev, c]); setAddContactInput(""); setShowAddContact(false); }}
                            className="w-full text-left px-3 py-2.5 text-xs hover:bg-white/5 transition-colors">
                            <span className="font-medium">{c.name}</span>
                            {c.brokerage && <span className="text-[#555] ml-2">{c.brokerage}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Unified search + create input */}
                <div className="relative">
                  <input
                    autoFocus
                    value={contactInput}
                    onChange={e => {
                      setContactInput(e.target.value);
                      setShowDropdown(true);
                      setCreatingNew(false);
                      setContactForm(f => ({ ...f, name: e.target.value }));
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    placeholder="Type agent name, brokerage, or phone..."
                    className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
                  />
                  {showDropdown && contactInput.trim().length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 bg-[#181818] border border-white/10 border-t-0 max-h-52 overflow-y-auto divide-y divide-white/5">
                      {contacts.filter(c =>
                        c.name.toLowerCase().includes(contactInput.toLowerCase()) ||
                        (c.brokerage || "").toLowerCase().includes(contactInput.toLowerCase()) ||
                        (c.phone || "").includes(contactInput)
                      ).slice(0, 8).map(c => (
                        <button
                          key={c.id}
                          onMouseDown={() => {
                            selectContact(c);
                            setContactInput("");
                            setShowDropdown(false);
                            setCreatingNew(false);
                          }}
                          className="w-full text-left px-3 py-2.5 text-xs hover:bg-white/5 transition-colors"
                        >
                          <span className="font-medium text-white">{c.name}</span>
                          {c.brokerage && <span className="text-[#555] ml-2">{c.brokerage}</span>}
                          {c.phone && <span className="text-[#333] ml-2">{c.phone}</span>}
                          {attemptCounts[c.id] > 0 && (
                            <span className="text-[#fbbf24] ml-2">({attemptCounts[c.id]}x called)</span>
                          )}
                        </button>
                      ))}
                      {/* Create new option always at bottom */}
                      <button
                        onMouseDown={() => {
                          setCreatingNew(true);
                          setShowDropdown(false);
                          setContactForm(f => ({ ...f, name: contactInput }));
                        }}
                        className="w-full text-left px-3 py-2.5 text-xs text-[#4ade80] hover:bg-white/5 transition-colors"
                      >
                        + Create &quot;{contactInput}&quot; as new contact
                      </button>
                    </div>
                  )}
                </div>

                {/* New contact extra fields — shown inline after picking "Create new" */}
                {creatingNew && (
                  <form onSubmit={async e => {
                    e.preventDefault();
                    await createContact(e);
                    setCreatingNew(false);
                    setContactInput("");
                  }} className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                      <input value={contactForm.brokerage} onChange={e => setContactForm(f => ({ ...f, brokerage: e.target.value }))}
                        placeholder="Brokerage"
                        className="bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    </div>
                    <input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="Email (optional)"
                      className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => { setCreatingNew(false); setContactInput(""); setContactForm({ name: "", phone: "", email: "", brokerage: "" }); }}
                        className="text-xs px-3 py-2 border border-white/10 text-[#555] hover:text-white transition-colors">
                        Cancel
                      </button>
                      <button type="submit"
                        className="flex-1 text-xs tracking-[1px] uppercase bg-white text-black py-2 hover:bg-[#ddd] transition-colors font-bold">
                        Save &amp; Select
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Service + Pricing */}
          <div className="bg-[#111] border border-white/10 p-5 space-y-4">
            <p className="text-xs tracking-[2px] uppercase text-[#555]">Service / Pricing</p>

            {/* Primary service — mutually exclusive */}
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#333] mb-2">Primary Service</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "photos_sm",    label: "Photos",         price: "$200–$400" },
                  { key: "drone",        label: "Drone Photos",   price: "$200+" },
                  { key: "video_bronze", label: "Video Bronze",   price: "$200" },
                  { key: "video_silver", label: "Video Silver",   price: "$300" },
                  { key: "video_gold",   label: "Video Gold",     price: "Custom" },
                  { key: "matterport",   label: "Matterport 3D",  price: "$200–$500" },
                  { key: "twilight",     label: "Twilight",       price: "$400" },
                  { key: "virtual_staging", label: "Virtual Staging", price: "$25–$150" },
                  { key: "floor_plan",   label: "Floor Plan",     price: "$50–$75" },
                  { key: "headshots",    label: "Headshots",      price: "$200+" },
                ] as const).map(svc => (
                  <button
                    key={svc.key}
                    onClick={() => setPrimaryService(prev => prev === svc.key ? null : svc.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      primaryService === svc.key
                        ? "bg-white text-black border-white"
                        : "bg-transparent text-[#555] border-white/10 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    {svc.label}
                    <span className={`text-[10px] ${primaryService === svc.key ? "text-black/50" : "text-[#333]"}`}>{svc.price}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Add-ons — multi-select */}
            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-[#333] mb-2">Add-Ons</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "addon_drone",      label: "Drone Photos",   price: "+$100–$150" },
                  { key: "addon_twilight",   label: "Twilight",       price: "+$150–$200" },
                  { key: "addon_matterport", label: "Matterport 3D",  price: "+$100–$250" },
                  { key: "addon_floor_plan", label: "Floor Plan",     price: "+$50–$75" },
                ] as const).map(addon => {
                  const active = selectedAddOns.has(addon.key);
                  return (
                    <button
                      key={addon.key}
                      onClick={() => setSelectedAddOns(prev => {
                        const next = new Set(prev);
                        next.has(addon.key) ? next.delete(addon.key) : next.add(addon.key);
                        return next;
                      })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        active
                          ? "bg-white/10 text-white border-white/30"
                          : "bg-transparent text-[#555] border-white/10 hover:border-white/20 hover:text-[#888]"
                      }`}
                    >
                      {addon.label}
                      <span className={`text-[10px] ${active ? "text-white/40" : "text-[#333]"}`}>{addon.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[#111] border border-white/10 p-5">
            <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">
              Notes <span className="normal-case tracking-normal text-[#333]">(optional)</span>
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="What happened on the call..."
              className="w-full bg-[#181818] border border-white/10 text-white text-xs px-3 py-2.5 outline-none focus:border-white/30 resize-none placeholder:text-[#333]"
            />
          </div>

          {/* Outcome tags — multi-select */}
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-3">Log Outcome <span className="normal-case tracking-normal text-[#333]">(select all that apply)</span></p>
            <TagBubbles
              selected={selectedTags}
              disabled={!contact}
              onToggle={key => setSelectedTags(prev => toggleTag(prev, key))}
            />
            <button
              onClick={logCall}
              disabled={!contact || logging || selectedTags.size === 0}
              className="w-full mt-3 text-xs tracking-[2px] uppercase font-bold py-3.5 bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {logging ? "Saving..." : "Save Call Log"}
            </button>
          </div>
        </div>

        {/* ═══ RIGHT: Log ═══ */}
        <div className="flex flex-col min-h-0 gap-4">
          <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Call Log
          </p>

          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-white/10">
            {(["all", "interested", "call_again", "closed", "dead"] as LogTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setLogTab(tab)}
                className={`px-4 py-2.5 text-xs tracking-[1px] uppercase whitespace-nowrap transition-colors border-b-2 ${
                  logTab === tab ? "border-white text-white" : "border-transparent text-[#555] hover:text-white"
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          <div className="bg-[#111] border border-white/10 divide-y divide-white/5 flex-1 overflow-y-auto min-h-0">
            {tabLogs[logTab].length === 0 ? (
              <p className="px-5 py-10 text-xs text-[#333] italic text-center">Nothing here yet.</p>
            ) : tabLogs[logTab].map((log: EnrichedLog) => {
              const isExpanded = expandedLog === log.id;
              const initials = (log.contact?.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
              const mostRecentAddress = contactListings[log.contact_id]?.[0] ?? null;
              const isInterested = hasTag(log.outcome, "interested") && !hasTag(log.outcome, "closed") && !hasTag(log.outcome, "dead");
              const isSendInfoRow = hasTag(log.outcome, "send_info") && !hasTag(log.outcome, "interested") && !hasTag(log.outcome, "closed") && !hasTag(log.outcome, "dead");
              const isCallAgain = !hasTag(log.outcome, "interested") && !hasTag(log.outcome, "send_info") && !hasTag(log.outcome, "closed") && !hasTag(log.outcome, "dead");
              const rowAccent = logTab === "all"
                ? isInterested ? "border-l-2 border-l-[#4ade80] bg-[#4ade80]/[0.03]"
                : isSendInfoRow ? "border-l-2 border-l-[#c084fc] bg-[#c084fc]/[0.03]"
                : isCallAgain ? "border-l-2 border-l-[#fbbf24] bg-[#fbbf24]/[0.03]"
                : ""
                : "";
              return (
                <div key={log.id}
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  className={`px-4 py-3.5 cursor-pointer transition-colors ${rowAccent} ${isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold text-white/60 shrink-0">
                      {initials}
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={e => { e.stopPropagation(); if (log.contact) openContact(log.contact.id); }}
                        className="text-sm font-semibold hover:underline text-left leading-tight"
                      >
                        {log.contact?.name || "Unknown"}
                      </button>
                      {log.contact?.brokerage && (
                        <p className="text-[11px] text-[#444] mt-0.5">{log.contact.brokerage}</p>
                      )}
                      {mostRecentAddress && (
                        <p className="text-[11px] text-[#555] mt-0.5" onClick={e => e.stopPropagation()}>
                          📍 {mostRecentAddress.url
                            ? <a href={mostRecentAddress.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-white transition-colors">{mostRecentAddress.address}</a>
                            : mostRecentAddress.address}
                        </p>
                      )}
                      <p className="text-[10px] text-[#333] mt-1">
                        {new Date(log.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {log.called_by}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pitch email modal */}
      {showPitch && pitchContact && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
          onClick={() => !sendingPitch && setShowPitch(false)}>
          <div className="bg-[#111] border border-white/15 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-xs font-bold tracking-[3px] uppercase">Send Pitch Email</p>
                <p className="text-xs text-[#555] mt-0.5">Pricing · portfolio · portal</p>
              </div>
              <button onClick={() => setShowPitch(false)} className="text-[#555] hover:text-white text-lg leading-none">✕</button>
            </div>

            {pitchSent ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-4xl">✓</p>
                <p className="text-sm font-semibold text-[#4ade80]">Sent to {pitchContact.email}</p>
                <button onClick={() => setShowPitch(false)}
                  className="mt-2 text-xs tracking-[2px] uppercase border border-white/10 px-6 py-2.5 text-[#888] hover:text-white hover:border-white/30 transition-all">
                  Close
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="bg-[#181818] border border-white/10 px-4 py-3">
                  <p className="text-xs text-[#555] mb-0.5">To</p>
                  <p className="text-sm font-semibold">{pitchContact.name}</p>
                  {pitchContact.email
                    ? <p className="text-xs text-[#4ade80] mt-0.5">{pitchContact.email}</p>
                    : <p className="text-xs text-[#fbbf24] mt-0.5">⚠ No email — add one to the contact first</p>
                  }
                </div>
                <div>
                  <p className="text-xs text-[#555] mb-1.5 tracking-[1px] uppercase">Subject</p>
                  <input value={pitchSubject} onChange={e => setPitchSubject(e.target.value)}
                    className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30" />
                </div>
                <div className="bg-[#0d0d0d] border border-white/5 p-4 space-y-1.5">
                  {[
                    "Full pricing table (all services)",
                    "Portfolio link — luckimages.com",
                    "Client portal overview + link",
                    "Personal sign-off from Ryan",
                  ].map(item => (
                    <p key={item} className="text-xs text-[#777] flex items-center gap-2">
                      <span className="text-[#4ade80]">✓</span>{item}
                    </p>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowPitch(false)}
                    className="flex-1 py-3 text-xs tracking-[1px] uppercase border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-all">
                    Skip
                  </button>
                  <button onClick={sendPitch} disabled={sendingPitch || !pitchContact.email}
                    className="flex-1 py-3 text-xs tracking-[2px] uppercase font-bold bg-white text-black hover:bg-[#ddd] transition-colors disabled:opacity-40">
                    {sendingPitch ? "Sending..." : "Send →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
