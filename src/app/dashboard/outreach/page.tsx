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
  registered_at: string | null;
};

type SendStatus = "idle" | "pending" | "done" | "error";

type QuickBlock =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "button"; label: string; url: string };

type EmailLogRow = { contact_id: string | null; subject: string | null; sent_at: string | null; category: string | null };
type LinkClickRow = { contact_id: string | null; service: string; clicked_at: string };

type Mode = "campaign" | "quicksend" | "engagement";
const MODES: Mode[] = ["campaign", "quicksend", "engagement"];

// Pretty labels for the service keys stored in link_clicks
const CLICK_LABEL: Record<string, string> = {
  photo: "Listing Photos", "listing-photos": "Listing Photos",
  drone: "Drone", matterport: "Matterport", twilight: "Twilight",
  "virtual-staging": "Virtual Staging", video: "Video",
  floorplan: "Floor Plan", floorplans: "Floor Plan", brochures: "Brochures",
  pricing: "Pricing", home: "Our Work",
};

// Label for an email's format: use the stored category, else guess from
// the subject (covers rows sent before the category column existed).
function emailFormatLabel(row: { category: string | null; subject: string | null }): string {
  if (row.category) return row.category;
  const s = (row.subject || "").toLowerCase();
  if (s.includes("portal is ready") || s.includes("portal access")) return "Portal Invite";
  if (s.includes("review")) return "Review Request";
  if (s.includes("referral") || s.includes("other agents")) return "Referral Ask";
  if (s.includes("real estate photography") || s.includes("drone re") || s.includes("pricing")) return "Cold Call Follow-up";
  return "Email";
}

