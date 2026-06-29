"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

type Contact = {
  id: string;
  name: string;
  email: string | null;
  stage: string;
  total_revenue: number | null;
  user_id: string | null;
  created_at: string;
  lead_source: string | null;
};

type SendStatus = "idle" | "pending" | "done" | "error";

type Template = {
  id: string;
  label: string;
  description: string;
  tag: string;
  tagColor: string;
  filter: (c: Contact) => boolean;
  subject: (c: Contact) => string;
  html: (c: Contact, extra?: Record<string, string>) => string;
  extraFields?: { key: string; label: string; placeholder: string; default?: string }[];
  requiresPortalLink?: boolean;
};

const GOOGLE_REVIEW_URL = "https://g.page/r/CdYourReviewLink/review"; // TODO: replace with real URL

const TEMPLATES: Template[] = [
  {
    id: "portal_invite",
    label: "Portal Invite",
    description: "Invite past clients to their private portal. Sends a personalized magic link valid for 24h. Only targets clients without a portal account.",
    tag: "Onboarding",
    tagColor: "text-[#a78bfa]",
    filter: c => !!c.email && !c.user_id && c.stage !== "deleted" && c.stage !== "lead",
    subject: c => `Your Luck Images client portal is ready, ${c.name.split(" ")[0]}`,
    requiresPortalLink: true,
    html: (c, extra) => {
      const firstName = c.name.split(" ")[0];
      const link = extra?.portalLink || "#";
      return `<!DOCTYPE html><html><body style="background:#0c0c0c;color:#fff;font-family:Arial,sans-serif;padding:40px;max-width:560px;margin:0 auto">
<p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;margin:0 0 32px">Luck Images — Client Portal</p>
<h1 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;margin:0 0 16px">Your Portal is Ready, ${firstName}</h1>
<p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 32px">We built a private portal where you can view your past shoot photos, track upcoming sessions, download files, and manage your account — all in one place.</p>
<a href="${link}" style="display:inline-block;background:#fff;color:#000;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;text-decoration:none;margin-bottom:32px">Access Your Portal →</a>
<p style="color:#444;font-size:11px;line-height:1.6;margin:0">This link is personal to you and expires in 24 hours. If you need a new one, just reply to this email.</p>
<p style="color:#333;font-size:11px;margin:24px 0 0">— Ryan Luck, Luck Images</p>
</body></html>`;
    },
  },
  {
    id: "google_review",
    label: "Google Review Request",
    description: "Ask delivered clients to leave a Google review. Only targets clients who've had a completed or delivered shoot.",
    tag: "Reviews",
    tagColor: "text-[#fbbf24]",
    filter: c => !!c.email && (c.total_revenue || 0) > 0 && c.stage !== "deleted",
    subject: c => `Quick favor, ${c.name.split(" ")[0]}?`,
    html: c => {
      const firstName = c.name.split(" ")[0];
      return `<!DOCTYPE html><html><body style="background:#0c0c0c;color:#fff;font-family:Arial,sans-serif;padding:40px;max-width:560px;margin:0 auto">
<p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;margin:0 0 32px">Luck Images</p>
<h1 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;margin:0 0 16px">A Quick Favor, ${firstName}</h1>
<p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 24px">It was a pleasure working with you. If you were happy with the photos, would you mind leaving us a quick Google review? It takes about 60 seconds and means the world to a small business like ours.</p>
<a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;background:#fff;color:#000;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;text-decoration:none;margin-bottom:32px">Leave a Review →</a>
<p style="color:#444;font-size:11px;line-height:1.6;margin:0">No pressure at all — but if you have 60 seconds, we'd really appreciate it.</p>
<p style="color:#333;font-size:11px;margin:24px 0 0">— Ryan Luck, Luck Images</p>
</body></html>`;
    },
  },
  {
    id: "reengagement",
    label: "Re-engagement",
    description: "Reconnect with past clients who haven't booked in a while. Great for listing season or slow periods.",
    tag: "Retention",
    tagColor: "text-[#60a5fa]",
    filter: c => !!c.email && (c.total_revenue || 0) > 0 && c.stage !== "deleted",
    subject: c => `Hey ${c.name.split(" ")[0]}, we'd love to work with you again`,
    extraFields: [
      { key: "promo", label: "Promo line (optional)", placeholder: "e.g. 10% off your next shoot through July", default: "" },
    ],
    html: (c, extra) => {
      const firstName = c.name.split(" ")[0];
      const promo = extra?.promo;
      return `<!DOCTYPE html><html><body style="background:#0c0c0c;color:#fff;font-family:Arial,sans-serif;padding:40px;max-width:560px;margin:0 auto">
<p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;margin:0 0 32px">Luck Images</p>
<h1 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;margin:0 0 16px">Hey ${firstName}, It's Been a While</h1>
<p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 24px">We wanted to reach out and say hello. We've loved working with you in the past and would love the chance to shoot your next listing.</p>
${promo ? `<p style="color:#a78bfa;font-size:13px;font-weight:700;margin:0 0 24px;border:1px solid rgba(167,139,250,0.3);padding:12px 16px;display:inline-block">${promo}</p><br>` : ""}
<a href="mailto:ryan@luckimages.com" style="display:inline-block;background:#fff;color:#000;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;text-decoration:none;margin-bottom:32px">Book a Shoot →</a>
<p style="color:#444;font-size:11px;line-height:1.6;margin:0">Reply to this email or click above to get started. We'll make it easy.</p>
<p style="color:#333;font-size:11px;margin:24px 0 0">— Ryan Luck, Luck Images</p>
</body></html>`;
    },
  },
  {
    id: "thank_you",
    label: "Thank You / Follow-up",
    description: "Personal follow-up after shoot delivery. Build the relationship before the next listing.",
    tag: "Relationship",
    tagColor: "text-[#4ade80]",
    filter: c => !!c.email && (c.total_revenue || 0) > 0 && c.stage !== "deleted",
    subject: c => `Thank you, ${c.name.split(" ")[0]} — your photos are ready`,
    html: c => {
      const firstName = c.name.split(" ")[0];
      return `<!DOCTYPE html><html><body style="background:#0c0c0c;color:#fff;font-family:Arial,sans-serif;padding:40px;max-width:560px;margin:0 auto">
<p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;margin:0 0 32px">Luck Images</p>
<h1 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;margin:0 0 16px">Thank You, ${firstName}</h1>
<p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 24px">It was great working with you. Your photos have been delivered — we hope you love them as much as we do.</p>
<p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 32px">If there's anything you'd like adjusted or if you have questions about the files, just reply to this email and we'll take care of it right away.</p>
<p style="color:#555;font-size:12px;line-height:1.6;margin:0">Looking forward to working together again on your next listing.</p>
<p style="color:#333;font-size:11px;margin:24px 0 0">— Ryan Luck, Luck Images</p>
</body></html>`;
    },
  },
  {
    id: "seasonal",
    label: "Seasonal Promo",
    description: "Blast to all active clients for listing season, holidays, or any time-sensitive offer.",
    tag: "Promo",
    tagColor: "text-[#f472b6]",
    filter: c => !!c.email && c.stage !== "deleted" && c.stage !== "lead",
    subject: () => "Listing season is here — book your shoot",
    extraFields: [
      { key: "season", label: "Season / occasion", placeholder: "e.g. Spring Listing Season", default: "Spring Listing Season" },
      { key: "offer", label: "Offer or hook", placeholder: "e.g. Book before April 30 and save $50", default: "" },
    ],
    html: (c, extra) => {
      const firstName = c.name.split(" ")[0];
      const season = extra?.season || "Listing Season";
      const offer = extra?.offer;
      return `<!DOCTYPE html><html><body style="background:#0c0c0c;color:#fff;font-family:Arial,sans-serif;padding:40px;max-width:560px;margin:0 auto">
<p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;margin:0 0 32px">Luck Images</p>
<h1 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;margin:0 0 16px">${season} is Here, ${firstName}</h1>
<p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 24px">The market is moving and listings need to look their best. We're booking shoots now — let's make your next property stand out.</p>
${offer ? `<p style="color:#f472b6;font-size:13px;font-weight:700;margin:0 0 24px;border:1px solid rgba(244,114,182,0.3);padding:12px 16px;display:inline-block">${offer}</p><br>` : ""}
<a href="mailto:ryan@luckimages.com" style="display:inline-block;background:#fff;color:#000;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;text-decoration:none;margin-bottom:32px">Book a Shoot →</a>
<p style="color:#333;font-size:11px;margin:24px 0 0">— Ryan Luck, Luck Images</p>
</body></html>`;
    },
  },
];

