"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

const supabase = createClient();
const SITE_URL = "https://www.luckimages.com";
const COOLDOWN_DAYS = 7;

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  stage: string;
  total_revenue: number | null;
  user_id: string | null;
};

type InviteTarget = { id: string; name: string; email: string; phone: string | null };

type InviteStatus = "idle" | "pending" | "done" | "error";

type SendRow = { id: string; batch_id: string; contact_id: string; sent_by: string; sent_at: string };

type ClickRow = { id: string; contact_id: string; clicked_at: string };

type ViewRow = {
  link_click_id: string | null;
  duration_seconds: number | null;
  country: string | null;
  region: string | null;
  city: string | null;
  user_agent: string | null;
};

type BatchSummary = { batchId: string; sentBy: string; sentAt: string; recipientCount: number };

type ContactFunnelRow = {
  contactId: string;
  name: string;
  email: string;
  phone: string | null;
  sentAt: string;
  clickedAt: string | null;
  dwellSeconds: number | null;
  country: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  registeredAt: string | null;
};

function coarseDevice(ua: string | null): string {
  if (!ua) return "Unknown";
  if (/iPad/i.test(ua)) return "iPad";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "Other";
}

// How long after send a contact clicked or registered — surfaces fast
// responders as the hottest leads.
function fmtElapsed(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

// Blue = sent but no click yet, yellow = clicked, green = registered —
// whichever is furthest along wins, regardless of the others' state.
function statusColor(r: { clickedAt: string | null; registeredAt: string | null }): string {
  if (r.registeredAt) return "#4ade80";
  if (r.clickedAt) return "#fbbf24";
  return "#60a5fa";
}

export default function InviteAllPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, InviteStatus>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);

  const [sends, setSends] = useState<SendRow[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<ContactFunnelRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notClickedOpen, setNotClickedOpen] = useState(false);
  const [perContactOpen, setPerContactOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"status" | "alpha" | "time">("status");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !ADMIN_EMAILS.includes(user.email || "")) { router.replace("/dashboard"); return; }
      const { data } = await supabase
        .from("contacts")
        .select("id, name, email, phone, stage, total_revenue, user_id")
        .not("email", "is", null)
        .is("user_id", null)
        .neq("stage", "deleted")
        .neq("stage", "lead")
        .order("total_revenue", { ascending: false, nullsFirst: false });
      setContacts((data || []).filter(c => c.email));
      setLoading(false);
      await loadSends();
    }
    load();
  }, []);

  async function loadSends() {
    const { data } = await supabase
      .from("mass_invite_sends")
      .select("id, batch_id, contact_id, sent_by, sent_at")
      .order("sent_at", { ascending: false })
      .limit(2000);
    const rows = (data || []) as SendRow[];
    setSends(rows);
    if (rows.length > 0) setActiveBatchId(prev => prev ?? rows[0].batch_id);
  }

  const batches: BatchSummary[] = (() => {
    const byBatch = new Map<string, SendRow[]>();
    for (const r of sends) {
      const list = byBatch.get(r.batch_id);
      if (list) list.push(r); else byBatch.set(r.batch_id, [r]);
    }
    return [...byBatch.entries()]
      .map(([batchId, rows]) => ({
        batchId,
        sentBy: rows[0].sent_by,
        sentAt: rows.reduce((min, r) => (r.sent_at < min ? r.sent_at : min), rows[0].sent_at),
        recipientCount: rows.length,
      }))
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  })();

  // Most recent invite each contact has ever been sent, across all batches —
  // powers the re-invite cooldown badge in the picker below.
  const lastSentByContact: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    for (const r of sends) {
      if (!map[r.contact_id] || r.sent_at > map[r.contact_id]) map[r.contact_id] = r.sent_at;
    }
    return map;
  })();

  function cooldownDaysAgo(contactId: string): number | null {
    const last = lastSentByContact[contactId];
    if (!last) return null;
    const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    return days < COOLDOWN_DAYS ? days : null;
  }

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!activeBatchId) { setBatchDetail([]); return; }
      setDetailLoading(true);
      const thisBatchRows = sends.filter(r => r.batch_id === activeBatchId);
      const contactIds = thisBatchRows.map(r => r.contact_id);
      if (contactIds.length === 0) { setBatchDetail([]); setDetailLoading(false); return; }

      const [{ data: contactsData }, { data: clicksData }] = await Promise.all([
        supabase.from("contacts").select("id, name, email, phone, registered_at").in("id", contactIds),
        supabase.from("link_clicks").select("id, contact_id, clicked_at").eq("service", "portal_invite").in("contact_id", contactIds),
      ]);
      const clicks = (clicksData || []) as ClickRow[];
      const clickIds = clicks.map(c => c.id);
      const { data: viewsData } = clickIds.length
        ? await supabase.from("page_views")
            .select("link_click_id, duration_seconds, country, region, city, user_agent")
            .in("link_click_id", clickIds)
        : { data: [] as ViewRow[] };
      const views = (viewsData || []) as ViewRow[];

      const contactsById: Record<string, { id: string; name: string; email: string; phone: string | null; registered_at: string | null }> =
        Object.fromEntries((contactsData || []).map(c => [c.id, c]));
      const viewByClickId: Record<string, ViewRow> = Object.fromEntries(
        views.filter(v => v.link_click_id).map(v => [v.link_click_id as string, v])
      );

      const rows: ContactFunnelRow[] = thisBatchRows.map(row => {
        // A resend produces the exact same tracked URL for that contact (it
        // encodes contact_id, not batch_id), so a click can't be physically
        // distinguished as coming from this send vs. an earlier resend —
        // attribute it to whichever batch's [sent_at, next resend's sent_at)
        // window it falls in.
        const nextSentAt = sends
          .filter(r => r.contact_id === row.contact_id && r.sent_at > row.sent_at)
          .reduce((min: string | null, r) => (!min || r.sent_at < min ? r.sent_at : min), null);

        const windowClicks = clicks
          .filter(c => c.contact_id === row.contact_id && c.clicked_at >= row.sent_at && (!nextSentAt || c.clicked_at < nextSentAt))
          .sort((a, b) => a.clicked_at.localeCompare(b.clicked_at));
        const firstClick = windowClicks[0] || null;
        const view = firstClick ? viewByClickId[firstClick.id] : undefined;
        const contact = contactsById[row.contact_id];

        return {
          contactId: row.contact_id,
          name: contact?.name || "—",
          email: contact?.email || "—",
          phone: contact?.phone ?? null,
          sentAt: row.sent_at,
          clickedAt: firstClick?.clicked_at ?? null,
          dwellSeconds: view?.duration_seconds ?? null,
          country: view?.country ?? null,
          region: view?.region ?? null,
          city: view?.city ?? null,
          device: view ? coarseDevice(view.user_agent) : null,
          registeredAt: contact?.registered_at ?? null,
        };
      });

      if (!cancelled) { setBatchDetail(rows); setDetailLoading(false); }
    }
    loadDetail();
    return () => { cancelled = true; };
  }, [activeBatchId, sends]);

  async function sendToContacts(toInvite: InviteTarget[]) {
    if (toInvite.length === 0) return;
    setSending(true);
    setSent(0);

    const { data: { user } } = await supabase.auth.getUser();
    const senderTag = user?.email?.split("@")[0]?.toLowerCase() || "ryan";
    const batchId = crypto.randomUUID();

    for (const contact of toInvite) {
      setStatuses(s => ({ ...s, [contact.id]: "pending" }));
      try {
        const firstName = contact.name.split(" ")[0];

        // Build pre-filled register URL — contact_id ensures linking even if
        // they tweak their email; name/email/phone pre-fill the form fields.
        const params = new URLSearchParams({ contact_id: contact.id, name: contact.name, email: contact.email });
        if (contact.phone) params.set("phone", contact.phone);
        const registerUrl = `${SITE_URL}/register?${params.toString()}`;

        // Route through track-link so the click gets recorded — service
        // "portal_invite" keeps these queryable separately from other
        // custom-URL track-link uses (e.g. the Instagram DM generator's
        // service="instagram-dm" links). The redirect appends ?lc=<id>,
        // which PageTracker reports dwell time against once they land.
        const trackedUrl = `${SITE_URL}/api/track-link?url=${encodeURIComponent(registerUrl)}&contact=${contact.id}&service=portal_invite`;

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" background="${SITE_URL}/hero-1.jpg" style="background-color:#0c0c0c;background-image:linear-gradient(rgba(12,12,12,0.72),rgba(12,12,12,0.72)),url('${SITE_URL}/hero-1.jpg');background-size:cover;background-position:center;">
    <tr><td align="center" style="padding:48px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="border:1px solid rgba(255,255,255,0.15);padding:40px;background:rgba(12,12,12,0.55);">
          <h1 style="margin:0 0 20px;font-size:22px;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase;color:#fff;">
            Luck Images<br />New Realtor Portal
          </h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#888;">
            You're invited, ${firstName}.
          </p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#888;">
            I've built a private client portal for Luck Images — a hub where you can view all your past shoots, download delivered photos, and track invoices in one place.
          </p>
          <p style="margin:0 0 32px;font-size:14px;line-height:1.6;color:#888;">
            Your info is already on file — just click below to set a password and you're in. Takes about 30 seconds.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${trackedUrl}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:14px 32px;">
              Create Your Account →
            </a>
          </td></tr></table>
          <p style="margin:28px 0 0;font-size:11px;color:#555;line-height:1.6;">
            Questions? Just reply to this email — I'm happy to help.
          </p>
        </td></tr>
        <tr><td style="padding-top:24px;">
          <p style="margin:0;font-size:11px;color:#333;letter-spacing:1px;">Ryan Luck — Luck Images · Austin, TX · ryan@luckimages.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        const res = await fetch("/api/admin/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: contact.id,
            to: contact.email,
            subject: `${firstName}, your Luck Images client portal is ready`,
            html,
            category: "Portal Invite",
          }),
        });
        if (!res.ok) throw new Error("Send failed");
        setStatuses(s => ({ ...s, [contact.id]: "done" }));
        setSent(n => n + 1);

        // Best-effort tracking write — a failure here must not flip a
        // genuinely-sent email to "error" in the UI, so it's caught on its
        // own, outside the send's own try/catch failure path.
        const { error: trackErr } = await supabase
          .from("mass_invite_sends")
          .insert({ batch_id: batchId, contact_id: contact.id, sent_by: senderTag });
        if (trackErr) console.error("mass_invite_sends insert failed", trackErr);
      } catch {
        setStatuses(s => ({ ...s, [contact.id]: "error" }));
      }

      // Small delay to avoid Resend rate limits
      await new Promise(r => setTimeout(r, 400));
    }

    setSending(false);
    setActiveBatchId(batchId);
    await loadSends();
  }

  async function sendInvites() {
    await sendToContacts(contacts.filter(c => selected.has(c.id)));
  }

  async function resendTo(row: ContactFunnelRow) {
    await sendToContacts([{ id: row.contactId, name: row.name, email: row.email, phone: row.phone }]);
  }

  async function resendAllUnclicked() {
    const targets = batchDetail
      .filter(r => !r.clickedAt)
      .map(r => ({ id: r.contactId, name: r.name, email: r.email, phone: r.phone }));
    await sendToContacts(targets);
  }

  function exportCsv() {
    const header = ["Name", "Email", "Sent At", "Clicked At", "Time to Click", "Dwell (s)", "Registered At", "Time to Register", "Location", "Device"];
    const rows = batchDetail.map(r => [
      r.name,
      r.email,
      new Date(r.sentAt).toISOString(),
      r.clickedAt ? new Date(r.clickedAt).toISOString() : "",
      r.clickedAt ? fmtElapsed(r.sentAt, r.clickedAt) : "",
      r.dwellSeconds != null ? String(Math.round(r.dwellSeconds)) : "",
      r.registeredAt ? new Date(r.registeredAt).toISOString() : "",
      r.registeredAt ? fmtElapsed(r.sentAt, r.registeredAt) : "",
      [r.city, r.region, r.country].filter(Boolean).join(", "),
      r.device || "",
    ]);
    const csv = [header, ...rows].map(row => row.map(cell => csvCell(String(cell))).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mass-invite-${(activeBatchId || "batch").slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalSelected = selected.size;
  const doneCount = Object.values(statuses).filter(s => s === "done").length;

  const fmtDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const fmtDwell = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  const sentCount = batchDetail.length;
  const clickedCount = batchDetail.filter(r => r.clickedAt).length;
  const registeredCount = batchDetail.filter(r => r.clickedAt && r.registeredAt).length;
  const notClicked = batchDetail.filter(r => !r.clickedAt);
  const sortedDetail = [...batchDetail].sort((a, b) => {
    if (sortMode === "alpha") return a.name.localeCompare(b.name);
    if (sortMode === "time") return a.sentAt.localeCompare(b.sentAt);
    const rank = (r: ContactFunnelRow) => (r.registeredAt ? 2 : r.clickedAt ? 1 : 0);
    return rank(b) - rank(a);
  });

  const locationBreakdown = (() => {
    const counts: Record<string, number> = {};
    for (const r of batchDetail) {
      if (!r.clickedAt) continue;
      const label = [r.city, r.region].filter(Boolean).join(", ") || r.country || "Unknown";
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();

  const deviceBreakdown = (() => {
    const counts: Record<string, number> = {};
    for (const r of batchDetail) {
      if (!r.clickedAt) continue;
      const label = r.device || "Unknown";
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <div className="flex items-center gap-6">
          <a href="/admin/contacts" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Contacts</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 py-8 md:py-12 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-1">Client Outreach</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">Mass Portal Invite</h1>
          <p className="text-sm text-[#555] mt-2">
            Send personalized portal invite emails to past clients who don&apos;t have an account yet.
            Each gets a personalized link to create their account.
          </p>
        </div>

        {/* Results */}
        <div className="mb-12">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Results
          </p>

          {batches.length === 0 ? (
            <p className="text-xs text-[#444]">No invites sent yet — send your first batch below to see results here.</p>
          ) : (
            <>
              {/* Batch picker */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                {batches.map(b => (
                  <button
                    key={b.batchId}
                    onClick={() => setActiveBatchId(b.batchId)}
                    className={`shrink-0 text-left px-4 py-2 border text-xs transition-colors ${b.batchId === activeBatchId ? "border-white bg-white/10" : "border-white/10 text-[#666] hover:border-white/30"}`}
                  >
                    <p>{fmtDateTime(b.sentAt)} · {b.recipientCount} recipient{b.recipientCount !== 1 ? "s" : ""}</p>
                    <p className="text-[10px] text-[#555] uppercase tracking-wide">by {b.sentBy}</p>
                  </button>
                ))}
              </div>

              {detailLoading ? (
                <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
              ) : (
                <>
                  {/* Funnel */}
                  <div className="border border-white/10 p-6 flex flex-col md:flex-row items-stretch gap-4 mb-6">
                    {[
                      { label: "Sent", value: sentCount, color: "#a78bfa" },
                      { label: "Clicked", value: clickedCount, color: "#60a5fa" },
                      { label: "Registered", value: registeredCount, color: "#4ade80" },
                    ].map((stage, i, arr) => {
                      const prev = i > 0 ? arr[i - 1].value : null;
                      const rate = prev && prev > 0 ? Math.round((stage.value / prev) * 100) : null;
                      return (
                        <div key={stage.label} className="flex items-center gap-4 flex-1">
                          <div className="flex-1 text-center">
                            <p className="text-3xl font-black" style={{ color: stage.color }}>{stage.value.toLocaleString()}</p>
                            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">{stage.label}</p>
                            {rate !== null && <p className="text-[10px] text-[#444] mt-1">{rate}% of previous</p>}
                          </div>
                          {i < arr.length - 1 && <span className="text-[#333] text-lg">→</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Not yet clicked — collapsible */}
                  {notClicked.length > 0 && (
                    <div className="border border-white/10 p-5 mb-6">
                      <div className="flex items-center justify-between">
                        <button onClick={() => setNotClickedOpen(o => !o)} className="flex items-center gap-2 text-[10px] tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">
                          <span className={`inline-block transition-transform ${notClickedOpen ? "rotate-90" : ""}`}>▸</span>
                          Not Yet Clicked ({notClicked.length})
                        </button>
                        <button onClick={resendAllUnclicked} disabled={sending} className="text-[10px] tracking-wide uppercase text-[#60a5fa] hover:text-white transition-colors disabled:opacity-40">
                          Resend All
                        </button>
                      </div>
                      {notClickedOpen && (
                        <div className="divide-y divide-white/5 mt-3">
                          {notClicked.map(r => (
                            <div key={r.contactId} className="flex items-center justify-between py-2">
                              <div>
                                <p className="text-sm">{r.name}</p>
                                <p className="text-xs text-[#555]">{r.email}</p>
                              </div>
                              <button onClick={() => resendTo(r)} disabled={sending} className="text-[10px] tracking-wide uppercase text-[#666] hover:text-white transition-colors disabled:opacity-40">
                                Resend
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location + device breakdown */}
                  {clickedCount > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <div className="border border-white/10 p-5">
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-3">By Location</p>
                        <div className="space-y-1.5">
                          {locationBreakdown.map(([label, count]) => (
                            <div key={label} className="flex items-center justify-between text-xs">
                              <span className="text-white/80">{label}</span>
                              <span className="text-[#a78bfa] font-semibold">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="border border-white/10 p-5">
                        <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-3">By Device</p>
                        <div className="space-y-1.5">
                          {deviceBreakdown.map(([label, count]) => (
                            <div key={label} className="flex items-center justify-between text-xs">
                              <span className="text-white/80">{label}</span>
                              <span className="text-[#a78bfa] font-semibold">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Per-contact table — collapsible */}
                  <div className="border border-white/10">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-wrap gap-3">
                      <button onClick={() => setPerContactOpen(o => !o)} className="flex items-center gap-2 text-[10px] tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">
                        <span className={`inline-block transition-transform ${perContactOpen ? "rotate-90" : ""}`}>▸</span>
                        Per Contact ({batchDetail.length})
                      </button>
                      <div className="flex items-center gap-4">
                        {perContactOpen && (
                          <div className="flex items-center gap-1">
                            {([
                              { key: "status", label: "Status" },
                              { key: "alpha", label: "A–Z" },
                              { key: "time", label: "Sent Time" },
                            ] as const).map(opt => (
                              <button
                                key={opt.key}
                                onClick={() => setSortMode(opt.key)}
                                className={`text-[9px] tracking-wide uppercase px-2 py-1 border transition-colors ${sortMode === opt.key ? "border-white text-white" : "border-white/10 text-[#555] hover:text-white hover:border-white/30"}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                        <button onClick={exportCsv} className="text-[10px] tracking-wide uppercase text-[#666] hover:text-white transition-colors">
                          Export CSV
                        </button>
                      </div>
                    </div>
                    {perContactOpen && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[10px] tracking-wide uppercase text-[#555] border-b border-white/5">
                              <th className="text-left px-5 py-2 font-normal">Name</th>
                              <th className="text-left px-3 py-2 font-normal">Sent</th>
                              <th className="text-left px-3 py-2 font-normal">Clicked</th>
                              <th className="text-left px-3 py-2 font-normal">Dwell</th>
                              <th className="text-left px-3 py-2 font-normal">Registered</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {sortedDetail.map(r => (
                              <tr key={r.contactId}>
                                <td className="px-5 py-2.5" style={{ boxShadow: `inset 3px 0 0 0 ${statusColor(r)}` }}>
                                  <p className="text-white">{r.name}</p>
                                  <p className="text-[#555]">{r.email}</p>
                                </td>
                                <td className="px-3 py-2.5 text-[#888]">{fmtDate(r.sentAt)}</td>
                                <td className="px-3 py-2.5">
                                  {r.clickedAt ? (
                                    <>
                                      <p className="text-[#60a5fa]">{fmtDate(r.clickedAt)}</p>
                                      <p className="text-[#444]">{fmtElapsed(r.sentAt, r.clickedAt)} after send</p>
                                    </>
                                  ) : <span className="text-[#444]">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-[#888]">
                                  {r.dwellSeconds != null ? fmtDwell(r.dwellSeconds) : r.clickedAt ? <span className="text-[#444]">in progress</span> : <span className="text-[#444]">—</span>}
                                </td>
                                <td className="px-3 py-2.5">
                                  {r.registeredAt ? (
                                    <>
                                      <p className="text-[#4ade80]">{fmtDate(r.registeredAt)}</p>
                                      <p className="text-[#444]">{fmtElapsed(r.sentAt, r.registeredAt)} after send</p>
                                    </>
                                  ) : <span className="text-[#444]">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Stats + actions */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-2xl font-black">{contacts.length}</p>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Uninvited clients</p>
            </div>
            {doneCount > 0 && (
              <div>
                <p className="text-2xl font-black text-[#4ade80]">{doneCount}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Sent this session</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected(selected.size === contacts.length ? new Set() : new Set(contacts.map(c => c.id)))} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-4 py-2">
              {selected.size === contacts.length ? "Deselect All" : `Select All (${contacts.length})`}
            </button>
            <button
              onClick={sendInvites}
              disabled={sending || selected.size === 0}
              className="text-xs tracking-[1px] uppercase font-semibold px-6 py-2 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40"
            >
              {sending ? `Sending ${sent}/${totalSelected}...` : `Send ${totalSelected > 0 ? totalSelected : ""} Invite${totalSelected !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 border border-white/10">
            <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="border border-white/10 p-16 text-center">
            <p className="text-[#4ade80] font-semibold mb-2">All caught up!</p>
            <p className="text-xs text-[#444]">All contacts with emails already have portal accounts.</p>
          </div>
        ) : (
          <div className="border border-white/10 divide-y divide-white/5">
            {contacts.map(c => {
              const status = statuses[c.id];
              const isSelected = selected.has(c.id);
              const cooldown = cooldownDaysAgo(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (sending) return;
                    setSelected(prev => {
                      const next = new Set(prev);
                      next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                      return next;
                    });
                  }}
                  className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors ${isSelected ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"}`}
                >
                  {/* Checkbox */}
                  <div className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${
                    status === "done" ? "border-[#4ade80] bg-[#4ade80]/20" :
                    status === "error" ? "border-red-500 bg-red-500/20" :
                    status === "pending" ? "border-[#fbbf24] bg-[#fbbf24]/10" :
                    isSelected ? "border-white bg-white/10" : "border-white/20"
                  }`}>
                    {status === "done" && <span className="text-[#4ade80] text-[10px]">✓</span>}
                    {status === "error" && <span className="text-red-400 text-[10px]">✕</span>}
                    {status === "pending" && <span className="w-2 h-2 rounded-full bg-[#fbbf24] animate-pulse block" />}
                    {!status && isSelected && <span className="text-white text-[10px]">✓</span>}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-[#555]">{c.email}</p>
                  </div>

                  {/* Re-invite cooldown badge — a heads-up, not a block */}
                  {cooldown !== null && (
                    <span className="text-[9px] tracking-wide uppercase text-[#fbbf24] border border-[#fbbf24]/30 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline">
                      Invited {cooldown === 0 ? "today" : `${cooldown}d ago`}
                    </span>
                  )}

                  {/* Stage */}
                  <span className="text-[10px] tracking-wide text-[#444] hidden sm:inline">{c.stage}</span>

                  {/* Revenue */}
                  {(c.total_revenue || 0) > 0 && (
                    <span className="text-xs font-semibold text-[#4ade80] shrink-0">${(c.total_revenue || 0).toLocaleString()}</span>
                  )}

                  {/* Status label */}
                  {status && (
                    <span className={`text-[10px] tracking-wide shrink-0 ${
                      status === "done" ? "text-[#4ade80]" :
                      status === "error" ? "text-red-400" :
                      "text-[#fbbf24]"
                    }`}>
                      {status === "done" ? "Sent" : status === "error" ? "Failed" : "Sending..."}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-[#333] mt-4">Only showing contacts with emails who haven&apos;t signed up yet. Contacts already in the portal are excluded.</p>
      </div>
    </main>
  );
}
