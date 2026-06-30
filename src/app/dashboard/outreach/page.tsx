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
const PORTAL_URL = "https://luckimages-portal.vercel.app";

const BASE = `background:#0c0c0c;color:#fff;font-family:Arial,sans-serif;padding:40px;max-width:560px;margin:0 auto`;
const EYEBROW = (label: string) => `<p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;margin:0 0 32px">Luck Images${label ? ` — ${label}` : ""}</p>`;
const H1 = (text: string) => `<h1 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;margin:0 0 16px">${text}</h1>`;
const P = (text: string, style = "") => `<p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 24px${style ? `;${style}` : ""}">${text}</p>`;
const BTN = (href: string, label: string) => `<a href="${href}" style="display:inline-block;background:#fff;color:#000;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;text-decoration:none;margin-bottom:32px">${label}</a>`;
const SMALL = (text: string) => `<p style="color:#444;font-size:11px;line-height:1.6;margin:0">${text}</p>`;
const SIG = `<p style="color:#333;font-size:11px;margin:24px 0 0">— Ryan Luck, Luck Images</p>`;
const HIGHLIGHT = (text: string, color: string, rgb: string) => `<p style="color:${color};font-size:13px;font-weight:700;margin:0 0 24px;border:1px solid rgba(${rgb},0.3);padding:12px 16px;display:inline-block">${text}</p><br>`;
const wrap = (body: string) => `<!DOCTYPE html><html><body style="${BASE}">${body}</body></html>`;

