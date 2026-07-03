"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const CHANNELS: { key: string; label: string; icon: string; dedicated?: boolean }[] = [
  { key: "cold-call",         label: "Cold Calling",              icon: "📞", dedicated: true },
  { key: "referral",          label: "Referral",                  icon: "👥" },
  { key: "google-seo",        label: "Google SEO",                icon: "🔍" },
  { key: "google-business",   label: "Google Business Profile",   icon: "📍" },
  { key: "yelp",              label: "Yelp",                      icon: "⭐" },
  { key: "instagram",         label: "Instagram",                 icon: "📸" },
  { key: "facebook",          label: "Facebook",                  icon: "📘" },
  { key: "linkedin-business", label: "LinkedIn — Luck Images",    icon: "💼" },
  { key: "linkedin-personal", label: "LinkedIn — Ryan Luck",      icon: "🧑‍💼" },
  { key: "cold-email",        label: "Cold Email",                icon: "📧" },
  { key: "zillow",            label: "Zillow / Realtor.com",      icon: "🏠" },
  { key: "networking",        label: "Networking Events",         icon: "🤝" },
  { key: "partnership",       label: "Partner Referrals",         icon: "🔗" },
  { key: "direct-mail",       label: "Direct Mail",               icon: "✉️" },
  { key: "other",             label: "Other",                     icon: "💬" },
];

type Contact = {
  id: string;
  name: string;
  type: string;
  stage: string;
  lead_source: string | null;
  total_revenue: number | null;
  created_at: string;
  referred_by_contact_id: string | null;
};

type Shoot = {
  id: string;
  contact_id: string | null;
  scheduled_at: string | null;
  status: string;
  price: number | null;
};

type ColdCallLog = {
  id: string;
  contact_id: string;
  outcome: string;
  called_at: string;
  called_by: string;
};

type LinkClick = {
  id: string;
  contact_id: string | null;
  service: string;
  clicked_at: string;
};

const SERVICE_LABELS: Record<string, string> = {
  photo: "Listing Photos",
  drone: "Drone Photos",
  matterport: "Matterport 3D Tour",
  twilight: "Twilight Photography",
  "virtual-staging": "Virtual Staging",
  video: "Video Walkthrough",
  floorplan: "Floor Plan",
  pricing: "Pricing Page",
  home: "Homepage / Portfolio",
};

const BASE_URL = "https://www.luckimages.com";

function hasTag(outcome: string, tag: string) {
  return outcome.split(",").includes(tag);
}

function StatBox({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#0f0f0f] border border-white/5 px-4 py-3 flex flex-col gap-0.5">
      <p className={`text-xl font-black tabular-nums ${accent || "text-white"}`}>{value}</p>
      <p className="text-[10px] tracking-[1.5px] uppercase text-[#444]">{label}</p>
      {sub && <p className="text-[10px] text-[#333]">{sub}</p>}
    </div>
  );
}

