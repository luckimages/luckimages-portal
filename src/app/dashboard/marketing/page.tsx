"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const CHANNELS: { key: string; label: string; icon: string }[] = [
  { key: "referral",          label: "Referral",                  icon: "👥" },
  { key: "google-seo",        label: "Google SEO",                icon: "🔍" },
  { key: "google-business",   label: "Google Business Profile",   icon: "📍" },
  { key: "yelp",              label: "Yelp",                      icon: "⭐" },
  { key: "instagram",         label: "Instagram",                 icon: "📸" },
  { key: "facebook",          label: "Facebook",                  icon: "📘" },
  { key: "linkedin-business", label: "LinkedIn — Luck Images",    icon: "💼" },
  { key: "linkedin-personal", label: "LinkedIn — Ryan Luck",      icon: "🧑‍💼" },
  { key: "cold-call",         label: "Cold Calling",              icon: "📞" },
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

type ChannelStats = {
  key: string;
  label: string;
  icon: string;
  leads: number;
  clients: number;
  revenue: number;
  conversionRate: number;
};

const BASE_URL = "https://luckimages-portal.vercel.app";

export default function MarketingPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [referralSearch, setReferralSearch] = useState("");
  const [allContacts, setAllContacts] = useState<Contact[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("contacts")
      .select("id, name, type, stage, lead_source, total_revenue, created_at, referred_by_contact_id")
      .neq("stage", "deleted");
    setContacts(data || []);
    setAllContacts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyLink(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const channelStats: ChannelStats[] = CHANNELS.map(ch => {
    const matched = contacts.filter(c => c.lead_source === ch.key);
    const clients  = matched.filter(c => c.type === "realtor" || c.stage === "client" || (c.total_revenue || 0) > 0);
    const revenue  = matched.reduce((s, c) => s + (c.total_revenue || 0), 0);
    return {
      ...ch,
      leads: matched.length,
      clients: clients.length,
      revenue,
      conversionRate: matched.length > 0 ? Math.round((clients.length / matched.length) * 100) : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);

  const unattributed = contacts.filter(c => !c.lead_source);
  const totalLeads   = contacts.length;
  const totalClients = contacts.filter(c => c.type === "realtor" || (c.total_revenue || 0) > 0).length;
  const totalRevenue = contacts.reduce((s, c) => s + (c.total_revenue || 0), 0);
  const overallConversion = totalLeads > 0 ? Math.round((totalClients / totalLeads) * 100) : 0;

  const referralContacts = allContacts.filter(c =>
    referralSearch.length > 1 &&
    c.name.toLowerCase().includes(referralSearch.toLowerCase())
  ).slice(0, 6);

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-6">
          <a href="/" className="text-lg font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">← Dashboard</a>
        </div>
      </header>

      <div className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full space-y-10">

        {/* Title */}
        <div>
          <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-1">Attribution</p>
          <h1 className="text-2xl font-black tracking-tight uppercase">Marketing Metrics</h1>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5">
          {[
            { label: "Total Contacts", value: totalLeads.toString() },
            { label: "Converted Clients", value: totalClients.toString() },
            { label: "Conversion Rate", value: `${overallConversion}%` },
            { label: "Attributed Revenue", value: `$${totalRevenue.toLocaleString()}` },
          ].map(stat => (
            <div key={stat.label} className="bg-[#0c0c0c] px-5 py-5">
              <p className="text-2xl font-black tabular-nums text-white">{stat.value}</p>
              <p className="text-[10px] tracking-[1.5px] uppercase text-[#444] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
          </div>
        ) : (
          <>
            {/* Channel scoreboard */}
            <div>
              <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-4">Channel Breakdown</p>
              <div className="border border-white/5 overflow-x-auto">
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
                    {channelStats.map(ch => (
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

                    {/* Unattributed row */}
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
              </div>
            </div>

            {/* Top referrers leaderboard */}
            {(() => {
              // Build map: referrer contact_id → { count, revenue }
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
              const leaderboard = Object.entries(map)
                .map(([id, v]) => ({ id, ...v }))
                .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
                .slice(0, 10);

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