const TEMPLATES: Template[] = [
  // ── ONBOARDING ──────────────────────────────────────────────────────────────
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
      const n = c.name.split(" ")[0];
      const link = extra?.portalLink || "#";
      return wrap(
        EYEBROW("Client Portal") +
        H1(`Your Portal is Ready, ${n}`) +
        P("We built a private portal where you can view your past shoot photos, track upcoming sessions, download files, and manage your account — all in one place.") +
        BTN(link, "Access Your Portal →") +
        SMALL("This link is personal to you and expires in 24 hours. If you need a new one, just reply to this email.") +
        SIG
      );
    },
  },

  // ── REVIEWS ─────────────────────────────────────────────────────────────────
  {
    id: "google_review",
    label: "Google Review Request",
    description: "Ask past clients to leave a Google review. Targets anyone who has spent money with you.",
    tag: "Reviews",
    tagColor: "text-[#fbbf24]",
    filter: c => !!c.email && (c.total_revenue || 0) > 0 && c.stage !== "deleted",
    subject: c => `Quick favor, ${c.name.split(" ")[0]}?`,
    html: c => {
      const n = c.name.split(" ")[0];
      return wrap(
        EYEBROW("") +
        H1(`A Quick Favor, ${n}`) +
        P("It was a pleasure working with you. If you were happy with the photos, would you mind leaving us a quick Google review? It takes about 60 seconds and means the world to a small business like ours.") +
        BTN(GOOGLE_REVIEW_URL, "Leave a Review →") +
        SMALL("No pressure at all — but if you have 60 seconds, we'd really appreciate it.") +
        SIG
      );
    },
  },

  // ── RELATIONSHIP ────────────────────────────────────────────────────────────
  {
    id: "thank_you",
    label: "Thank You / Follow-up",
    description: "Personal follow-up after shoot delivery. Reinforces the relationship before the next listing comes up.",
    tag: "Relationship",
    tagColor: "text-[#4ade80]",
    filter: c => !!c.email && (c.total_revenue || 0) > 0 && c.stage !== "deleted",
    subject: c => `Thank you, ${c.name.split(" ")[0]}`,
    html: c => {
      const n = c.name.split(" ")[0];
      return wrap(
        EYEBROW("") +
        H1(`Thank You, ${n}`) +
        P("It was great working with you. We hope you love the photos as much as we enjoyed shooting the property.") +
        P("If there's anything you'd like adjusted or have questions about the files, just reply to this email and we'll take care of it right away.") +
        SMALL("Looking forward to working together again on your next listing.") +
        SIG
      );
    },
  },
  {
    id: "referral_ask",
    label: "Referral Ask",
    description: "Ask happy clients to refer other agents. Includes their personal referral link so the new client is automatically attributed.",
    tag: "Referral",
    tagColor: "text-[#34d399]",
    filter: c => !!c.email && (c.total_revenue || 0) > 0 && c.stage !== "deleted",
    subject: c => `${c.name.split(" ")[0]}, know any other agents?`,
    html: c => {
      const n = c.name.split(" ")[0];
      const referralLink = `${PORTAL_URL}/register?ref=${c.id}&src=referral`;
      return wrap(
        EYEBROW("") +
        H1(`Know Any Other Agents, ${n}?`) +
        P("We've really loved working with you and we're always looking to grow with great clients like you. If you know any other agents or brokers who need photography, we'd love the intro.") +
        P("We put together a personal referral link just for you — anyone who books through it gets priority scheduling, and we'll always take extra good care of anyone you send our way.") +
        BTN(referralLink, "Share Your Referral Link →") +
        SMALL("Just forward this email or share the link. That's all it takes.") +
        SIG
      );
    },
  },
  {
    id: "portfolio_feature",
    label: "Portfolio Feature",
    description: "Let a client know their listing photos were featured in your portfolio or Instagram. Builds loyalty and gets engagement.",
    tag: "Relationship",
    tagColor: "text-[#4ade80]",
    filter: c => !!c.email && (c.total_revenue || 0) > 0 && c.stage !== "deleted",
    subject: c => `${c.name.split(" ")[0]}, we featured your listing 📸`,
    extraFields: [
      { key: "address", label: "Property address (optional)", placeholder: "e.g. 228 Avian Dr, San Marcos", default: "" },
      { key: "platform", label: "Where it was featured", placeholder: "e.g. Instagram, our portfolio website", default: "Instagram" },
      { key: "link", label: "Link to the post (optional)", placeholder: "https://instagram.com/p/...", default: "" },
    ],
    html: (c, extra) => {
      const n = c.name.split(" ")[0];
      const address = extra?.address;
      const platform = extra?.platform || "Instagram";
      const link = extra?.link;
      return wrap(
        EYEBROW("") +
        H1(`We Featured Your Listing, ${n}`) +
        P(`We loved how ${address ? `the photos from ${address}` : "your listing photos"} turned out — so much that we featured them on our ${platform}.`) +
        (link ? BTN(link, `See it on ${platform} →`) : "") +
        P("Thank you for letting us capture it. These are the kinds of shoots we love to show off.") +
        SMALL("If you ever want us to tag you or your brokerage in a future post, just let us know.") +
        SIG
      );
    },
  },

  // ── PORTFOLIO FOLLOW-UP ─────────────────────────────────────────────────────
  {
    id: "portfolio_followup",
    label: "Portfolio Follow-up",
    description: "Send a curated selection of their shoot photos with a note. Reminds clients how great the work looked and opens the door for the next booking.",
    tag: "Relationship",
    tagColor: "text-[#4ade80]",
    filter: c => !!c.email && (c.total_revenue || 0) > 0 && c.stage !== "deleted",
    subject: c => `${c.name.split(" ")[0]}, a look back at your listing photos`,
    extraFields: [
      { key: "address", label: "Property address", placeholder: "e.g. 228 Avian Dr, San Marcos", default: "" },
      { key: "galleryLink", label: "Gallery / delivery link", placeholder: "https://...", default: "" },
      { key: "highlight", label: "Standout detail (optional)", placeholder: "e.g. The twilight shots turned out especially well", default: "" },
    ],
    html: (c, extra) => {
      const n = c.name.split(" ")[0];
      const address = extra?.address;
      const galleryLink = extra?.galleryLink;
      const highlight = extra?.highlight;
      return wrap(
        EYEBROW("Portfolio") +
        H1(`A Look Back, ${n}`) +
        P(`We were going through our recent work and ${address ? `the photos from ${address}` : "your listing photos"} really stood out. We're proud of how they came together.`) +
        (highlight ? P(highlight, "color:#4ade80;font-weight:700") : "") +
        P("Your photos are part of the portfolio we show potential clients — which is a testament to how well the shoot went. We wanted to make sure you had easy access to the full gallery.") +
        (galleryLink ? BTN(galleryLink, "View Your Gallery →") : "") +
        P("If you have another listing coming up, we'd love to do it again. Just reply and we'll get something on the calendar.") +
        SIG
      );
    },
  },

  // ── RETENTION ───────────────────────────────────────────────────────────────
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
      const n = c.name.split(" ")[0];
      const promo = extra?.promo;
      return wrap(
        EYEBROW("") +
        H1(`Hey ${n}, It's Been a While`) +
        P("We wanted to reach out and say hello. We've loved working with you in the past and would love the chance to shoot your next listing.") +
        (promo ? HIGHLIGHT(promo, "#a78bfa", "167,139,250") : "") +
        BTN("mailto:ryan@luckimages.com", "Book a Shoot →") +
        SMALL("Reply to this email or click above to get started. We'll make it easy.") +
        SIG
      );
    },
  },
  {
    id: "lapsed_winback",
    label: "Lapsed Win-back",
    description: "Stronger re-engagement for clients who haven't booked in 12+ months. Acknowledges the gap and makes it easy to restart.",
    tag: "Retention",
    tagColor: "text-[#60a5fa]",
    filter: c => !!c.email && (c.total_revenue || 0) > 0 && c.stage !== "deleted",
    subject: c => `Still working in real estate, ${c.name.split(" ")[0]}?`,
    extraFields: [
      { key: "offer", label: "Incentive (optional)", placeholder: "e.g. First shoot back — $25 off", default: "" },
    ],
    html: (c, extra) => {
      const n = c.name.split(" ")[0];
      const offer = extra?.offer;
      return wrap(
        EYEBROW("") +
        H1(`Still Selling, ${n}?`) +
        P("We noticed it's been a while since we last worked together — and we just wanted to check in. We've made a lot of improvements to our editing, turnaround times, and services since then.") +
        P("If you have an upcoming listing, we'd love to get back on your radar. We'll treat you like the returning client you are.") +
        (offer ? HIGHLIGHT(offer, "#60a5fa", "96,165,250") : "") +
        BTN("mailto:ryan@luckimages.com", "Let's Work Together Again →") +
        SMALL("No pressure — just wanted to stay in touch and make sure you know we're here.") +
        SIG
      );
    },
  },

  // ── UPSELL ──────────────────────────────────────────────────────────────────
  {
    id: "upsell",
    label: "Upsell / Cross-sell",
    description: "Target clients who've only booked basic photos and introduce them to drone, video, or twilight add-ons.",
    tag: "Upsell",
    tagColor: "text-[#fb923c]",
    filter: c => !!c.email && (c.total_revenue || 0) > 0 && c.stage !== "deleted",
    subject: c => `${c.name.split(" ")[0]}, have you tried our drone footage?`,
    extraFields: [
      { key: "service", label: "Service to highlight", placeholder: "e.g. Aerial Drone, Twilight Shoot, Video Tour", default: "Aerial Drone" },
      { key: "hook", label: "Why it sells listings faster (optional)", placeholder: "e.g. Listings with drone sell 20% faster on average", default: "" },
    ],
    html: (c, extra) => {
      const n = c.name.split(" ")[0];
      const service = extra?.service || "Aerial Drone";
      const hook = extra?.hook;
      return wrap(
        EYEBROW("") +
        H1(`Have You Tried ${service}, ${n}?`) +
        P(`We've been doing ${service} for a while now and it consistently helps listings stand out in a crowded market.`) +
        (hook ? P(hook, "color:#fb923c;font-weight:700") : "") +
        P("We'd love to add it to your next shoot — it's easy to add on and the results speak for themselves. Reply to this email and we'll walk you through pricing.") +
        BTN("mailto:ryan@luckimages.com", `Add ${service} to My Next Shoot →`) +
        SIG
      );
    },
  },

  // ── PRE-SHOOT ───────────────────────────────────────────────────────────────
  {
    id: "preshoot_checklist",
    label: "Pre-shoot Checklist",
    description: "Day-before reminder with staging tips. Reduces surprises on shoot day and makes you look polished and professional.",
    tag: "Operations",
    tagColor: "text-[#888]",
    filter: c => !!c.email && c.stage !== "deleted",
    subject: c => `${c.name.split(" ")[0]}, your shoot is tomorrow — quick checklist`,
    extraFields: [
      { key: "address", label: "Property address", placeholder: "e.g. 228 Avian Dr, San Marcos", default: "" },
      { key: "time", label: "Shoot time", placeholder: "e.g. 10:00 AM", default: "" },
    ],
    html: (c, extra) => {
      const n = c.name.split(" ")[0];
      const address = extra?.address;
      const time = extra?.time;
      return wrap(
        EYEBROW("Shoot Prep") +
        H1(`See You Tomorrow, ${n}`) +
        (address || time ? `<p style="color:#555;font-size:12px;margin:0 0 24px">${[address, time].filter(Boolean).join(" · ")}</p>` : "") +
        P("To make sure we get the best possible photos, here's a quick checklist to run through before we arrive:") +
        `<ul style="color:#888;font-size:13px;line-height:1.8;margin:0 0 24px;padding-left:20px">
<li>Turn on all lights — every lamp, overhead, and under-cabinet</li>
<li>Clear countertops in the kitchen and bathrooms</li>
<li>Remove personal photos, clutter, and anything you wouldn't want in the listing</li>
<li>Ensure the lawn/exterior is tidy (mow if needed, cars out of the driveway)</li>
<li>Make all beds and fluff pillows</li>
<li>Close toilet lids</li>
<li>Remove trash cans from visible areas</li>
</ul>` +
        P("These small steps make a big difference in the final photos. We'll take care of the rest.") +
        SMALL("Reply to this email with any questions or if anything changes. See you tomorrow!") +
        SIG
      );
    },
  },

  // ── PROMO ───────────────────────────────────────────────────────────────────
  {
    id: "seasonal",
    label: "Seasonal Promo",
    description: "Blast to all active clients for listing season, holidays, or any time-sensitive offer.",
    tag: "Promo",
    tagColor: "text-[#f472b6]",
    filter: c => !!c.email && c.stage !== "deleted" && c.stage !== "lead",
    subject: c => `Listing season is here, ${c.name.split(" ")[0]} — book your shoot`,
    extraFields: [
      { key: "season", label: "Season / occasion", placeholder: "e.g. Spring Listing Season", default: "Spring Listing Season" },
      { key: "offer", label: "Offer or hook", placeholder: "e.g. Book before April 30 and save $50", default: "" },
    ],
    html: (c, extra) => {
      const n = c.name.split(" ")[0];
      const season = extra?.season || "Listing Season";
      const offer = extra?.offer;
      return wrap(
        EYEBROW("") +
        H1(`${season} is Here, ${n}`) +
        P("The market is moving and listings need to look their best. We're booking shoots now — let's make your next property stand out.") +
        (offer ? HIGHLIGHT(offer, "#f472b6", "244,114,182") : "") +
        BTN("mailto:ryan@luckimages.com", "Book a Shoot →") +
        SIG
      );
    },
  },
  {
    id: "new_service",
    label: "New Service Launch",
    description: "Announce a new service to your existing client base. Great when adding drone, Matterport, video tours, twilight, etc.",
    tag: "Promo",
    tagColor: "text-[#f472b6]",
    filter: c => !!c.email && c.stage !== "deleted" && c.stage !== "lead",
    subject: c => `${c.name.split(" ")[0]}, we just launched something new`,
    extraFields: [
      { key: "service", label: "New service name", placeholder: "e.g. 3D Matterport Tours", default: "" },
      { key: "pitch", label: "One-line pitch", placeholder: "e.g. Walk buyers through the property before they ever visit", default: "" },
      { key: "offer", label: "Launch offer (optional)", placeholder: "e.g. First 10 bookings get 20% off", default: "" },
    ],
    html: (c, extra) => {
      const n = c.name.split(" ")[0];
      const service = extra?.service || "a new service";
      const pitch = extra?.pitch;
      const offer = extra?.offer;
      return wrap(
        EYEBROW("New") +
        H1(`We Just Launched ${service}, ${n}`) +
        (pitch ? P(pitch, "color:#f472b6;font-weight:700") : "") +
        P("We've been working on this for a while and we think it's going to make a real difference for your listings. As one of our existing clients, you're the first to hear about it.") +
        (offer ? HIGHLIGHT(offer, "#f472b6", "244,114,182") : "") +
        BTN("mailto:ryan@luckimages.com", `Add ${service} to My Next Shoot →`) +
        SMALL("Reply with any questions — we're happy to walk you through exactly what it includes.") +
        SIG
      );
    },
  },
];

