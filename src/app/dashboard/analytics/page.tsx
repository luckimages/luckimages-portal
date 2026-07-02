"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";
import HelpTip from "@/components/HelpTip";

type AnalyticsData = {
  days: number;
  uniqueVisitors: number;
  registeredVisitors: number;
  anonymousVisitors: number;
  pageviews: number;
  avgDurationSeconds: number;
  topPages: { path: string; count: number }[];
  topReferrers: { source: string; count: number }[];
  dailyTraffic: { date: string; visitors: number; views: number }[];
  newRegistrations: number;
  newRegistrationDetails: { id: string; name: string; email: string; contactId: string | null; createdAt: string }[];
  funnel: { visitors: number; quoteRequests: number; registrations: number };
  devices: { key: string; count: number }[];
  browsers: { key: string; count: number }[];
  topCountries: { key: string; count: number }[];
  topCities: { key: string; count: number }[];
  servicePerformance: { name: string; slug: string; count: number }[];
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
  const [showRegistrations, setShowRegistrations] = useState(false);

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
              <HelpTip title="Website Analytics" content="Tracks visits to luckimages.com's public pages (home, services, pricing, about, contact) — not the portal or admin tools. Unique visitors are counted per browser session. Time on page is measured until the visitor leaves or switches tabs. Location (country/city) comes from Vercel's edge network, not stored IP addresses. The funnel connects visitors → quote requests → portal registrations so you can see where the drop-off is." />
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
                <p className="text-[10px] text-[#444] mt-1.5">
                  <span className="text-[#4ade80]">{data.registeredVisitors}</span> registered · <span className="text-white/50">{data.anonymousVisitors}</span> anonymous
                </p>
              </div>
              <div className="border border-white/10 p-5">
                <p className="text-3xl font-black">{data.pageviews.toLocaleString()}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Page Views</p>
              </div>
              <div className="border border-white/10 p-5">
                <p className="text-3xl font-black">{formatDuration(data.avgDurationSeconds)}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Avg. Time on Page</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRegistrations((v) => !v)}
                disabled={data.newRegistrations === 0}
                className="border border-[#4ade80]/20 bg-[#4ade80]/5 p-5 text-left hover:border-[#4ade80]/40 hover:bg-[#4ade80]/10 transition-colors disabled:cursor-default disabled:hover:border-[#4ade80]/20 disabled:hover:bg-[#4ade80]/5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-3xl font-black text-[#4ade80]">{data.newRegistrations.toLocaleString()}</p>
                  {data.newRegistrations > 0 && <span className="text-[#4ade80]/60 text-xs">{showRegistrations ? "▾" : "▸"}</span>}
                </div>
                <p className="text-[10px] tracking-[2px] uppercase text-[#4ade80]/70 mt-1">New Portal Registrations</p>
              </button>
            </div>

            {/* Registrations dropdown */}
            {showRegistrations && data.newRegistrationDetails.length > 0 && (
              <div className="border border-[#4ade80]/20 divide-y divide-[#4ade80]/10 -mt-6">
                {data.newRegistrationDetails.map((r) => {
                  const dt = new Date(r.createdAt);
                  const inner = (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{r.name}</p>
                        {r.email && <p className="text-xs text-[#666]">{r.email}</p>}
                      </div>
                      <span className="text-[10px] text-[#444] shrink-0">
                        {dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      {r.contactId && <span className="text-[10px] tracking-[1.5px] uppercase text-[#4ade80] shrink-0">View →</span>}
                    </>
                  );
                  return r.contactId ? (
                    <a key={r.id} href={`/admin/contacts/${r.contactId}`} className="flex items-center gap-4 px-5 py-3 hover:bg-[#4ade80]/5 transition-colors">
                      {inner}
                    </a>
                  ) : (
                    <div key={r.id} className="flex items-center gap-4 px-5 py-3 opacity-60">
                      {inner}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Traffic chart */}
            <section>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                Daily Traffic
              </p>
              {data.pageviews === 0 ? (
                <p className="text-sm text-[#444] py-10 text-center border border-white/10">No traffic recorded yet in this range.</p>
              ) : (
                <div className="border border-white/10 p-6">
                  <div className="flex gap-[2px] h-40">
                    {data.dailyTraffic.map((d, i) => {
                      const isToday = i === data.dailyTraffic.length - 1;
                      const dt = new Date(d.date + "T00:00:00");
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-end justify-end group relative">
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white whitespace-nowrap bg-[#1a1a1a] px-2 py-1 border border-white/10 z-10 pointer-events-none">
                            {dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {d.views} views, {d.visitors} visitors
                          </div>
                          <div
                            className={`w-full transition-colors ${isToday ? "bg-[#4ade80]/60 group-hover:bg-[#4ade80]" : "bg-[#a78bfa]/40 group-hover:bg-[#a78bfa]"}`}
                            style={{ height: `${Math.max(3, (d.views / maxViews) * 100)}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-[2px] mt-2">
                    {data.dailyTraffic.map((d, i) => {
                      const labelEvery = Math.ceil(data.dailyTraffic.length / 8);
                      const isToday = i === data.dailyTraffic.length - 1;
                      const showLabel = i % labelEvery === 0 || isToday;
                      const dt = new Date(d.date + "T00:00:00");
                      return (
                        <div key={d.date} className="flex-1 text-center">
                          {showLabel && (
                            <span className="text-[9px] text-[#444] whitespace-nowrap">
                              {dt.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      );
                    })}
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

            {/* Funnel */}
            <section>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                Funnel
              </p>
              <div className="border border-white/10 p-6 flex flex-col md:flex-row items-stretch gap-4">
                {[
                  { label: "Visitors", value: data.funnel.visitors, color: "#a78bfa" },
                  { label: "Quote Requests", value: data.funnel.quoteRequests, color: "#f472b6" },
                  { label: "Registrations", value: data.funnel.registrations, color: "#4ade80" },
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
            </section>

            {/* Service page performance */}
            <section>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                Service Page Performance
              </p>
              {data.servicePerformance.every((s) => s.count === 0) ? (
                <p className="text-sm text-[#444]">No service page visits yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.servicePerformance.map((s) => {
                    const max = Math.max(1, ...data.servicePerformance.map((x) => x.count));
                    return (
                      <div key={s.slug} className="flex items-center gap-4">
                        <span className="text-sm text-white/80 w-40 shrink-0">{s.name}</span>
                        <div className="flex-1 bg-white/5 h-2">
                          <div className="h-full bg-[#a78bfa]" style={{ width: `${(s.count / max) * 100}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-[#a78bfa] w-8 text-right shrink-0">{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Devices + Browsers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  Devices
                </p>
                {data.devices.length === 0 ? (
                  <p className="text-sm text-[#444]">No data yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.devices.map((d) => (
                      <div key={d.key} className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-sm text-white/80">{d.key}</span>
                        <span className="text-sm font-semibold text-[#a78bfa]">{d.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  Browsers
                </p>
                {data.browsers.length === 0 ? (
                  <p className="text-sm text-[#444]">No data yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.browsers.map((b) => (
                      <div key={b.key} className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-sm text-white/80">{b.key}</span>
                        <span className="text-sm font-semibold text-[#a78bfa]">{b.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Geographic */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  Top Countries
                </p>
                {data.topCountries.length === 0 ? (
                  <p className="text-sm text-[#444]">No location data yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.topCountries.map((c) => (
                      <div key={c.key} className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-sm text-white/80">{c.key}</span>
                        <span className="text-sm font-semibold text-[#a78bfa]">{c.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-5 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  Top Cities
                </p>
                {data.topCities.length === 0 ? (
                  <p className="text-sm text-[#444]">No location data yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.topCities.map((c) => (
                      <div key={c.key} className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-sm text-white/80">{c.key}</span>
                        <span className="text-sm font-semibold text-[#a78bfa]">{c.count}</span>
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