export default function OutreachPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState<Template>(TEMPLATES[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, SendStatus>>({});
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const [previewContact, setPreviewContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, email, stage, total_revenue, user_id, created_at, lead_source")
        .neq("stage", "deleted")
        .order("total_revenue", { ascending: false, nullsFirst: false });
      setContacts(data || []);
      setLoading(false);
    }
    load();
  }, []);

  // When template changes, reset selection + extra fields
  function selectTemplate(t: Template) {
    setActiveTemplate(t);
    setSelected(new Set());
    setStatuses({});
    setSentCount(0);
    setExtraFields(
      Object.fromEntries((t.extraFields || []).map(f => [f.key, f.default || ""]))
    );
  }

  const eligible = contacts.filter(c => activeTemplate.filter(c));
  const filtered = eligible.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.id)));
  }

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const preview = previewContact || filtered[0] || null;

  async function sendAll() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setSentCount(0);

    const toSend = contacts.filter(c => selected.has(c.id));

    for (const contact of toSend) {
      setStatuses(s => ({ ...s, [contact.id]: "pending" }));
      try {
        let portalLink: string | undefined;
        if (activeTemplate.requiresPortalLink) {
          const res = await fetch("/api/admin/invite-client", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: contact.email, name: contact.name }),
          });
          const data = await res.json();
          if (!data.link) throw new Error("No magic link");
          portalLink = data.link;
        }

        const html = activeTemplate.html(contact, { ...extraFields, portalLink: portalLink || "" });
        const subject = activeTemplate.subject(contact);

        const res = await fetch("/api/admin/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: contact.id, to: contact.email, subject, html }),
        });

        if (!res.ok) throw new Error("Send failed");
        setStatuses(s => ({ ...s, [contact.id]: "done" }));
        setSentCount(n => n + 1);
      } catch {
        setStatuses(s => ({ ...s, [contact.id]: "error" }));
      }
      await new Promise(r => setTimeout(r, 300));
    }

    setSending(false);
  }

  const doneCount = Object.values(statuses).filter(s => s === "done").length;
  const errorCount = Object.values(statuses).filter(s => s === "error").length;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10 gap-4">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <a href="/dashboard/beta" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Beta</a>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Dashboard</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-4 md:px-8 pt-8 pb-4 shrink-0">
          <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-1">Beta</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">Email Outreach</h1>
          <p className="text-sm text-[#555] mt-1">Select a campaign, pick your contacts, preview, and send.</p>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden gap-0">

          {/* LEFT — Template picker + config */}
          <div className="md:w-72 lg:w-80 border-r border-white/10 flex flex-col overflow-y-auto shrink-0">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-[10px] tracking-[3px] uppercase text-[#555]">Campaign Templates</p>
            </div>
            <div className="flex flex-col divide-y divide-white/5">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`text-left px-4 py-4 transition-colors hover:bg-white/[0.02] ${activeTemplate.id === t.id ? "bg-white/[0.04]" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] tracking-[1.5px] uppercase font-semibold ${t.tagColor}`}>{t.tag}</span>
                    {activeTemplate.id === t.id && <span className="text-[10px] text-[#444]">●</span>}
                  </div>
                  <p className="text-sm font-bold text-white">{t.label}</p>
                  <p className="text-[11px] text-[#555] mt-1 leading-snug">{t.description}</p>
                </button>
              ))}
            </div>

            {/* Extra fields */}
            {activeTemplate.extraFields && activeTemplate.extraFields.length > 0 && (
              <div className="border-t border-white/10 px-4 py-4 space-y-3">
                <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Customize</p>
                {activeTemplate.extraFields.map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-[#444] block mb-1">{f.label}</label>
                    <input
                      type="text"
                      value={extraFields[f.key] || ""}
                      onChange={e => setExtraFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MIDDLE — Contact list */}
          <div className="flex-1 flex flex-col border-r border-white/10 overflow-hidden min-w-0">
            {/* List header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3 shrink-0">
              <div className="flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[#333]"
                />
              </div>
              <span className="text-[10px] text-[#444] shrink-0">{eligible.length} eligible</span>
              <button
                onClick={toggleAll}
                className="text-[10px] tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-2 py-1 shrink-0"
              >
                {selected.size === filtered.length && filtered.length > 0 ? "Deselect all" : `Select all (${filtered.length})`}
              </button>
            </div>

            {/* Send bar */}
            {selected.size > 0 && (
              <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-semibold">{selected.size} selected</span>
                  {doneCount > 0 && <span className="text-[#4ade80]">{doneCount} sent</span>}
                  {errorCount > 0 && <span className="text-red-400">{errorCount} failed</span>}
                </div>
                <button
                  onClick={sendAll}
                  disabled={sending}
                  className="text-xs tracking-[1px] uppercase font-semibold px-5 py-2 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40"
                >
                  {sending ? `Sending ${sentCount}/${selected.size}...` : `Send ${selected.size} Email${selected.size !== 1 ? "s" : ""} →`}
                </button>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {loading && <p className="text-xs text-[#444] italic p-4">Loading contacts...</p>}
              {!loading && filtered.length === 0 && (
                <p className="text-xs text-[#333] italic p-4">No contacts match this template&apos;s criteria.</p>
              )}
              {filtered.map(c => {
                const status = statuses[c.id];
                const isSelected = selected.has(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => { if (!sending) toggle(c.id); }}
                    onMouseEnter={() => setPreviewContact(c)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
                  >
                    {/* Checkbox */}
                    <div className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${
                      status === "done"    ? "border-[#4ade80] bg-[#4ade80]/20" :
                      status === "error"   ? "border-red-500 bg-red-500/20" :
                      status === "pending" ? "border-[#fbbf24] bg-[#fbbf24]/10" :
                      isSelected ? "border-white bg-white/10" : "border-white/20"
                    }`}>
                      {status === "done"    && <span className="text-[#4ade80] text-[9px]">✓</span>}
                      {status === "error"   && <span className="text-red-400 text-[9px]">✕</span>}
                      {status === "pending" && <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-pulse block" />}
                      {!status && isSelected && <span className="text-white text-[9px]">✓</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.name}</p>
                      <p className="text-[10px] text-[#444] truncate">{c.email}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(c.total_revenue || 0) > 0 && (
                        <span className="text-[10px] text-[#4ade80]">${(c.total_revenue || 0).toLocaleString()}</span>
                      )}
                      {status && (
                        <span className={`text-[9px] tracking-wide ${
                          status === "done" ? "text-[#4ade80]" : status === "error" ? "text-red-400" : "text-[#fbbf24]"
                        }`}>
                          {status === "done" ? "Sent" : status === "error" ? "Failed" : "Sending..."}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — Live email preview */}
          <div className="md:w-96 lg:w-[480px] flex flex-col overflow-hidden shrink-0 border-t md:border-t-0 border-white/10">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
              <p className="text-[10px] tracking-[3px] uppercase text-[#555]">Email Preview</p>
              {preview && <p className="text-[10px] text-[#333]">→ {preview.name.split(" ")[0]}</p>}
            </div>
            {preview ? (
              <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
                {/* Subject line */}
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-[10px] text-[#444] mb-0.5">Subject</p>
                  <p className="text-xs text-white font-medium">{activeTemplate.subject(preview)}</p>
                </div>
                {/* HTML render */}
                <div
                  className="p-0"
                  dangerouslySetInnerHTML={{
                    __html: activeTemplate.html(preview, { ...extraFields, portalLink: "https://luckimages-portal.vercel.app/dashboard" })
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-[#333] italic">No contacts to preview</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
