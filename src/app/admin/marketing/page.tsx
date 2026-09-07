"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

type CallLog = { id: string; contact_id: string | null; called_at: string; outcome: string; notes: string | null };
type Contact = { id: string; name: string; stage: string };

const CHANNEL_PLACEHOLDER = "text-[10px] tracking-[2px] uppercase text-[#444]";

function StatBox({ label, value, sub, accent = "white" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#111] border border-white/10 p-5">
      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-3">{label}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs text-[#444] mt-2">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-[''] flex-1">
        {title}
      </p>
      {badge && <span className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 border border-white/10 text-[#444]">{badge}</span>}
    </div>
  );
}

function PlaceholderChannel({ title, description }: { title: string; description: string }) {
  return (
    <section>
      <SectionHeader title={title} badge="Coming Soon" />
      <div className="bg-[#111] border border-white/5 border-dashed p-8 text-center">
        <p className="text-xs text-[#333] tracking-[2px] uppercase mb-2">{title}</p>
        <p className="text-xs text-[#2a2a2a]">{description}</p>
      </div>
    </section>
  );
}

export default function MarketingPage() {
  const router = useRouter();
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "all">("month");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) { router.replace("/dashboard"); return; }
      const [{ data: logs }, { data: cts }] = await Promise.all([
        supabase.from("cold_calls").select("*").order("called_at", { ascending: false }),
        supabase.from("contacts").select("id, name, stage").order("name"),
      ]);
      setCallLogs(logs || []);
      setContacts(cts || []);
      setLoading(false);
    });
  }, [router]);

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  const monthStr = now.toISOString().slice(0, 7);

  const filteredLogs = callLogs.filter(l => {
    if (timeRange === "week") return new Date(l.called_at) >= weekStart;
    if (timeRange === "month") return l.called_at.startsWith(monthStr);
    return true;
  });

  // Cold calling stats
  const totalCalls = filteredLogs.length;
  const leadLogs = filteredLogs.filter(l => ["interested","callback","booked"].includes(l.outcome));
  const calledIds = new Set(filteredLogs.map(l => l.contact_id).filter(Boolean));
  const conversions = contacts.filter(c => calledIds.has(c.id) && (c.stage === "client" || c.stage === "booked")).length;
  const convPct = calledIds.size > 0 ? Math.round((conversions / calledIds.size) * 100) : 0;
  const noAnswerCount = filteredLogs.filter(l => l.outcome === "no_answer" || l.outcome === "no-answer").length;
  const callbackCount = filteredLogs.filter(l => l.outcome === "callback").length;
  const notInterestedCount = filteredLogs.filter(l => l.outcome === "not_interested" || l.outcome === "not-interested").length;

  // Monthly breakdown (last 6 months)
  const monthlyData: { month: string; calls: number; leads: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.toISOString().slice(0, 7);
    const monthLogs = callLogs.filter(l => l.called_at.startsWith(m));
    monthlyData.push({
      month: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      calls: monthLogs.length,
      leads: monthLogs.filter(l => ["interested","callback","booked"].includes(l.outcome)).length,
    });
  }
  const maxCalls = Math.max(...monthlyData.map(m => m.calls), 1);

  // Recent call log
  const recentLogs = filteredLogs.slice(0, 30);
  const contactNameMap = Object.fromEntries(contacts.map(c => [c.id, c.name]));

  const outcomeLabel: Record<string, { label: string; color: string }> = {
    interested: { label: "Interested", color: "text-[#4ade80]" },
    booked: { label: "Booked", color: "text-[#4ade80]" },
    callback: { label: "Callback", color: "text-[#fbbf24]" },
    no_answer: { label: "No Answer", color: "text-[#555]" },
    "no-answer": { label: "No Answer", color: "text-[#555]" },
    not_interested: { label: "Not Interested", color: "text-[#ef4444]" },
    "not-interested": { label: "Not Interested", color: "text-[#ef4444]" },
    voicemail: { label: "Voicemail", color: "text-[#888]" },
    other: { label: "Other", color: "text-[#555]" },
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">

      {/* Header */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center gap-4 flex-wrap">
        <button onClick={() => router.push("/dashboard?page=apps")} className="text-[#555] text-sm hover:text-white transition-colors">← Dashboard</button>
        <h1 className="text-sm font-bold tracking-[3px] uppercase">Marketing</h1>
        <div className="flex-1" />
        <div className="flex border border-white/10 overflow-hidden">
          {(["week","month","all"] as const).map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={`text-xs tracking-[1px] uppercase px-4 py-2 transition-colors ${timeRange === r ? "bg-white text-black font-bold" : "text-[#555] hover:text-white"}`}>
              {r === "week" ? "This Week" : r === "month" ? "This Month" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-xs text-[#444] tracking-[3px] uppercase">Loading...</div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-12">

          {/* ── COLD CALLING ── */}
          <section>
            <SectionHeader title="Cold Calling" />
            <div className="space-y-4">
              {/* Key stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox label="Calls Made" value={totalCalls.toString()} />
                <StatBox label="Leads" value={leadLogs.length.toString()} accent="#60a5fa" sub="Interested / callback / booked" />
                <StatBox label="Conversions" value={conversions.toString()} accent="#4ade80" sub="Leads who became clients" />
                <StatBox label="Conv. Rate" value={calledIds.size > 0 ? `${convPct}%` : "—"} accent="#4ade80" sub={`${conversions} of ${calledIds.size} unique contacts`} />
              </div>

              {/* Outcome breakdown */}
              <div className="bg-[#111] border border-white/10">
                <div className="px-5 py-3 border-b border-white/10">
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Outcome Breakdown</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/5">
                  {[
                    { label: "No Answer", value: noAnswerCount, color: "#555" },
                    { label: "Callback", value: callbackCount, color: "#fbbf24" },
                    { label: "Not Interested", value: notInterestedCount, color: "#ef4444" },
                    { label: "Interested / Booked", value: leadLogs.length, color: "#4ade80" },
                  ].map(item => (
                    <div key={item.label} className="px-5 py-4 text-center">
                      <p className="text-2xl font-bold tabular-nums" style={{ color: item.color }}>{item.value}</p>
                      <p className="text-[10px] tracking-[1px] uppercase text-[#444] mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly bar chart */}
              <div className="bg-[#111] border border-white/10 p-5">
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-4">Monthly Trend — Last 6 Months</p>
                <div className="flex items-end gap-2 h-24">
                  {monthlyData.map(m => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: "72px" }}>
                        <div className="w-full bg-[#60a5fa]/40 rounded-sm transition-all"
                          style={{ height: `${m.calls > 0 ? Math.max(4, Math.round((m.calls / maxCalls) * 64)) : 0}px` }} />
                      </div>
                      <p className="text-[9px] text-[#444] tracking-[1px] uppercase">{m.month}</p>
                      <p className="text-[10px] text-[#666] font-bold">{m.calls}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent call log */}
              {recentLogs.length > 0 && (
                <div className="bg-[#111] border border-white/10 overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                    <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Recent Calls</p>
                    <a href="/admin/cold-calls" className="text-[10px] tracking-[1px] uppercase text-[#444] hover:text-white transition-colors">Start Calling →</a>
                  </div>
                  <div className="divide-y divide-white/5">
                    {recentLogs.map(log => {
                      const oc = outcomeLabel[log.outcome] || { label: log.outcome, color: "text-[#555]" };
                      return (
                        <div key={log.id} className="px-5 py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{log.contact_id ? (contactNameMap[log.contact_id] || "Unknown") : "—"}</p>
                            {log.notes && <p className="text-xs text-[#444] truncate mt-0.5">{log.notes}</p>}
                          </div>
                          <span className={`text-xs uppercase tracking-[1px] shrink-0 ${oc.color}`}>{oc.label}</span>
                          <span className="text-xs text-[#444] shrink-0">
                            {new Date(log.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── REFERRALS ── */}
          <PlaceholderChannel
            title="Referrals"
            description="Track referrals from past clients, agents, and partners. Connect when referral tracking is set up."
          />

          {/* ── GOOGLE BUSINESS ── */}
          <PlaceholderChannel
            title="Google Business Profile"
            description="Views, calls, and direction requests from your Google Business listing. Connect via Google Business API."
          />

          {/* ── META ── */}
          <PlaceholderChannel
            title="Meta Ads / Instagram"
            description="Impressions, clicks, leads, and ad spend from Facebook & Instagram campaigns. Connect via Meta Ads API."
          />

          {/* ── SEO ── */}
          <PlaceholderChannel
            title="Google SEO"
            description="Organic search impressions, clicks, and keyword rankings. Connect via Google Search Console API."
          />

        </div>
      )}
    </div>
  );
}