export default function MarketingPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [coldCalls, setColdCalls] = useState<ColdCallLog[]>([]);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [referralSearch, setReferralSearch] = useState("");
  const [callsToggle, setCallsToggle] = useState<"week" | "all">("week");
  const [revenueToggle, setRevenueToggle] = useState<"mtd" | "ytd">("mtd");
  const [channelTableOpen, setChannelTableOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: contactData }, { data: shootData }, { data: callData }, { data: clickData }] = await Promise.all([
      supabase.from("contacts").select("id, name, type, stage, lead_source, total_revenue, created_at, referred_by_contact_id").neq("stage", "deleted"),
      supabase.from("shoots").select("id, contact_id, scheduled_at, status, price").in("status", ["completed", "delivered"]),
      supabase.from("cold_calls").select("id, contact_id, outcome, called_at, called_by"),
      supabase.from("link_clicks").select("id, contact_id, service, clicked_at").order("clicked_at", { ascending: false }),
    ]);
    setContacts(contactData || []);
    setShoots(shootData || []);
    setColdCalls(callData || []);
    setLinkClicks(clickData || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyLink(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Cold calling stats ──────────────────────────────────────────────────
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const mtdStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const ytdStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const callsThisWeek = coldCalls.filter(c => c.called_at >= weekAgo).length;
  const callsAllTime = coldCalls.length;
  const uniqueContactsCalled = new Set(coldCalls.map(c => c.contact_id)).size;
  const latestByContact: Record<string, ColdCallLog> = {};
  for (const log of coldCalls) {
    if (!latestByContact[log.contact_id] || log.called_at > latestByContact[log.contact_id].called_at)
      latestByContact[log.contact_id] = log;
  }
  const latestLogs = Object.values(latestByContact);
  const interestedCount = latestLogs.filter(l => hasTag(l.outcome, "interested") && !hasTag(l.outcome, "dead") && !hasTag(l.outcome, "closed")).length;
  const closedFromCalls = latestLogs.filter(l => hasTag(l.outcome, "closed")).length;
  const coldCallConversion = uniqueContactsCalled > 0 ? Math.round((closedFromCalls / uniqueContactsCalled) * 100) : 0;
  // Revenue by when the shoot actually happened, not when the contact was created —
  // an old cold-call contact who books this month should count toward this month's revenue.
  const coldCallContactIds = new Set(contacts.filter(c => c.lead_source === "cold-call").map(c => c.id));
  const coldCallShoots = shoots.filter(s => s.contact_id && coldCallContactIds.has(s.contact_id) && s.scheduled_at);
  const revMTD = coldCallShoots.filter(s => s.scheduled_at! >= mtdStart).reduce((s, sh) => s + (sh.price || 0), 0);
  const revYTD = coldCallShoots.filter(s => s.scheduled_at! >= ytdStart).reduce((s, sh) => s + (sh.price || 0), 0);

  // ── Generic channel stats ───────────────────────────────────────────────
  const genericChannels = CHANNELS.filter(ch => !ch.dedicated).map(ch => {
    const matched = contacts.filter(c => c.lead_source === ch.key);
    const clients = matched.filter(c => c.type === "realtor" || c.stage === "client" || (c.total_revenue || 0) > 0);
    const revenue = matched.reduce((s, c) => s + (c.total_revenue || 0), 0);
    return {
      ...ch,
      leads: matched.length,
      clients: clients.length,
      revenue,
      conversionRate: matched.length > 0 ? Math.round((clients.length / matched.length) * 100) : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);

  // ── Overall stats ───────────────────────────────────────────────────────
  const totalLeads = contacts.length;
  const totalClients = contacts.filter(c => c.type === "realtor" || (c.total_revenue || 0) > 0).length;
  const totalRevenue = contacts.reduce((s, c) => s + (c.total_revenue || 0), 0);
  const overallConversion = totalLeads > 0 ? Math.round((totalClients / totalLeads) * 100) : 0;

  const clientShootMap: Record<string, number[]> = {};
  for (const sh of shoots) {
    if (!sh.contact_id) continue;
    if (!clientShootMap[sh.contact_id]) clientShootMap[sh.contact_id] = [];
    clientShootMap[sh.contact_id].push(new Date(sh.scheduled_at || sh.id).getTime());
  }
  const uniqueClientsWithShoots = Object.keys(clientShootMap).length;
  const repeatClientCount = Object.values(clientShootMap).filter(d => d.length >= 2).length;
  const repeatClientPct = uniqueClientsWithShoots > 0 ? Math.round((repeatClientCount / uniqueClientsWithShoots) * 100) : 0;
  const avgBookingGapDays = (() => {
    const gaps: number[] = [];
    for (const dates of Object.values(clientShootMap)) {
      if (dates.length < 2) continue;
      dates.sort((a, b) => a - b);
      for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 86400000);
    }
    return gaps.length ? Math.round(gaps.reduce((a, b) => a + b) / gaps.length) : null;
  })();

  // ── Email engagement (pitch email link clicks) ──────────────────────────
  const clicksByContact: Record<string, LinkClick[]> = {};
  for (const click of linkClicks) {
    if (!click.contact_id) continue;
    if (!clicksByContact[click.contact_id]) clicksByContact[click.contact_id] = [];
    clicksByContact[click.contact_id].push(click);
  }
  const engagedContacts = Object.entries(clicksByContact)
    .map(([contactId, clicks]) => {
      const contact = contacts.find(c => c.id === contactId);
      const sorted = [...clicks].sort((a, b) => new Date(b.clicked_at).getTime() - new Date(a.clicked_at).getTime());
      return { contactId, name: contact?.name || "Unknown", clicks: sorted };
    })
    .sort((a, b) => new Date(b.clicks[0].clicked_at).getTime() - new Date(a.clicks[0].clicked_at).getTime());

  const unattributed = contacts.filter(c => !c.lead_source);
  const top10LTV = [...contacts].filter(c => (c.total_revenue || 0) > 0).sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0)).slice(0, 10);
  const referralContacts = contacts.filter(c => referralSearch.length > 1 && c.name.toLowerCase().includes(referralSearch.toLowerCase())).slice(0, 6);

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-6">
          <a href="/" className="text-lg font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">← Dashboard</a>
        </div>
      </header>

      <div className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full space-y-10">

        <div>
          <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">Attribution</p>
          <h1 className="text-2xl font-black tracking-tight uppercase">Marketing Metrics</h1>
        </div>

        {/* Overall quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-white/5 border border-white/5">
          {[
            { label: "Total Contacts", value: totalLeads.toString() },
            { label: "Converted Clients", value: totalClients.toString() },
            { label: "Conversion Rate", value: `${overallConversion}%` },
            { label: "Attributed Revenue", value: `$${totalRevenue.toLocaleString()}` },
            { label: "Repeat Client Rate", value: uniqueClientsWithShoots > 0 ? `${repeatClientPct}%` : "—", sub: `${repeatClientCount} of ${uniqueClientsWithShoots} clients booked 2+` },
            { label: "Avg Gap Between Bookings", value: avgBookingGapDays ? `${avgBookingGapDays}d` : "—", sub: avgBookingGapDays ? "avg days between shoots" : "Not enough data yet" },
          ].map(stat => (
            <div key={stat.label} className="bg-[#0c0c0c] px-5 py-5">
              <p className="text-2xl font-black tabular-nums text-white">{stat.value}</p>
              <p className="text-[10px] tracking-[1.5px] uppercase text-[#444] mt-1">{stat.label}</p>
              {"sub" in stat && stat.sub && <p className="text-[10px] text-[#333] mt-0.5">{stat.sub}</p>}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
          </div>
        ) : (
          <>
            {/* ── Cold Calling — dedicated card ── */}
            <div>
              <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-4">Channel Breakdown</p>

              <div className="border border-white/10 bg-[#111] p-5 space-y-4 mb-px">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📞</span>
                    <div>
                      <p className="text-sm font-bold tracking-wide">Cold Calling</p>
                      <p className="text-[10px] text-[#444] mt-0.5">Live data from the Cold Call Tool</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push("/admin/cold-calls")}
                    className="text-[10px] tracking-[1.5px] uppercase border border-white/20 px-3 py-1.5 text-[#888] hover:text-white hover:border-white/40 transition-all shrink-0"
                  >
                    Open Tool →
                  </button>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-px bg-white/5">
                  {/* Calls — toggleable week / all time */}
                  <div className="bg-[#0f0f0f] border border-white/5 px-4 py-3 flex flex-col gap-0.5">
                    <p className="text-xl font-black tabular-nums text-white">
                      {callsToggle === "week" ? callsThisWeek : callsAllTime}
                    </p>
                    <p className="text-[10px] tracking-[1.5px] uppercase text-[#444]">Calls</p>
                    <div className="flex gap-2 mt-1">
                      {(["week", "all"] as const).map(t => (
                        <button key={t} onClick={() => setCallsToggle(t)}
                          className={`text-[9px] tracking-[1px] uppercase px-1.5 py-0.5 border transition-all ${callsToggle === t ? "border-white/30 text-white" : "border-white/5 text-[#333] hover:text-[#555]"}`}>
                          {t === "week" ? "This Week" : "All Time"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contacts */}
                  <StatBox label="Contacts" value={uniqueContactsCalled.toString()} />

                  {/* Revenue — toggleable MTD / YTD */}
                  <div className="bg-[#0f0f0f] border border-white/5 px-4 py-3 flex flex-col gap-0.5">
                    <p className="text-xl font-black tabular-nums text-[#4ade80]">
                      {(revenueToggle === "mtd" ? revMTD : revYTD) > 0
                        ? `$${(revenueToggle === "mtd" ? revMTD : revYTD).toLocaleString()}`
                        : "—"}
                    </p>
                    <p className="text-[10px] tracking-[1.5px] uppercase text-[#444]">Revenue Generated</p>
                    <div className="flex gap-2 mt-1">
                      {(["mtd", "ytd"] as const).map(t => (
                        <button key={t} onClick={() => setRevenueToggle(t)}
                          className={`text-[9px] tracking-[1px] uppercase px-1.5 py-0.5 border transition-all ${revenueToggle === t ? "border-white/30 text-white" : "border-white/5 text-[#333] hover:text-[#555]"}`}>
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px bg-white/5">
                  <StatBox label="Interested" value={interestedCount.toString()} accent="#4ade80" />
                  <StatBox label="Closed" value={closedFromCalls.toString()} accent="#34d399" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/5 overflow-hidden rounded-full">
                    <div className="h-full bg-[#4ade80] transition-all" style={{ width: `${coldCallConversion}%` }} />
                  </div>
                  <p className="text-xs font-bold text-[#4ade80] tabular-nums shrink-0">{coldCallConversion}% conversion</p>
                </div>
              </div>

              {/* Generic channels table — collapsible */}
              <button
                onClick={() => setChannelTableOpen(o => !o)}
                className="flex items-center gap-2 text-[10px] tracking-[2px] uppercase text-[#444] hover:text-white transition-colors mb-2"
              >
                <span className={`transition-transform duration-200 ${channelTableOpen ? "rotate-90" : ""}`}>▶</span>
                Channel Breakdown {channelTableOpen ? "" : `(${genericChannels.length} channels)`}
              </button>
              {channelTableOpen && <div className="border border-white/5 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-left text-[10px] tracking-[1.5px] uppercase text-[#333] font-semibold">Channel</th>
                      <th className="px-4 py-3 text-right text-[10px] tracking-[1.5px] uppercase text-[#333] font-semibold">Leads</th>
                      <th className="px-4 py-3 text-right text-[10px] tracking-[1.5px] uppercase text-[#333] font-semibold">Clients</th>
                      <th className="px-4 py-3 text-right text-[10px] tracking-[1.5px] uppercase text-[#333] font-semibold">Conv %</th>
                      <th className="px-4 py-3 text-right text-[10px] tracking-[1.5px] uppercase text-[#333] font-semibold">Revenue</th>
                      <th className="px-4 py-3 text-right text-[10px] tracking-[1.5px] uppercase text-[#333] font-semibold">Tracking Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {genericChannels.map(ch => (
                      <tr key={ch.key} className={`hover:bg-white/[0.02] transition-colors ${ch.leads === 0 ? "opacity-40" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base leading-none">{ch.icon}</span>
                            <span className="font-medium text-white">{ch.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#888]">{ch.leads || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#4ade80]">{ch.clients || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {ch.leads > 0 ? (
                            <span className={ch.conversionRate >= 50 ? "text-[#4ade80]" : ch.conversionRate >= 20 ? "text-[#fbbf24]" : "text-[#888]"}>
                              {ch.conversionRate}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {ch.revenue > 0 ? <span className="text-[#4ade80]">${ch.revenue.toLocaleString()}</span> : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => copyLink(`${BASE_URL}/register?ref=${ch.key}`, ch.key)}
                            className="text-[10px] tracking-[1px] uppercase border border-white/10 px-2.5 py-1 text-[#555] hover:text-white hover:border-white/30 transition-all"
                          >
                            {copied === ch.key ? "Copied ✓" : "Copy Link"}
                          </button>
                        </td>
                      </tr>
                    ))}

                    {unattributed.length > 0 && (
                      <tr className="opacity-30 hover:opacity-50 transition-opacity">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base leading-none">❓</span>
                            <span className="font-medium">Unattributed</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#888]">{unattributed.length}</td>
                        <td className="px-4 py-3 text-right">—</td>
                        <td className="px-4 py-3 text-right">—</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {unattributed.reduce((s, c) => s + (c.total_revenue || 0), 0) > 0
                            ? `$${unattributed.reduce((s, c) => s + (c.total_revenue || 0), 0).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>}
            </div>

            {/* Email engagement — who opened/clicked pitch email links */}
            <div>
              <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-4">Email Outreach Engagement</p>
              {engagedContacts.length === 0 ? (
                <div className="border border-white/5 px-4 py-6 text-center">
                  <p className="text-xs text-[#444] italic">No link clicks yet — this fills in once leads click a link in a pitch email.</p>
                </div>
              ) : (
                <div className="border border-white/5 divide-y divide-white/5">
                  {engagedContacts.map(({ contactId, name, clicks }) => (
                    <div key={contactId} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                      <a href={`/admin/contacts/${contactId}`} className="flex-1 text-sm font-medium hover:underline min-w-0 truncate">{name}</a>
                      <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                        {clicks.slice(0, 4).map(c => (
                          <span key={c.id} className="text-[10px] tracking-wide text-[#60a5fa] bg-[#60a5fa]/10 px-2 py-0.5 rounded-full">
                            {SERVICE_LABELS[c.service] || c.service}
                          </span>
                        ))}
                        {clicks.length > 4 && <span className="text-[10px] text-[#444]">+{clicks.length - 4} more</span>}
                      </div>
                      <span className="text-[10px] text-[#444] shrink-0 w-24 text-right">
                        {new Date(clicks[0].clicked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top referrers */}
            {(() => {
              const map: Record<string, { name: string; count: number; revenue: number }> = {};
              for (const c of contacts) {
                if (!c.referred_by_contact_id) continue;
                if (!map[c.referred_by_contact_id]) {
                  const referrer = contacts.find(x => x.id === c.referred_by_contact_id);
                  map[c.referred_by_contact_id] = { name: referrer?.name || "Unknown", count: 0, revenue: 0 };
                }
                map[c.referred_by_contact_id].count++;
                map[c.referred_by_contact_id].revenue += c.total_revenue || 0;
              }
              const leaderboard = Object.entries(map).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue || b.count - a.count).slice(0, 10);
              if (leaderboard.length === 0) return null;
              return (
                <div>
                  <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-4">Top Referrers</p>
                  <div className="border border-white/5 divide-y divide-white/5">
                    {leaderboard.map((r, i) => (
                      <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                        <span className="text-[10px] tabular-nums text-[#333] w-4 shrink-0">{i + 1}</span>
                        <a href={`/admin/contacts/${r.id}`} className="flex-1 text-sm font-medium hover:underline">{r.name}</a>
                        <span className="text-xs text-[#555]">{r.count} referral{r.count !== 1 ? "s" : ""}</span>
                        {r.revenue > 0 && <span className="text-xs font-semibold text-[#4ade80]">${r.revenue.toLocaleString()}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Top clients by LTV */}
            {top10LTV.length > 0 && (
              <div>
                <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-4">Top Clients by Lifetime Value</p>
                <div className="border border-white/5 divide-y divide-white/5">
                  {top10LTV.map((c, i) => {
                    const shootCount = clientShootMap[c.id]?.length || 0;
                    return (
                      <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                        <span className="text-[10px] tabular-nums text-[#333] w-4 shrink-0">{i + 1}</span>
                        <a href={`/admin/contacts/${c.id}`} className="flex-1 text-sm font-medium hover:underline">{c.name}</a>
                        {shootCount > 0 && <span className="text-xs text-[#555]">{shootCount} shoot{shootCount !== 1 ? "s" : ""}</span>}
                        {shootCount >= 2 && <span className="text-[10px] tracking-wide text-[#a78bfa]">repeat</span>}
                        <span className="text-sm font-bold text-[#4ade80]">${(c.total_revenue || 0).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Referral link generator */}
            <div>
              <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-4">Referral Link Generator</p>
              <div className="border border-white/10 bg-[#111] p-5 space-y-3">
                <p className="text-xs text-[#666]">Generate a personal referral link for a specific client. When someone registers using their link, they&apos;ll be automatically attributed to that person.</p>
                <input
                  value={referralSearch}
                  onChange={e => setReferralSearch(e.target.value)}
                  placeholder="Search a contact by name..."
                  className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
                />
                {referralContacts.length > 0 && (
                  <div className="border border-white/5 divide-y divide-white/5">
                    {referralContacts.map(c => {
                      const link = `${BASE_URL}/register?ref=referral&by=${c.id}`;
                      return (
                        <div key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
                            <p className="text-[10px] text-[#444] font-mono truncate max-w-xs">{link}</p>
                          </div>
                          <button
                            onClick={() => copyLink(link, `ref-${c.id}`)}
                            className="shrink-0 text-[10px] tracking-[1px] uppercase border border-white/10 px-3 py-1.5 text-[#555] hover:text-white hover:border-white/30 transition-all"
                          >
                            {copied === `ref-${c.id}` ? "Copied ✓" : "Copy"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
