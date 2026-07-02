"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import InsightsPage from "../InsightsPage";
import HelpTip from "@/components/HelpTip";

const supabase = createClient();

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  status: string;
  price: number | null;
  contact_id: string | null;
  services: string[];
};

type Contact = {
  id: string;
  name: string;
  email: string | null;
  type: string;
  created_at: string;
  stage?: string;
};

type QBSnapshot = {
  rev_month: number;
  rev_ytd: number;
  net_income: number;
  expenses_ytd: number;
  ytd_invoices: number;
  unpaid_count: number;
  monthly_breakdown: Record<string, number>;
  synced_at: string | null;
};

type WebLead = {
  id: string;
  name: string;
  email: string | null;
  sqft: string | null;
  primary_service: string | null;
  primary_price: number | null;
  addons: { name: string; price: number }[];
  total: number | null;
  converted_contact_id: string | null;
  created_at: string;
};

export default function BetaPage() {
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const [snapshot, setSnapshot] = useState<QBSnapshot | null>(null);
  const [leads, setLeads] = useState<WebLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [{ data: sh }, { data: cs }] = await Promise.all([
        supabase
          .from("shoots")
          .select("id, address, scheduled_at, status, price, contact_id, services")
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("contacts")
          .select("id, name, email, type, created_at, stage")
          .neq("stage", "deleted"),
      ]);
      setShoots(sh ?? []);
      setContacts(cs ?? []);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    fetch("/api/admin/web-leads")
      .then(r => r.ok ? r.json() : [])
      .then(d => { setLeads(d); setLeadsLoading(false); });

    supabase.from("kpi_snapshots").select("*").eq("id", 1).single()
      .then(({ data }) => { if (data) setSnapshot(data); });
  }, []);

  async function convertToContact(lead: WebLead) {
    setConverting(lead.id);
    const res = await fetch("/api/admin/web-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, name: lead.name, email: lead.email }),
    });
    if (res.ok) {
      const { contact } = await res.json();
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, converted_contact_id: contact.id } : l));
    }
    setConverting(null);
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10 gap-4">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <a href="/choose-portal" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Portals</a>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Dashboard</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto w-full space-y-16">

        {/* Beta Tools */}
        <section>
          <div className="mb-6">
            <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-1">Beta Tools</p>
            <h2 className="text-2xl font-black tracking-tight uppercase">New Features</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <a href="/dashboard/board" className="border border-[#a78bfa]/20 bg-[#a78bfa]/5 rounded-sm p-4 flex flex-col gap-2 hover:border-[#a78bfa]/40 hover:bg-[#a78bfa]/10 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[2px] uppercase text-[#a78bfa] font-semibold">Live</span>
                <span className="text-[10px] text-[#444] group-hover:text-[#a78bfa] transition-colors">→</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black uppercase tracking-tight text-white">Shoot Board</p>
                <HelpTip title="Shoot Board" content="6-stage Kanban (Pending → Paid) tracking every active shoot. Cards turn red when a photographer hasn't checked in, editing is overdue, or an invoice is unpaid 24h+. Click any card to expand full shoot details. Auto-refreshes every 30 seconds." />
              </div>
              <p className="text-[11px] text-[#555] leading-snug">Full-width Kanban board tracking every active shoot through the workflow in real time.</p>
            </a>
            <a href="/dashboard/import" className="border border-[#a78bfa]/20 bg-[#a78bfa]/5 rounded-sm p-4 flex flex-col gap-2 hover:border-[#a78bfa]/40 hover:bg-[#a78bfa]/10 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[2px] uppercase text-[#a78bfa] font-semibold">New</span>
                <span className="text-[10px] text-[#444] group-hover:text-[#a78bfa] transition-colors">→</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black uppercase tracking-tight text-white">Import Past Shoots</p>
                <HelpTip title="Import Past Shoots" content="Upload a CSV of past shoots (address, date, client name, services, price, status). New contacts are created automatically if not found. Required columns: address, scheduled_at. Supports up to 5,000 rows." />
              </div>
              <p className="text-[11px] text-[#555] leading-snug">Bulk-import historical shoot data from a CSV. Auto-matches or creates contacts.</p>
            </a>
            <a href="/dashboard/outreach" className="border border-[#f472b6]/20 bg-[#f472b6]/5 rounded-sm p-4 flex flex-col gap-2 hover:border-[#f472b6]/40 hover:bg-[#f472b6]/10 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[2px] uppercase text-[#f472b6] font-semibold">New</span>
                <span className="text-[10px] text-[#444] group-hover:text-[#f472b6] transition-colors">→</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black uppercase tracking-tight text-white">Email Outreach</p>
                <HelpTip title="Email Outreach" content="11 preset HTML email templates: portal invite, Google review request, thank you, referral ask, portfolio feature, re-engagement, lapsed win-back, upsell, pre-shoot checklist, seasonal promo, and new service launch. Pick a template, select contacts from your list, preview the live HTML, then send. Requires RESEND_API_KEY in Vercel env vars." />
              </div>
              <p className="text-[11px] text-[#555] leading-snug">11 preset campaigns with live HTML preview. Select contacts, preview, send.</p>
            </a>
            <a href="/dashboard/marketing" className="border border-[#a78bfa]/20 bg-[#a78bfa]/5 rounded-sm p-4 flex flex-col gap-2 hover:border-[#a78bfa]/40 hover:bg-[#a78bfa]/10 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[2px] uppercase text-[#a78bfa] font-semibold">New</span>
                <span className="text-[10px] text-[#444] group-hover:text-[#a78bfa] transition-colors">→</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black uppercase tracking-tight text-white">Marketing Metrics</p>
                <HelpTip title="Marketing Metrics" content="Tracks where every client came from across 14 channels (Instagram, Google, referral, etc.). Generates trackable registration links per channel or per person for referrals. When someone signs up via that link their source is recorded automatically — no manual tagging needed." />
              </div>
              <p className="text-[11px] text-[#555] leading-snug">Channel attribution, conversion rates, revenue by source, and referral link generator.</p>
            </a>
            <a href="/dashboard/calendar" className="border border-[#4ade80]/20 bg-[#4ade80]/5 rounded-sm p-4 flex flex-col gap-2 hover:border-[#4ade80]/40 hover:bg-[#4ade80]/10 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[2px] uppercase text-[#4ade80] font-semibold">New</span>
                <span className="text-[10px] text-[#444] group-hover:text-[#4ade80] transition-colors">→</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black uppercase tracking-tight text-white">Master Calendar</p>
                <HelpTip title="Master Calendar" content="One calendar that shows everything: shoots scheduled/delivered/paid (green), new contacts added (yellow), cold calls logged (blue), app/platform updates (purple), and Ryan & Leif's clock-in/clock-out entries (orange). Click any day to see a full list of everything that happened. Use the legend chips at the top to filter by type." />
              </div>
              <p className="text-[11px] text-[#555] leading-snug">Unified calendar — shoots, deliveries, payments, contacts, calls, updates, timesheets.</p>
            </a>
            <a href="/dashboard/analytics" className="border border-[#a78bfa]/20 bg-[#a78bfa]/5 rounded-sm p-4 flex flex-col gap-2 hover:border-[#a78bfa]/40 hover:bg-[#a78bfa]/10 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[2px] uppercase text-[#a78bfa] font-semibold">New</span>
                <span className="text-[10px] text-[#444] group-hover:text-[#a78bfa] transition-colors">→</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black uppercase tracking-tight text-white">Traffic Analytics</p>
                <HelpTip title="Traffic Analytics" content="Tracks visits to luckimages.com's public pages: unique visitors, page views, average time on page, top pages, and traffic sources (referrers). Also shows new portal registrations in the same window so you can see visits alongside conversions. Doesn't track the portal or admin tools — only public marketing pages." />
              </div>
              <p className="text-[11px] text-[#555] leading-snug">Visitors, time on page, top pages, referral sources, and new registrations.</p>
            </a>
          </div>
        </section>

        {/* Web Leads */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-1">Live Tracking</p>
              <h2 className="text-2xl font-black tracking-tight uppercase">Website Quote Requests</h2>
            </div>
            <span className="text-xs text-[#444]">{leads.length} submission{leads.length !== 1 ? "s" : ""}</span>
          </div>

          {leadsLoading ? (
            <div className="flex items-center justify-center py-20 border border-white/10">
              <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-white/10 gap-2">
              <p className="text-sm text-[#444]">No quote requests yet.</p>
              <p className="text-xs text-[#333]">They'll appear here when someone uses the quote form at luckimages.com/quote</p>
            </div>
          ) : (
            <div className="border border-white/10 divide-y divide-white/5">
              {leads.map(lead => {
                const expanded = expandedLead === lead.id;
                const dt = new Date(lead.created_at);
                const isConverted = !!lead.converted_contact_id;
                return (
                  <div key={lead.id}>
                    {/* Row */}
                    <button
                      onClick={() => setExpandedLead(expanded ? null : lead.id)}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
                    >
                      <span className="text-[#444] text-xs shrink-0">{expanded ? "▾" : "▸"}</span>

                      {/* Name + email */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{lead.name}</span>
                          {lead.email && <span className="text-xs text-[#555]">{lead.email}</span>}
                        </div>
                        <p className="text-[10px] text-[#444] mt-0.5">
                          {dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          {" · "}
                          {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>

                      {/* Service summary */}
                      {lead.primary_service && (
                        <span className="text-xs text-[#555] shrink-0 hidden sm:inline">{lead.primary_service}</span>
                      )}

                      {/* Converted badge */}
                      <span className={`text-[10px] tracking-[1.5px] uppercase px-2 py-1 shrink-0 ${isConverted ? "bg-[#4ade80]/10 text-[#4ade80]" : "bg-white/5 text-[#555]"}`}>
                        {isConverted ? "Profile Created" : "New Lead"}
                      </span>

                      {/* Total */}
                      {lead.total && (
                        <span className="text-base font-bold text-white shrink-0">${lead.total.toLocaleString()}</span>
                      )}
                    </button>

                    {/* Expanded */}
                    {expanded && (
                      <div className="px-8 pb-6 pt-2 flex flex-col gap-4 bg-white/[0.015]">
                        {/* Quote breakdown */}
                        <div className="flex flex-col gap-1.5 border-l-2 border-white/10 pl-4">
                          {lead.primary_service && (
                            <div className="flex justify-between text-xs">
                              <span className="text-white">{lead.primary_service}</span>
                              <span className="text-[#888]">${lead.primary_price}</span>
                            </div>
                          )}
                          {(lead.addons ?? []).map((a, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-[#666]">{a.name}</span>
                              <span className="text-[#666]">${a.price}</span>
                            </div>
                          ))}
                          {lead.total && (
                            <div className="flex justify-between text-xs border-t border-white/10 pt-1.5 mt-0.5">
                              <span className="text-white font-semibold">Total</span>
                              <span className="text-white font-semibold">${lead.total.toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {/* Meta */}
                        <div className="flex flex-col gap-1 text-[10px] text-[#444]">
                          {lead.sqft && <span>Square footage: {lead.sqft} sq ft</span>}
                          <span>Submitted: {dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-1">
                          {isConverted ? (
                            <a
                              href={`/admin/contacts/${lead.converted_contact_id}`}
                              className="text-xs tracking-[1px] uppercase px-4 py-2 border border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/5 transition-colors"
                            >
                              View Profile →
                            </a>
                          ) : (
                            <button
                              onClick={() => convertToContact(lead)}
                              disabled={converting === lead.id}
                              className="text-xs tracking-[1px] uppercase px-4 py-2 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40"
                            >
                              {converting === lead.id ? "Creating..." : "Create Profile"}
                            </button>
                          )}
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="text-xs text-[#555] hover:text-white transition-colors">
                              Email {lead.name.split(" ")[0]} →
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Insights */}
        <section>
          <div className="mb-6">
            <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-1">Beta Testing</p>
            <h2 className="text-2xl font-black tracking-tight uppercase">Insights</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
            </div>
          ) : (
            <InsightsPage shoots={shoots} contacts={contacts} snapshot={snapshot} />
          )}
        </section>

      </div>
    </main>
  );
}