// Pipeline stage → friendly label + color for the engagement status pill
const STAGE_PILL: Record<string, { label: string; color: string }> = {
  lead: { label: "Lead", color: "#4ade80" },
  client: { label: "Client", color: "#34d399" },
  registered: { label: "Registered", color: "#34d399" },
  "follow-up": { label: "Follow-up", color: "#fbbf24" },
  nurture: { label: "Nurture", color: "#fb923c" },
  active: { label: "Active", color: "#60a5fa" },
  dead: { label: "Dead", color: "#f87171" },
};

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
const PORTAL_URL = "https://www.luckimages.com";

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
    filter: c => !!c.email && c.stage !== "deleted",
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
    filter: c => !!c.email && c.stage !== "deleted",
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
    filter: c => !!c.email && c.stage !== "deleted",
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
    filter: c => !!c.email && c.stage !== "deleted",
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
    filter: c => !!c.email && c.stage !== "deleted",
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
    filter: c => !!c.email && c.stage !== "deleted",
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
    filter: c => !!c.email && c.stage !== "deleted",
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
    filter: c => !!c.email && c.stage !== "deleted",
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
    filter: c => !!c.email && c.stage !== "deleted",
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
    filter: c => !!c.email && c.stage !== "deleted",
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
  // ── COLD LEAD PITCH ─────────────────────────────────────────────────────────
  {
    id: "cold_pitch",
    label: "Services & Pricing Pitch",
    description: "Send the full pricing + portfolio email to a cold lead. Same email as the cold-call follow-up — personalized with their name, selected services, quote, and a portal register link.",
    tag: "Lead",
    tagColor: "text-[#a78bfa]",
    filter: c => !!c.email && c.stage !== "deleted",
    subject: c => `Real Estate Photography — Luck Images`,
    extraFields: [
      { key: "services", label: "Services to pitch", placeholder: "all — or: photos, drone, video, matterport, twilight, virtual-staging, floorplan", default: "all" },
      { key: "quote", label: "Quote to include (optional)", placeholder: "e.g. 350", default: "" },
    ],
    html: (c, extra) => {
      const firstName = c.name.split(" ")[0];
      const contactId = c.id;
      const TRACK_BASE = "https://www.luckimages.com/api/track-link";
      const track = (service: string) => `${TRACK_BASE}?service=${service}&contact=${contactId}`;
      const quoteAmount = extra?.quote || "";

      const ALL_PITCH_SERVICES = [
        { key: "photo",           label: "Listing Photos",      price: "from $200" },
        { key: "drone",           label: "Drone Photos",        price: "$200" },
        { key: "matterport",      label: "Matterport 3D Tour",  price: "from $200" },
        { key: "twilight",        label: "Twilight Photography", price: "$250" },
        { key: "virtual-staging", label: "Virtual Staging",     price: "$25 / photo" },
        { key: "video",           label: "Video Walkthrough",   price: "from $200" },
        { key: "floorplan",       label: "Floor Plan",          price: "from $50" },
      ];

      const inputKeys = (extra?.services || "all").toLowerCase().split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      const isAll = inputKeys.includes("all") || inputKeys.length === 0;
      const services = isAll ? ALL_PITCH_SERVICES : ALL_PITCH_SERVICES.filter(s => inputKeys.some(k => s.key.includes(k) || s.label.toLowerCase().includes(k)));
      const isSingle = services.length === 1;

      const introText = isAll
        ? `Hey ${firstName}, thanks for taking the time to chat. Below you can find a list of all of our services &amp; pricing — click on each to view the portfolio. Look forward to working together!`
        : isSingle
          ? `Hey ${firstName}, thanks for taking the time to chat. Here's a closer look at our ${services[0].label.toLowerCase()} — pricing and a link to the portfolio below.`
          : `Hey ${firstName}, thanks for taking the time to chat. Here's pricing and portfolio links for what we talked about.`;

      const heroHref = isSingle ? track(services[0].key) : track("pricing");
      const heroLabel = isSingle ? `View ${services[0].label} Portfolio →` : "View Pricing →";

      const serviceRow = (label: string, price: string, href: string) =>
        `<tr>
          <td style="padding:11px 0;font-size:13px;border-bottom:1px solid #1e1e1e;background-color:#131313;">
            <a href="${href}" style="color:#ccc;text-decoration:none;">${label} <span style="font-size:10px;color:#444;">↗</span></a>
          </td>
          <td style="padding:11px 0;font-size:13px;color:#4ade80;text-align:right;font-weight:700;border-bottom:1px solid #1e1e1e;background-color:#131313;">${price}</td>
        </tr>`;

      return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fff;" bgcolor="#0c0c0c">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0c0c;" bgcolor="#0c0c0c">
<tr><td align="center" style="background-color:#0c0c0c;" bgcolor="#0c0c0c">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#0c0c0c;" bgcolor="#0c0c0c">

  <tr><td style="padding:48px 32px 40px;text-align:center;background-color:#0c0c0c;" bgcolor="#0c0c0c" align="center">
    <img src="https://www.luckimages.com/logo.png" width="52" height="52" alt="Luck Images" style="display:block;margin:0 auto 12px;border:0;" />
    <p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#cccccc;">Real Estate Media · Austin, TX</p>
    <h1 style="margin:0 0 20px;font-size:44px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;color:#ffffff;line-height:1;">LUCK IMAGES</h1>
    <p style="margin:0 auto 32px;font-size:14px;line-height:1.8;color:#dddddd;max-width:400px;">${introText}</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="padding-right:10px;">
          <a href="${heroHref}" style="display:inline-block;background-color:#ffffff;color:#000000;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 24px;text-decoration:none;">${heroLabel}</a>
        </td>
        <td>
          <a href="${track("home")}" style="display:inline-block;border:1px solid #999999;color:#ffffff;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:13px 24px;text-decoration:none;">Our Work →</a>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:32px;background-color:#0c0c0c;" bgcolor="#0c0c0c">
    <div style="background-color:#131313;border:1px solid #222;padding:28px;">
      <p style="margin:0 0 20px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#555;">${isAll ? "Services &amp; Starting Prices" : "Pricing"}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#131313;" bgcolor="#131313">
        ${services.map(s => serviceRow(s.label, s.price, track(s.key))).join("")}
      </table>
      <p style="margin:18px 0 0;font-size:11px;color:#444;">Photos scale with sq ft. Next-day delivery. Same-day rush available.</p>
    </div>
  </td></tr>

  ${quoteAmount ? `<tr><td style="padding:0 32px 0;background-color:#0c0c0c;" bgcolor="#0c0c0c">
    <div style="background-color:#0d1f0d;border:1px solid #1a3d1a;padding:20px 24px;">
      <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#4ade80;">Your Quote</p>
      <p style="margin:0;font-size:28px;font-weight:900;color:#ffffff;">$${quoteAmount}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#444;">Based on what we discussed.</p>
    </div>
  </td></tr>` : ""}

  <tr><td style="padding:24px 32px 16px;background-color:#0c0c0c;" bgcolor="#0c0c0c">
    <table cellpadding="0" cellspacing="0">
      <tr><td>
        <a href="https://www.luckimages.com/register" style="display:inline-block;background-color:#ffffff;color:#000000;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 24px;text-decoration:none;">Create Portal Account →</a>
      </td></tr>
    </table>
    <p style="margin:10px 0 0;font-size:11px;color:#333;">Create a free account to book your shoot, track delivery, and pay invoices in one place.</p>
  </td></tr>

  <tr><td style="border-top:1px solid #1a1a1a;padding:24px 32px 40px;background-color:#0c0c0c;" bgcolor="#0c0c0c">
    <p style="margin:0;font-size:13px;color:#888;line-height:1.7;">Ready to book or have questions? Reply to this email or give me a call.</p>
    <p style="margin:16px 0 0;font-size:13px;color:#fff;font-weight:700;">Ryan Luck</p>
    <p style="margin:2px 0 0;font-size:11px;color:#444;">Luck Images · ryan@luckimages.com · luckimages.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
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
  registered_at: null,
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
  const [mode, setMode] = useState<Mode>("campaign");
  const [emailLog, setEmailLog] = useState<EmailLogRow[]>([]);
  const [linkClicks, setLinkClicks] = useState<LinkClickRow[]>([]);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<string | null>(null);
  const [qs, setQs] = useState({ to: "", name: "", subject: "" });
  const [qsStatus, setQsStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [qsContactId, setQsContactId] = useState<string | null>(null);
  const [qsContactSearch, setQsContactSearch] = useState("");
  const [qsShowContactList, setQsShowContactList] = useState(false);
  const [qsBlocks, setQsBlocks] = useState<QuickBlock[]>([{ id: "b1", type: "paragraph", text: "" }]);

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
        .select("id, name, email, stage, total_revenue, user_id, created_at, lead_source, registered_at")
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

      // Engagement data — who was emailed + how they reacted
      const [{ data: logs }, { data: clicks }] = await Promise.all([
        supabase.from("email_log").select("contact_id, subject, sent_at, category").not("contact_id", "is", null).order("sent_at", { ascending: false }),
        supabase.from("link_clicks").select("contact_id, service, clicked_at").not("contact_id", "is", null).order("clicked_at", { ascending: false }),
      ]);
      setEmailLog(logs || []);
      setLinkClicks(clicks || []);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ←/→ arrow keys move between the tool's pages (ignored while typing)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      setMode(m => {
        const i = MODES.indexOf(m);
        return MODES[e.key === "ArrowRight" ? Math.min(i + 1, MODES.length - 1) : Math.max(i - 1, 0)];
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

        const res = await fetch("/api/admin/create-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: contact.id, to: contact.email, subject, html, category: activeTemplate.label }),
        });

        if (!res.ok) throw new Error("Draft creation failed");
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

  // ── Quick Send block editor: paragraphs + tracked buttons, reorderable ──
  function addParagraphBlock() {
    setQsBlocks(prev => [...prev, { id: `b${Date.now()}`, type: "paragraph", text: "" }]);
  }
  function addButtonBlock() {
    setQsBlocks(prev => [...prev, { id: `b${Date.now()}`, type: "button", label: "", url: "" }]);
  }
  function updateBlock(id: string, patch: Partial<QuickBlock>) {
    setQsBlocks(prev => prev.map(b => b.id === id ? ({ ...b, ...patch } as QuickBlock) : b));
  }
  function removeBlock(id: string) {
    setQsBlocks(prev => prev.filter(b => b.id !== id));
  }
  function moveBlock(id: string, dir: "up" | "down") {
    setQsBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }

  const qsContactMatches = qsContactSearch.trim()
    ? contacts.filter(c => !!c.email && (
        c.name.toLowerCase().includes(qsContactSearch.toLowerCase()) ||
        c.email!.toLowerCase().includes(qsContactSearch.toLowerCase())
      )).slice(0, 6)
    : [];

  function selectQsContact(c: Contact) {
    setQs(q => ({ ...q, to: c.email || "", name: c.name }));
    setQsContactId(c.id);
    setQsContactSearch("");
    setQsShowContactList(false);
  }

  // Branded header — same logo/title block used on the cold-call pitch email
  const QUICK_HEADER = `
    <img src="https://www.luckimages.com/logo.png" width="52" height="52" alt="Luck Images" style="display:block;margin:0 auto 12px;border:0;" />
    <p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#cccccc;">Real Estate Media · Austin, TX</p>
    <h1 style="margin:0 0 28px;font-size:36px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;color:#ffffff;line-height:1;text-align:center;">LUCK IMAGES</h1>`;

  function buildQuickSendHtml(subject: string, blocks: QuickBlock[], contactId: string | null) {
    const track = (url: string, label: string) => {
      const params = new URLSearchParams({ url });
      params.set("service", (label || "custom").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "custom");
      if (contactId) params.set("contact", contactId);
      return `https://www.luckimages.com/api/track-link?${params.toString()}`;
    };
    const body = blocks.map(b => {
      if (b.type === "paragraph") return b.text ? P(b.text) : "";
      if (!b.label || !b.url) return "";
      return BTN(track(b.url, b.label), b.label);
    }).join("");
    return wrap(QUICK_HEADER + H1(subject || "Quick Note") + body + SIG);
  }

  async function sendQuick() {
    const hasContent = qsBlocks.some(b => (b.type === "paragraph" && b.text.trim()) || (b.type === "button" && b.label && b.url));
    if (!qs.to || !qs.subject || !hasContent || qsStatus === "sending") return;
    setQsStatus("sending");

    // Resolve a contact so link clicks / registrations attribute correctly:
    // use the one picked from the dropdown, else match by email, else create
    // a lightweight lead record so tracking still works uniformly.
    let contactId = qsContactId;
    if (!contactId) {
      const match = contacts.find(c => c.email?.toLowerCase() === qs.to.toLowerCase());
      if (match) {
        contactId = match.id;
      } else {
        const { data: created } = await supabase.from("contacts").insert({
          name: qs.name || qs.to.split("@")[0],
          email: qs.to,
          stage: "lead",
          lead_source: "quick_send",
        }).select().single();
        if (created) contactId = created.id;
      }
    }

    const html = buildQuickSendHtml(qs.subject, qsBlocks, contactId);
    try {
      const res = await fetch("/api/admin/create-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, to: qs.to, subject: qs.subject, html, category: "Quick Send" }),
      });
      setQsStatus(res.ok ? "done" : "error");
    } catch {
      setQsStatus("error");
    }
  }

  const PITCH_SERVICE_OPTIONS = [
    { key: "photo",           label: "Listing Photos" },
    { key: "drone",           label: "Drone" },
    { key: "matterport",      label: "Matterport" },
    { key: "twilight",        label: "Twilight" },
    { key: "virtual-staging", label: "Virtual Staging" },
    { key: "video",           label: "Video" },
    { key: "floorplan",       label: "Floor Plan" },
  ];

  // For the pitch template, track selected services as a Set internally
  const pitchServicesRaw = extraFields["services"] || "all";
  const pitchAll = pitchServicesRaw === "all";
  const pitchSelected = pitchAll
    ? new Set(PITCH_SERVICE_OPTIONS.map(s => s.key))
    : new Set(pitchServicesRaw.split(",").map(s => s.trim()).filter(Boolean));

  function togglePitchService(key: string) {
    const next = new Set(pitchSelected);
    next.has(key) ? next.delete(key) : next.add(key);
    const isAll = next.size === PITCH_SERVICE_OPTIONS.length;
    setExtraFields(prev => ({ ...prev, services: isAll ? "all" : [...next].join(",") }));
  }

  // ── Engagement: one row per lead that was emailed or clicked a link ──
  const engagement = (() => {
    const byContact = new Map<string, { emails: EmailLogRow[]; clicks: LinkClickRow[] }>();
    const bucket = (id: string) => {
      if (!byContact.has(id)) byContact.set(id, { emails: [], clicks: [] });
      return byContact.get(id)!;
    };
    for (const l of emailLog) if (l.contact_id) bucket(l.contact_id).emails.push(l);
    for (const c of linkClicks) if (c.contact_id) bucket(c.contact_id).clicks.push(c);

    const rows = [];
    for (const [cid, { emails, clicks }] of byContact) {
      const contact = contacts.find(c => c.id === cid);
      if (!contact) continue; // skip deleted / unknown

      // emails come newest-first; attribute each click to the most recent
      // email sent at-or-before the click time.
      const timeline = emails.map(e => ({ email: e, clicks: [] as LinkClickRow[] }));
      const orphanClicks: LinkClickRow[] = [];
      for (const c of clicks) {
        const t = new Date(c.clicked_at).getTime();
        const idx = timeline.findIndex(row => row.email.sent_at && new Date(row.email.sent_at).getTime() <= t);
        if (idx >= 0) timeline[idx].clicks.push(c);
        else orphanClicks.push(c);
      }

      const lastEmail = emails[0]?.sent_at ? new Date(emails[0].sent_at).getTime() : 0;
      const lastClick = clicks[0]?.clicked_at ? new Date(clicks[0].clicked_at).getTime() : 0;
      rows.push({ contact, emails, clicks, timeline, orphanClicks, lastActivity: Math.max(lastEmail, lastClick) });
    }
    return rows.sort((a, b) => b.lastActivity - a.lastActivity);
  })();

  // ── Campaigns: group every sent email (with its attributed clicks) by
  // format label, so each campaign type (Cold Call Follow-up, Portal Invite,
  // a future newsletter, etc.) gets its own stats + lead list. New campaign
  // types appear automatically the first time that category is sent.
  type CampaignEntry = { contact: Contact; email: EmailLogRow; clicks: LinkClickRow[] };
  const campaigns = (() => {
    const map = new Map<string, CampaignEntry[]>();
    for (const row of engagement) {
      for (const { email, clicks } of row.timeline) {
        const name = emailFormatLabel(email);
        if (!map.has(name)) map.set(name, []);
        map.get(name)!.push({ contact: row.contact, email, clicks });
      }
    }
    const list = [...map.entries()].map(([name, entries]) => {
      const contactIds = new Set(entries.map(e => e.contact.id));
      const clickedContactIds = new Set(entries.filter(e => e.clicks.length > 0).map(e => e.contact.id));
      // Registered = converted after being targeted by this campaign. Templates
      // like Portal Invite only ever target unregistered contacts, so any
      // registration afterward is fairly attributed to having been emailed.
      const registeredContactIds = new Set(
        entries.filter(e => e.contact.registered_at).map(e => e.contact.id)
      );
      const totalClicks = entries.reduce((n, e) => n + e.clicks.length, 0);
      const lastSentAt = entries.reduce((max, e) => {
        const t = e.email.sent_at ? new Date(e.email.sent_at).getTime() : 0;
        return t > max ? t : max;
      }, 0);
      return {
        name, entries, contactIds, clickedContactIds, registeredContactIds, totalClicks, lastSentAt,
        emailsSent: entries.length,
        leadsEmailed: contactIds.size,
        leadsClicked: clickedContactIds.size,
        registered: registeredContactIds.size,
        clickRate: contactIds.size > 0 ? Math.round((clickedContactIds.size / contactIds.size) * 100) : 0,
        registerRate: contactIds.size > 0 ? Math.round((registeredContactIds.size / contactIds.size) * 100) : 0,
      };
    });
    return list.sort((a, b) => b.lastSentAt - a.lastSentAt);
  })();

  // Default to the most recently active campaign once data loads
  if (activeCampaign === null && campaigns.length > 0) {
    setActiveCampaign(campaigns[0].name);
  }

  const currentCampaign = campaigns.find(c => c.name === activeCampaign) || campaigns[0];

  // Re-bucket the active campaign's entries by contact for the expandable list
  const campaignByContact = (() => {
    if (!currentCampaign) return [];
    const map = new Map<string, { contact: Contact; timeline: { email: EmailLogRow; clicks: LinkClickRow[] }[] }>();
    for (const e of currentCampaign.entries) {
      if (!map.has(e.contact.id)) map.set(e.contact.id, { contact: e.contact, timeline: [] });
      map.get(e.contact.id)!.timeline.push({ email: e.email, clicks: e.clicks });
    }
    const rows = [...map.values()].map(r => ({
      ...r,
      timeline: r.timeline.sort((a, b) => new Date(b.email.sent_at || 0).getTime() - new Date(a.email.sent_at || 0).getTime()),
      lastActivity: Math.max(...r.timeline.map(t => new Date(t.email.sent_at || 0).getTime()), ...r.timeline.flatMap(t => t.clicks.map(c => new Date(c.clicked_at).getTime()))),
    }));
    return rows.sort((a, b) => b.lastActivity - a.lastActivity);
  })();

  const engFiltered = campaignByContact.filter(r =>
    !search || r.contact.name.toLowerCase().includes(search.toLowerCase()) || r.contact.email?.toLowerCase().includes(search.toLowerCase())
  );

  const fmtDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  function reactionBadge(row: { contact: Contact; timeline: { clicks: LinkClickRow[] }[] }) {
    if (row.contact.registered_at || ["client", "registered", "closed"].includes(row.contact.stage)) return { label: "Registered", color: "#34d399" };
    if (row.timeline.some(t => t.clicks.length > 0)) return { label: "Clicked", color: "#60a5fa" };
    return { label: "Sent", color: "#666" };
  }

  return (
    <main className="h-screen w-full bg-[#0c0c0c] text-white flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 md:px-8 pt-6 pb-4 shrink-0 flex items-center justify-between gap-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Email Outreach</h1>
          <p className="text-xs text-[#444] mt-0.5 tracking-wide">Build campaigns, preview live, create Gmail drafts.</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setMode("campaign")}
            className={`text-[10px] tracking-[2px] uppercase px-4 py-2 border transition-colors ${mode === "campaign" ? "border-white text-white bg-white/10" : "border-white/20 text-[#555] hover:text-white hover:border-white/40"}`}>
            Campaign
          </button>
          <button onClick={() => { setMode("quicksend"); setQsStatus("idle"); }}
            className={`text-[10px] tracking-[2px] uppercase px-4 py-2 border transition-colors ${mode === "quicksend" ? "border-white text-white bg-white/10" : "border-white/20 text-[#555] hover:text-white hover:border-white/40"}`}>
            Quick Send
          </button>
          <button onClick={() => setMode("engagement")}
            className={`text-[10px] tracking-[2px] uppercase px-4 py-2 border transition-colors ${mode === "engagement" ? "border-white text-white bg-white/10" : "border-white/20 text-[#555] hover:text-white hover:border-white/40"}`}>
            Engagement
          </button>
        </div>
      </div>

      {/* ══ ENGAGEMENT PAGE ══ */}
      {mode === "engagement" ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Campaign tabs — one per category found in the send log, newest-active first */}
          <div className="px-6 md:px-8 pt-4 shrink-0 flex items-center gap-2 flex-wrap border-b border-white/10 pb-3">
            {campaigns.length === 0 && !loading && (
              <p className="text-xs text-[#333] italic">No campaigns sent yet.</p>
            )}
            {campaigns.map(c => (
              <button key={c.name} onClick={() => setActiveCampaign(c.name)}
                className={`text-xs tracking-[0.5px] px-3 py-1.5 border transition-colors ${
                  activeCampaign === c.name ? "border-white text-white bg-white/10" : "border-white/15 text-[#666] hover:text-white hover:border-white/30"
                }`}>
                {c.name} <span className="text-[#444] ml-1">({c.leadsEmailed})</span>
              </button>
            ))}
          </div>

          {currentCampaign && (
            <>
              {/* Summary bar — scoped to the active campaign */}
              <div className="px-6 md:px-8 py-4 border-b border-white/10 shrink-0 flex items-center gap-8 flex-wrap">
                <div>
                  <p className="text-2xl font-black tabular-nums">{currentCampaign.leadsEmailed}</p>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-0.5">Leads Emailed</p>
                </div>
                <div>
                  <p className="text-2xl font-black tabular-nums text-[#60a5fa]">{currentCampaign.leadsClicked}</p>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-0.5">Clicked a Link</p>
                </div>
                <div>
                  <p className="text-2xl font-black tabular-nums text-[#4ade80]">{currentCampaign.clickRate}%</p>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-0.5">Click Rate</p>
                </div>
                <div>
                  <p className="text-2xl font-black tabular-nums text-[#34d399]">{currentCampaign.registered}</p>
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-0.5">Registered ({currentCampaign.registerRate}%)</p>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search leads..."
                    className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20" />
                </div>
              </div>

              {/* Opens note */}
              <div className="px-6 md:px-8 py-2 border-b border-white/5 shrink-0">
                <p className="text-[10px] text-[#444]">
                  Tracking link clicks, registrations &amp; pipeline status live. <span className="text-[#555]">Email opens aren&apos;t tracked yet — ask Claude to turn on Resend open tracking.</span>
                </p>
              </div>

              {/* Lead activity list — scoped to the active campaign */}
              <div className="flex-1 overflow-y-auto">
                {loading && <p className="text-xs text-[#444] italic p-8">Loading engagement...</p>}
                {!loading && engFiltered.length === 0 && (
                  <div className="p-12 text-center">
                    <p className="text-sm text-[#444]">No leads match.</p>
                  </div>
                )}
                <div className="divide-y divide-white/5">
                  {engFiltered.map(row => {
                    const badge = reactionBadge(row);
                    const stage = STAGE_PILL[row.contact.stage] || { label: row.contact.stage, color: "#666" };
                    const isOpen = expandedLead === row.contact.id;
                    const totalClicks = row.timeline.reduce((n, t) => n + t.clicks.length, 0);
                    return (
                      <div key={row.contact.id}>
                        {/* ── Contact bar (click to expand) ── */}
                        <button
                          onClick={() => setExpandedLead(isOpen ? null : row.contact.id)}
                          className={`w-full text-left px-6 md:px-8 py-4 flex items-center gap-4 transition-colors ${isOpen ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}>
                          <span className={`text-[#555] text-sm shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-base font-semibold truncate">{row.contact.name}</span>
                              <span className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 rounded-full font-semibold"
                                style={{ color: badge.color, backgroundColor: `${badge.color}1a` }}>{badge.label}</span>
                              <span className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 rounded-full"
                                style={{ color: stage.color, border: `1px solid ${stage.color}55` }}>{stage.label}</span>
                            </div>
                            <p className="text-xs text-[#555] mt-1 truncate">{row.contact.email}</p>
                            <p className="text-xs text-[#777] mt-1.5">
                              <span className="text-[#999]">📨 {row.timeline.length} email{row.timeline.length > 1 ? "s" : ""}</span>
                              {totalClicks > 0
                                ? <span className="text-[#60a5fa]"> · {totalClicks} link click{totalClicks > 1 ? "s" : ""}</span>
                                : <span className="text-[#444]"> · no clicks yet</span>}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-[#666]">{row.lastActivity ? fmtDate(new Date(row.lastActivity).toISOString()) : "—"}</p>
                            <p className="text-[10px] tracking-[1px] uppercase text-[#333] mt-0.5">last activity</p>
                          </div>
                        </button>

                        {/* ── Expanded per-email history ── */}
                        {isOpen && (
                          <div className="px-6 md:px-8 pb-5 pl-14 space-y-3 bg-white/[0.015]">
                            {row.timeline.map(({ email, clicks }, i) => (
                              <div key={i} className="border-l-2 border-white/10 pl-4 pt-2">
                                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                                  <span className="text-sm font-semibold text-[#4ade80]">{emailFormatLabel(email)}</span>
                                  <span className="text-xs text-[#555] tabular-nums">{email.sent_at ? fmtDateTime(email.sent_at) : "—"}</span>
                                </div>
                                {email.subject && <p className="text-xs text-[#666] mt-0.5">&ldquo;{email.subject.replace(/^\[DRAFT\]\s*/, "")}&rdquo;</p>}
                                {clicks.length > 0 ? (
                                  <div className="mt-2 space-y-1">
                                    {clicks.map((c, j) => (
                                      <div key={j} className="flex items-center gap-2 text-xs">
                                        <span className="text-[#60a5fa]">🔗 Clicked {CLICK_LABEL[c.service] || c.service}</span>
                                        <span className="text-[#555] tabular-nums">— {fmtDateTime(c.clicked_at)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-[#3a3a3a] italic mt-1.5">No clicks on this email yet</p>
                                )}
                              </div>
                            ))}
                            {row.contact.registered_at && (
                              <div className="border-l-2 border-[#34d399]/30 pl-4 pt-2">
                                <span className="text-sm font-semibold text-[#34d399]">✓ Registered a portal account</span>
                                <p className="text-xs text-[#555] mt-0.5">{fmtDateTime(row.contact.registered_at)}</p>
                              </div>
                            )}
                            <a href={`/admin/contacts/${row.contact.id}`} className="inline-block text-xs text-[#555] hover:text-white transition-colors pt-1">
                              View full contact →
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (

      /* Two-column body */
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── LEFT PANEL ── */}
        <div className="w-[380px] shrink-0 border-r border-white/10 flex flex-col overflow-hidden">

          {mode === "quicksend" ? (
            /* Quick Send compose */
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-[10px] tracking-[3px] uppercase text-[#555] mb-2">Quick Send — One-off Email</p>

              {/* Contact picker — select an existing contact, or just type any email/name below */}
              <div className="relative">
                <label className="text-[10px] text-[#444] block mb-1 tracking-[1px] uppercase">Find a contact (optional)</label>
                <input type="text" value={qsContactSearch}
                  onChange={e => { setQsContactSearch(e.target.value); setQsShowContactList(true); }}
                  onFocus={() => setQsShowContactList(true)}
                  placeholder="Search name or email..."
                  className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20" />
                {qsShowContactList && qsContactMatches.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#181818] border border-white/10 max-h-48 overflow-y-auto">
                    {qsContactMatches.map(c => (
                      <button key={c.id} type="button" onClick={() => selectQsContact(c)}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors">
                        <p className="text-xs text-white truncate">{c.name}</p>
                        <p className="text-[10px] text-[#555] truncate">{c.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                {qsContactId && (
                  <p className="text-[10px] text-[#4ade80] mt-1">
                    Linked to contact ✓ <button type="button" onClick={() => setQsContactId(null)} className="text-[#555] hover:text-white underline ml-1">unlink</button>
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] text-[#444] block mb-1 tracking-[1px] uppercase">To (email)</label>
                <input type="email" value={qs.to} onChange={e => { setQs(q => ({ ...q, to: e.target.value })); setQsContactId(null); }}
                  placeholder="client@example.com"
                  className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20" />
              </div>
              <div>
                <label className="text-[10px] text-[#444] block mb-1 tracking-[1px] uppercase">Name</label>
                <input type="text" value={qs.name} onChange={e => setQs(q => ({ ...q, name: e.target.value }))}
                  placeholder="First Last"
                  className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20" />
              </div>
              <div>
                <label className="text-[10px] text-[#444] block mb-1 tracking-[1px] uppercase">Subject</label>
                <input type="text" value={qs.subject} onChange={e => setQs(q => ({ ...q, subject: e.target.value }))}
                  placeholder="Hey Sarah, quick note..."
                  className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20" />
              </div>

              {/* Block editor — paragraphs + tracked buttons, reorderable */}
              <div>
                <label className="text-[10px] text-[#444] block mb-2 tracking-[1px] uppercase">Message</label>
                <div className="space-y-2">
                  {qsBlocks.map((b, i) => (
                    <div key={b.id} className="bg-[#181818] border border-white/10 p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] tracking-[1px] uppercase text-[#555]">{b.type === "paragraph" ? "Paragraph" : "Button"}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => moveBlock(b.id, "up")} disabled={i === 0}
                            className="text-[#555] hover:text-white disabled:opacity-20 disabled:hover:text-[#555] transition-colors text-xs px-1">↑</button>
                          <button type="button" onClick={() => moveBlock(b.id, "down")} disabled={i === qsBlocks.length - 1}
                            className="text-[#555] hover:text-white disabled:opacity-20 disabled:hover:text-[#555] transition-colors text-xs px-1">↓</button>
                          <button type="button" onClick={() => removeBlock(b.id)}
                            className="text-[#555] hover:text-red-400 transition-colors text-xs px-1">✕</button>
                        </div>
                      </div>
                      {b.type === "paragraph" ? (
                        <textarea value={b.text} onChange={e => updateBlock(b.id, { text: e.target.value })} rows={3}
                          placeholder="Write a paragraph..."
                          className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-2.5 py-2 outline-none placeholder:text-[#333] focus:border-white/20 resize-none leading-relaxed" />
                      ) : (
                        <div className="space-y-1.5">
                          <input type="text" value={b.label} onChange={e => updateBlock(b.id, { label: e.target.value })}
                            placeholder="Button text — e.g. View Listing →"
                            className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-2.5 py-2 outline-none placeholder:text-[#333] focus:border-white/20" />
                          <input type="url" value={b.url} onChange={e => updateBlock(b.id, { url: e.target.value })}
                            placeholder="https://..."
                            className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-2.5 py-2 outline-none placeholder:text-[#333] focus:border-white/20" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={addParagraphBlock}
                    className="flex-1 text-[10px] tracking-[1px] uppercase text-[#888] hover:text-white border border-white/10 hover:border-white/30 transition-colors py-2">
                    + Paragraph
                  </button>
                  <button type="button" onClick={addButtonBlock}
                    className="flex-1 text-[10px] tracking-[1px] uppercase text-[#888] hover:text-white border border-white/10 hover:border-white/30 transition-colors py-2">
                    + Button
                  </button>
                </div>
                <p className="text-[10px] text-[#333] mt-1.5">Buttons are click-tracked — see them under the &ldquo;Quick Send&rdquo; tab in Engagement.</p>
              </div>

              <button onClick={sendQuick}
                disabled={!qs.to || !qs.subject || qsStatus === "sending" || qsStatus === "done"}
                className="w-full text-xs tracking-[2px] uppercase font-semibold py-3 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40">
                {qsStatus === "sending" ? "Creating Draft..." : qsStatus === "done" ? "✓ Draft Created — Check Gmail" : qsStatus === "error" ? "Error — Retry" : "Create Draft →"}
              </button>
              {qsStatus === "done" && (
                <button onClick={() => {
                  setQs({ to: "", name: "", subject: "" });
                  setQsBlocks([{ id: `b${Date.now()}`, type: "paragraph", text: "" }]);
                  setQsContactId(null);
                  setQsStatus("idle");
                }}
                  className="w-full text-[10px] tracking-[1px] uppercase text-[#555] hover:text-white transition-colors py-2">
                  Send another
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Top half: template list */}
              <div className="flex-1 min-h-0 border-b border-white/10 flex flex-col overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
                  <p className="text-[10px] tracking-[3px] uppercase text-[#555]">Campaign Templates</p>
                </div>
                <div className="flex flex-col flex-1 overflow-y-auto divide-y divide-white/5">
                  {TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => selectTemplate(t)}
                      className={`text-left px-4 py-3 transition-colors hover:bg-white/[0.03] ${activeTemplate.id === t.id ? "bg-white/[0.06]" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] tracking-[1.5px] uppercase font-semibold ${t.tagColor}`}>{t.tag}</span>
                        {activeTemplate.id === t.id && <span className="text-[10px] text-white/40">✓</span>}
                      </div>
                      <p className="text-xs font-bold text-white mt-0.5">{t.label}</p>
                      <p className="text-[10px] text-[#444] mt-0.5 leading-snug">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Customize fields (shrink-0 — sits between the two halves) */}
              {activeTemplate.extraFields && activeTemplate.extraFields.length > 0 && (
                <div className="shrink-0 border-b border-white/10 px-4 py-4 space-y-4">
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Customize</p>
                  {activeTemplate.extraFields.map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] text-[#444] block mb-2 tracking-[1px] uppercase">{f.label}</label>
                      {/* Service toggles for the pitch template */}
                      {f.key === "services" ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-[#333]">
                              {pitchAll ? "All services" : `${pitchSelected.size} selected`}
                            </span>
                            <button type="button"
                              onClick={() => setExtraFields(prev => ({ ...prev, services: pitchAll ? "" : "all" }))}
                              className="text-[10px] text-[#4ade80] hover:text-white transition-colors tracking-[1px] uppercase">
                              {pitchAll ? "Clear all" : "Select all"}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {PITCH_SERVICE_OPTIONS.map(s => {
                              const active = pitchSelected.has(s.key);
                              return (
                                <button key={s.key} type="button" onClick={() => togglePitchService(s.key)}
                                  className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-all ${active ? "border-[#4ade80] text-[#4ade80] bg-[#4ade80]/10" : "border-white/15 text-[#555] hover:border-white/30 hover:text-white/70"}`}>
                                  {s.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <input type="text" value={extraFields[f.key] || ""} onChange={e => setExtraFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full bg-[#1a1a1a] border border-white/10 text-xs text-white px-3 py-2 outline-none placeholder:text-[#333] focus:border-white/20" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Contact list */}
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden border-t border-white/10">
                {/* Search + select all */}
                <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-3 shrink-0">
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search contacts..."
                    className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[#333]" />
                  <span className="text-[10px] text-[#444] shrink-0">{eligible.length}</span>
                  <button onClick={toggleAll}
                    className="text-[10px] tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-2 py-1 shrink-0">
                    {selected.size === filtered.length && filtered.length > 0 ? "Deselect" : "All"}
                  </button>
                </div>

                {/* Contacts */}
                <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                  {loading && <p className="text-xs text-[#444] italic p-4">Loading...</p>}
                  {!loading && filtered.length === 0 && (
                    <p className="text-xs text-[#333] italic p-4">No contacts match this template.</p>
                  )}
                  {filtered.map(c => {
                    const status = statuses[c.id];
                    const isSelected = selected.has(c.id);
                    return (
                      <div key={c.id}
                        onClick={() => { if (!sending) toggle(c.id); }}
                        onMouseEnter={() => setPreviewContact(c)}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"}`}>
                        <div className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-colors ${
                          status === "done"    ? "border-[#4ade80] bg-[#4ade80]/20" :
                          status === "error"   ? "border-red-500 bg-red-500/20" :
                          status === "pending" ? "border-[#fbbf24] bg-[#fbbf24]/10" :
                          isSelected ? "border-white bg-white/10" : "border-white/20"
                        }`}>
                          {status === "done"    && <span className="text-[#4ade80] text-[8px]">✓</span>}
                          {status === "error"   && <span className="text-red-400 text-[8px]">✕</span>}
                          {status === "pending" && <span className="w-1 h-1 rounded-full bg-[#fbbf24] animate-pulse block" />}
                          {!status && isSelected && <span className="text-white text-[8px]">✓</span>}
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
                            <span className={`text-[9px] ${status === "done" ? "text-[#4ade80]" : status === "error" ? "text-red-400" : "text-[#fbbf24]"}`}>
                              {status === "done" ? "✓" : status === "error" ? "✕" : "..."}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Send bar */}
                {selected.size > 0 && (
                  <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between shrink-0">
                    <div className="text-xs text-[#888]">
                      <span className="text-white font-semibold">{selected.size}</span> selected
                      {doneCount > 0 && <span className="text-[#4ade80] ml-3">{doneCount} drafted</span>}
                      {errorCount > 0 && <span className="text-red-400 ml-2">{errorCount} failed</span>}
                    </div>
                    <button onClick={sendAll} disabled={sending}
                      className="text-xs tracking-[1px] uppercase font-bold px-5 py-2 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40">
                      {sending ? `${sentCount}/${selected.size}...` : `Draft ${selected.size} →`}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT PANEL — Large email preview ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#080808]">
          {/* Preview header */}
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3 shrink-0">
            <p className="text-[10px] tracking-[3px] uppercase text-[#555]">Email Preview</p>
            <span className="text-white/10">·</span>
            {mode === "quicksend" ? (
              <p className="text-[10px] text-[#444]">{qs.subject || "—"}</p>
            ) : (
              <p className="text-[10px] text-[#444]">{activeTemplate.subject(preview)}</p>
            )}
            <div className="flex-1" />
            {mode === "campaign" && (
              <p className="text-[10px] text-[#333]">
                {preview.id === "example" ? "previewing: example contact" : `previewing: ${preview.name}`}
              </p>
            )}
          </div>

          {/* iframe */}
          {mode === "quicksend" ? (
            qsBlocks.some(b => (b.type === "paragraph" && b.text) || (b.type === "button" && b.label)) ? (
              <iframe title="Email preview" className="w-full flex-1 border-0"
                srcDoc={buildQuickSendHtml(qs.subject, qsBlocks, qsContactId)} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-[#333] italic">Start typing to see a live preview</p>
              </div>
            )
          ) : (
            <iframe title="Email preview" className="w-full flex-1 border-0"
              srcDoc={activeTemplate.html(preview, { ...extraFields, portalLink: "https://www.luckimages.com/dashboard" })} />
          )}
        </div>

      </div>
      )}
    </main>
  );
}
