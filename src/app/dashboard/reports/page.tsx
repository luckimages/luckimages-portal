"use client";

import { useEffect, useState } from "react";

type Row = {
  key: string;
  leads: number;
  clients: number;
  conversion: number;
  median_days_to_first_shoot: number | null;
  revenue_cents: number;
  ltv_cents: number;
};
type Report = { range: string; totals: Row; bySource: Row[]; byBrokerage: Row[]; bySourcedBy: Row[] };

const RANGES = [
  { key: "all", label: "All time" },
  { key: "365", label: "12 months" },
  { key: "90", label: "90 days" },
  { key: "30", label: "30 days" },
];

// Same keys as the contact page's lead-source picker.
const SOURCE_LABELS: Record<string, string> = {
  "referral": "Referral",
  "google-seo": "Google SEO",
  "google-business": "Google Business",
  "yelp": "Yelp",
  "instagram": "Instagram",
  "facebook": "Facebook",
  "linkedin-business": "LinkedIn (Luck Images)",
  "linkedin-personal": "LinkedIn (Ryan Luck)",
  "cold-call": "Cold Call",
  "cold-email": "Cold Email",
  "zillow": "Zillow / Realtor.com",
  "networking": "Networking",
  "partnership": "Partner Referral",
  "direct-mail": "Direct Mail",
  "website-form": "Website – Contact Form",
  "website-quote": "Website – Quote Request",
  "other": "Other",
  "unknown": "Not recorded",
};

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#111] border border-white/10 px-5 py-4">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">{label}</p>
      {sub && <p className="text-[10px] text-[#444] mt-0.5">{sub}</p>}
    </div>
  );
}

function Table({ title, note, rows, labelFor }: { title: string; note?: string; rows: Row[]; labelFor?: (key: string) => string }) {
  const maxRevenue = Math.max(1, ...rows.map(r => r.revenue_cents));
  return (
    <section className="bg-[#111] border border-white/10">
      <div className="px-5 py-3 border-b border-white/10">
        <p className="text-xs tracking-[2px] uppercase text-[#888] font-semibold">{title}</p>
        {note && <p className="text-[11px] text-[#444] mt-0.5">{note}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[#444] tracking-[1px] uppercase">
              <th className="text-left px-5 py-2.5 font-normal">Group</th>
              <th className="text-right px-3 py-2.5 font-normal">Leads</th>
              <th className="text-right px-3 py-2.5 font-normal">Clients</th>
              <th className="text-right px-3 py-2.5 font-normal">Conversion</th>
              <th className="text-right px-3 py-2.5 font-normal">Days to 1st shoot</th>
              <th className="text-right px-3 py-2.5 font-normal">Revenue</th>
              <th className="text-right px-5 py-2.5 font-normal">Per client</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-[#333] italic">No contacts in this range.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.key} className="border-b border-white/5">
                <td className="px-5 py-2.5">
                  <p className="text-white">{labelFor ? labelFor(r.key) : r.key}</p>
                  <div className="h-0.5 bg-white/5 mt-1.5 w-40">
                    <div className="h-full bg-[#4ade80]/60" style={{ width: `${(r.revenue_cents / maxRevenue) * 100}%` }} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#aaa]">{r.leads}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#aaa]">{r.clients}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-white">{pct(r.conversion)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#aaa]">{r.median_days_to_first_shoot ?? "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#4ade80] font-semibold">{money(r.revenue_cents)}</td>
                <td className="px-5 py-2.5 text-right tabular-nums text-[#aaa]">{r.clients ? money(r.ltv_cents) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ReportsPage() {
  const [range, setRange] = useState("all");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/reports?range=${range}`)
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) { setError(d.error || "Couldn't load reports."); return; }
        setError("");
        setReport(d);
      })
      .catch(() => { if (!cancelled) setError("Couldn't load reports."); });
    return () => { cancelled = true; };
  }, [range]);

  const loading = !report || report.range !== range;
  const t = report?.totals;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="px-4 md:px-8 py-8 w-full space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-1">Command Center</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">Reports</h1>
            <p className="text-xs text-[#444] mt-1">Where clients and revenue come from. Groups are contacts added in the selected range; revenue is every paid invoice from those contacts.</p>
          </div>
          <div className="flex border border-white/10">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`text-[10px] tracking-[1px] uppercase px-4 py-2 transition-colors ${range === r.key ? "bg-white text-black font-bold" : "text-[#666] hover:text-white"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {loading && !error ? (
          <p className="text-xs tracking-[3px] uppercase text-[#444] py-20 text-center">Loading...</p>
        ) : report && t && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <Tile label="Leads" value={t.leads.toLocaleString()} />
              <Tile label="Became clients" value={t.clients.toLocaleString()} />
              <Tile label="Conversion" value={pct(t.conversion)} />
              <Tile label="Days to 1st shoot" value={t.median_days_to_first_shoot != null ? String(t.median_days_to_first_shoot) : "—"} sub="median" />
              <Tile label="Revenue (paid)" value={money(t.revenue_cents)} />
              <Tile label="Per client" value={t.clients ? money(t.ltv_cents) : "—"} sub="lifetime, average" />
            </div>

            <Table title="By Lead Source" rows={report.bySource} labelFor={k => SOURCE_LABELS[k] || k}
              note="“Not recorded” = contacts with no lead source set — filling those in on older contacts makes this sharper." />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <Table title="By Brokerage" rows={report.byBrokerage} note="Top 25 by revenue." />
              <Table title="By Who Generated the Lead" rows={report.bySourcedBy} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