const EXAMPLE_CONTACT: Contact = {
  id: "example",
  name: "Sarah Johnson",
  email: "sarah@example.com",
  stage: "active",
  total_revenue: 2400,
  user_id: null,
  created_at: new Date(Date.now() - 90 * 24 * 3600000).toISOString(),
  lead_source: "referral",
};

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
  const [mode, setMode] = useState<"campaign" | "quicksend">("campaign");
  const [qs, setQs] = useState({ to: "", name: "", subject: "", body: "" });
  const [qsStatus, setQsStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  useEffect(() => {
    // Read deep-link params
    const params = new URLSearchParams(window.location.search);
    const tmpl = params.get("template");
    const contactParam = params.get("contact");
    if (tmpl) {
      const found = TEMPLATES.find(t => t.id === tmpl);
      if (found) selectTemplate(found);
    }

    async function load() {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, email, stage, total_revenue, user_id, created_at, lead_source")
        .neq("stage", "deleted")
        .order("total_revenue", { ascending: false, nullsFirst: false });
      const list = data || [];
      setContacts(list);
      setLoading(false);
      // Pre-select contact from deep link
      if (contactParam) {
        const c = list.find(x => x.id === contactParam);
        if (c) { setSelected(new Set([c.id])); setPreviewContact(c); }
      }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const preview = previewContact || filtered[0] || EXAMPLE_CONTACT;

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

  async function sendQuick() {
    if (!qs.to || !qs.subject || !qs.body || qsStatus === "sending") return;
    setQsStatus("sending");
    const html = wrap(
      EYEBROW("") +
      H1(qs.subject) +
      qs.body.split("\n\n").map(para => P(para)).join("") +
      SIG
    );
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: qs.to, subject: qs.subject, html }),
      });
      setQsStatus(res.ok ? "done" : "error");
    } catch {
      setQsStatus("error");
    }
  }

  return (
    <main className="min-h-screen w-full bg-[#0c0c0c] text-white flex flex-col">
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

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-4 md:px-8 pt-8 pb-4 shrink-0 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-1">Beta</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">Email Outreach</h1>
            <p className="text-sm text-[#555] mt-1">Select a campaign, pick your contacts, preview, and send.</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setMode("campaign")}
              className={`text-[10px] tracking-[2px] uppercase px-4 py-2 border transition-colors ${mode === "campaign" ? "border-white text-white bg-white/10" : "border-white/20 text-[#555] hover:text-white hover:border-white/40"}`}
            >Campaign</button>
            <button
              onClick={() => { setMode("quicksend"); setQsStatus("idle"); }}
              className={`text-[10px] tracking-[2px] uppercase px-4 py-2 border transition-colors ${mode === "quicksend" ? "border-white text-white bg-white/10" : "border-white/20 text-[#555] hover:text-white hover:border-white/40"}`}
            >Quick Send</button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[260px_1fr_360px] overflow-hidden">

          {/* LEFT — Template picker + config */}
          <div className="border-r border-white/10 flex flex-col overflow-y-auto">
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

          {/* MIDDLE — Contact list (campaign) or Quick Send compose */}
          {mode === "quicksend" ? (
            <div className="flex flex-col border-r border-white/10 overflow-hidden min-w-0">
              <div className="px-4 py-3 border-b border-white/10 shrink-0">
                <p className="text-[10px] tracking-[3px] uppercase text-[#555]">Quick Send — One-off Email</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="text-[10px] text-[#444] block mb-1 tracking-[1px] uppercase">To (email)</label>
                  <input
                    type="email"
                    value={qs.to}
                    onChange={e => setQs(q => ({ ...q, to: e.target.value }))}
                    placeholder="client@example.com"
                    className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#444] block mb-1 tracking-[1px] uppercase">Name (for preview)</label>
                  <input
                    type="text"
                    value={qs.name}
                    onChange={e => setQs(q => ({ ...q, name: e.target.value }))}
                    placeholder="First Last"
                    className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#444] block mb-1 tracking-[1px] uppercase">Subject</label>
                  <input
                    type="text"
                    value={qs.subject}
                    onChange={e => setQs(q => ({ ...q, subject: e.target.value }))}
                    placeholder="Hey Sarah, quick note..."
                    className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#444] block mb-1 tracking-[1px] uppercase">Message body</label>
                  <p className="text-[10px] text-[#333] mb-2">Separate paragraphs with a blank line. Will be styled in Luck Images brand email format.</p>
                  <textarea
                    value={qs.body}
                    onChange={e => setQs(q => ({ ...q, body: e.target.value }))}
                    rows={10}
                    placeholder={"Hey Sarah,\n\nJust wanted to follow up on your last shoot...\n\nLet me know if you have any upcoming listings."}
                    className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20 resize-none leading-relaxed"
                  />
                </div>
                <button
                  onClick={sendQuick}
                  disabled={!qs.to || !qs.subject || !qs.body || qsStatus === "sending" || qsStatus === "done"}
                  className="w-full text-xs tracking-[2px] uppercase font-semibold py-3 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40"
                >
                  {qsStatus === "sending" ? "Sending..." : qsStatus === "done" ? "✓ Sent" : qsStatus === "error" ? "Error — Retry" : "Send Email →"}
                </button>
                {qsStatus === "done" && (
                  <button onClick={() => { setQs({ to: "", name: "", subject: "", body: "" }); setQsStatus("idle"); }} className="w-full text-[10px] tracking-[1px] uppercase text-[#555] hover:text-white transition-colors py-2">
                    Send another
                  </button>
                )}
              </div>
            </div>
          ) : (
          <div className="flex flex-col border-r border-white/10 overflow-hidden min-w-0">
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
          )} {/* end mode === "campaign" */}

          {/* RIGHT — Live email preview */}
          <div className="flex flex-col overflow-hidden border-t md:border-t-0 border-white/10">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
              <p className="text-[10px] tracking-[3px] uppercase text-[#555]">Email Preview</p>
              {mode === "quicksend" && qs.name && (
                <p className="text-[10px] text-[#333]">→ {qs.name.split(" ")[0]}</p>
              )}
              {mode === "campaign" && preview && (
                <p className="text-[10px] text-[#333]">
                  {preview.id === "example" ? "example — Sarah Johnson" : `→ ${preview.name.split(" ")[0]}`}
                </p>
              )}
            </div>
            {mode === "quicksend" ? (
              <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
                {qs.subject && (
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-[10px] text-[#444] mb-0.5">Subject</p>
                    <p className="text-xs text-white font-medium">{qs.subject}</p>
                  </div>
                )}
                {qs.body ? (
                  <div
                    className="p-0"
                    dangerouslySetInnerHTML={{
                      __html: wrap(EYEBROW("") + H1(qs.subject || "Your message") + qs.body.split("\n\n").map(para => P(para)).join("") + SIG)
                    }}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <p className="text-xs text-[#333] italic">Start typing to see a live preview</p>
                  </div>
                )}
              </div>
            ) : preview ? (
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
