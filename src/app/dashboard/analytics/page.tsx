"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";
import HelpTip from "@/components/HelpTip";

type AnalyticsData = {
  days: number;
  uniqueVisitors: number;
  pageviews: number;
  avgDurationSeconds: number;
  topPages: { path: string; count: number }[];
  topReferrers: { source: string; count: number }[];
  dailyTraffic: { date: string; visitors: number; views: number }[];
  newRegistrations: number;
};

const RANGE_OPTIONS = [7, 30, 90];

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatPath(path: string) {
  return path === "/" ? "Homepage" : path;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [range, setRange] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
    });
  }, [router]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/website-analytics?days=${range}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); });
  }, [range]);

  const maxViews = data ? Math.max(1, ...data.dailyTraffic.map((d) => d.views)) : 1;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10 gap-4">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <a href="/dashboard/beta" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Beta</a>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Dashboard</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 py-8 md:py-12 max-w-6xl mx-auto w-full space-y-10">

        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs tracking-[4px] uppercase text-[#a78bfa]">Website</p>
              <HelpTip title="Website Analytics" content="Tracks visits to luckimages.com's public pages (home, services, pricing, about, contact) — not the portal or admin tools. Unique visitors are counted per browser session. Time on page is measured until the visitor leaves or switches tabs." />
            </div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Traffic Analytics</h1>
          </div>
          <div className="flex gap-2">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-xs tracking-[2px] uppercase px-4 py-2 border transition-colors ${range === r ? "border-white text-white bg-white/10" : "border-white/15 text-[#666] hover:text-white hover:border-white/30"}`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border border-white/10 p-5">
                <p className="text-3xl font-black">{data.uniqueVisitors.toLocaleString()}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Unique Visitors</p>
              </div>
              <div className="border border-white/10 p-5">
                <p className="text-3xl font-black">{data.pageviews.toLocaleString()}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Page Views</p>
              </div>
              <div className="border border-white/10 p-5">
                <p className="text-3xl font-black">{formatDuration(data.avgDurationSeconds)}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Avg. Time on Page</p>
              </div>
              <div className="border border-[#4ade80]/20 bg-[#4ade80]/5 p-5">
                <p className="text-3xl font-black text-[#4ade80]">{data.newRegistrations.toLocaleString()}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#4ade80]/70 mt-1">New Portal Registrations</p>
              </div>
            </div>

            {/* Traffic chart */}
            <section>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                Daily Traffic
              </p>
              {data.dailyTraffic.length === 0 ? (
                <p className="text-sm text-[#444] py-10 text-center border border-white/10">No traffic recorded yet in this range.</p>
              ) : (
                <div className="border border-white/10 p-6">
                  <div className="flex gap-1 h-40">
                    {data.dailyTraffic.map((d) => (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                        <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white whitespace-nowrap bg-[#1a1a1a] px-2 py-1 border border-white/10 z-10">
                          {d.date} — {d.views} views, {d.visitors} visitors
                        </div>
                        <div
                          className="w-full bg-[#a78bfa]/40 group-hover:bg-[#a78bfa] transition-colors"
                          style={{ height: `${Math.max(4, (d.views / maxViews) * 100)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Top pages + referrers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  Top Pages
                </p>
                {data.topPages.length === 0 ? (
                  <p className="text-sm text-[#444]">No data yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.topPages.map((p) => (
                      <div key={p.path} className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-sm text-white/80">{formatPath(p.path)}</span>
                        <span className="text-sm font-semibold text-[#a78bfa]">{p.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  Traffic Sources
                </p>
                {data.topReferrers.length === 0 ? (
                  <p className="text-sm text-[#444]">No data yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.topReferrers.map((r) => (
                      <div key={r.source} className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-sm text-white/80">{r.source}</span>
                        <span className="text-sm font-semibold text-[#a78bfa]">{r.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
