"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

// QB data — synced June 10, 2026
const QB = {
  revMonth: 640,
  revYTD: 10095,
  shootsAllTime: 231,
  ytdInvoices: 39,
  newClients: 20,
  repeatClients: 6,
  services: {
    photos: 11,
    drone: 47,
    matterport: 1,
    video: 1,
    headshots: 0,
  },
  recentInvoices: [
    { num: "1254", client: "Mrs Natasha Park", date: "Jun 5", amount: "$200", paid: false },
    { num: "1253", client: "Candice Putter", date: "Jun 4", amount: "$150", paid: false },
    { num: "1252", client: "Beverly Ortiz", date: "Jun 4", amount: "$150", paid: false },
    { num: "1251", client: "Mackenzie Smith", date: "Jun 4", amount: "$140", paid: false },
    { num: "1249", client: "Elizabeth Spiva", date: "May 16", amount: "$2,400", paid: false },
    { num: "1248", client: "Mr Doyle Wilson", date: "May 4", amount: "$450", paid: true },
    { num: "1246", client: "Mr Greg Gibson", date: "Apr 30", amount: "$300", paid: true },
    { num: "1245", client: "Mrs Iris Tombari", date: "Apr 24", amount: "$150", paid: true },
  ],
  monthly: [
    { month: "Jan", rev: 700 },
    { month: "Feb", rev: 1680 },
    { month: "Mar", rev: 2575 },
    { month: "Apr", rev: 1650 },
    { month: "May", rev: 2850 },
    { month: "Jun", rev: 640 },
  ],
};

function Card({ label, value, sub, accent = "#ffffff", children }: {
  label: string; value?: string; sub?: string; accent?: string; children?: React.ReactNode;
}) {
  return (
    <div className="bg-[#111] border border-white/10 p-6" style={{ borderBottom: `2px solid ${accent}` }}>
      <p className="text-xs tracking-[2px] uppercase text-[#666] mb-4">{label}</p>
      {value && <p className="text-3xl font-bold">{value}</p>}
      {sub && <p className="text-xs text-[#444] mt-2">{sub}</p>}
      {children}
    </div>
  );
}

function EditableNumber({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="bg-transparent text-3xl font-bold w-full outline-none border-b border-transparent focus:border-white/20 pb-0.5 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

export default function DashboardPage() {
  const avgPerShoot = Math.round(QB.revYTD / QB.ytdInvoices);

  type Section = "Revenue" | "Monthly Revenue" | "Clients" | "Services" | "Marketing" | "Capacity" | "Recent Invoices";
  const DEFAULT_ORDER: Section[] = ["Revenue", "Monthly Revenue", "Clients", "Services", "Marketing", "Capacity", "Recent Invoices"];
  const DEFAULT_VISIBLE: Record<Section, boolean> = { Revenue: true, "Monthly Revenue": true, Clients: true, Services: true, Marketing: true, Capacity: true, "Recent Invoices": true };

  const [userName, setUserName] = useState("");
  const [order, setOrder] = useState<Section[]>(DEFAULT_ORDER);
  const [visible, setVisible] = useState<Record<Section, boolean>>(DEFAULT_VISIBLE);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata;
      setUserName((meta?.full_name || data.user?.email || "").toUpperCase());
      if (meta?.section_order) setOrder(meta.section_order as Section[]);
      if (meta?.section_visible) setVisible(meta.section_visible as Record<Section, boolean>);
    });
  }, []);

  function savePrefs(newOrder: Section[], newVisible: Record<Section, boolean>) {
    createClient().auth.updateUser({ data: { section_order: newOrder, section_visible: newVisible } });
  }

  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = (s: Section) => {
    const next = { ...visible, [s]: !visible[s] };
    setVisible(next);
    savePrefs(order, next);
  };
  const moveSection = (s: Section, dir: -1 | 1) => {
    setOrder(prev => {
      const next = [...prev];
      const i = next.indexOf(s);
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      savePrefs(next, visible);
      return next;
    });
  };

  // Manually editable fields
  const [referrals, setReferrals] = useState(0);
  const [coldCalls, setColdCalls] = useState(0);
  const [leads, setLeads] = useState(0);
  const [bookings, setBookings] = useState(0);
  const [capTotal, setCapTotal] = useState(50);
  const capPct = capTotal > 0 ? Math.min(100, Math.round((QB.ytdInvoices / capTotal) * 100)) : 0;
  const convPct = leads > 0 ? Math.min(100, Math.round((bookings / leads) * 100)) : 0;

  const sectionLabel = "text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']";

  function renderSection(s: Section) {
    if (!visible[s]) return null;
    if (s === "Revenue") return (
      <section key={s}>
        <p className={sectionLabel}>Revenue</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Revenue This Month" value={`$${QB.revMonth.toLocaleString()}`} accent="#4ade80" sub="Current billing period" />
          <Card label="Revenue YTD" value={`$${QB.revYTD.toLocaleString()}`} accent="#4ade80" sub="Year to date" />
          <Card label="Avg Revenue / Shoot" value={`$${avgPerShoot.toLocaleString()}`} accent="#fbbf24" sub="YTD average" />
          <Card label="Shoots Completed" value={QB.shootsAllTime.toString()} accent="#60a5fa" sub="Total invoices all-time" />
        </div>
      </section>
    );
    if (s === "Monthly Revenue") return (
      <section key={s}>
        <p className={sectionLabel}>Monthly Revenue — 2026</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {QB.monthly.map((m) => {
            const pct = Math.round((m.rev / 2850) * 100);
            return (
              <div key={m.month} className="bg-[#111] border border-white/10 p-5">
                <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">{m.month}</p>
                <p className="text-xl font-bold mb-3">${m.rev.toLocaleString()}</p>
                <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                  <div className="h-full bg-white/40 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
    if (s === "Clients") return (
      <section key={s}>
        <p className={sectionLabel}>Clients — YTD</p>
        <div className="grid grid-cols-3 gap-3">
          <Card label="New Clients" value={QB.newClients.toString()} accent="#60a5fa" sub="First-time this year" />
          <Card label="Repeat Clients" value={QB.repeatClients.toString()} accent="#4ade80" sub="Returning this year" />
          <Card label="Referrals" accent="#a78bfa">
            <EditableNumber value={referrals} onChange={setReferrals} />
            <p className="text-xs text-[#444] mt-2">Click to edit</p>
          </Card>
        </div>
      </section>
    );
    if (s === "Services") return (
      <section key={s}>
        <p className={sectionLabel}>Services — YTD Bookings</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Listing Photos", value: QB.services.photos },
            { label: "Drone", value: QB.services.drone },
            { label: "Matterport", value: QB.services.matterport },
            { label: "Video", value: QB.services.video },
            { label: "Headshots", value: QB.services.headshots },
          ].map(item => (
            <div key={item.label} className="bg-[#111] border border-white/10 p-5">
              <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">{item.label}</p>
              <p className="text-2xl font-bold">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    );
    if (s === "Marketing") return (
      <section key={s}>
        <p className={sectionLabel}>Marketing — This Month</p>
        <div className="grid grid-cols-3 gap-3">
          <Card label="Cold Calls Made" accent="#fbbf24">
            <EditableNumber value={coldCalls} onChange={setColdCalls} />
            <p className="text-xs text-[#444] mt-2">Click to edit</p>
          </Card>
          <Card label="Leads Generated" accent="#60a5fa">
            <EditableNumber value={leads} onChange={setLeads} />
            <p className="text-xs text-[#444] mt-2">Click to edit</p>
          </Card>
          <Card label="Bookings from Marketing" accent="#4ade80">
            <EditableNumber value={bookings} onChange={setBookings} />
            <p className="text-xs text-[#444] mt-2">Click to edit</p>
          </Card>
        </div>
      </section>
    );
    if (s === "Capacity") return (
      <section key={s}>
        <p className={sectionLabel}>Capacity</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111] border border-white/10 p-6">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-4">Capacity Utilized</p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold">{QB.ytdInvoices}</span>
              <span className="text-[#555]">/</span>
              <input
                type="number"
                value={capTotal}
                onChange={e => setCapTotal(Number(e.target.value))}
                className="text-3xl font-bold bg-transparent w-20 outline-none border-b border-transparent focus:border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <p className="text-xs text-[#444] mb-3">Shoots completed / monthly capacity (click to edit)</p>
            <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${capPct}%` }} />
            </div>
            <p className="text-xs text-[#666] mt-2">{capPct}% utilized</p>
          </div>
          <div className="bg-[#111] border border-white/10 p-6">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-4">Lead Conversion Rate</p>
            <p className="text-3xl font-bold mb-4">{leads > 0 ? `${convPct}%` : "—"}</p>
            <p className="text-xs text-[#444] mb-3">Bookings ÷ Leads</p>
            <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${convPct}%`, background: "#60a5fa" }} />
            </div>
            <p className="text-xs text-[#666] mt-2">{leads > 0 ? `${bookings} of ${leads} leads converted` : "Enter leads and bookings above"}</p>
          </div>
        </div>
      </section>
    );
    if (s === "Recent Invoices") return (
      <section key={s}>
        <p className={sectionLabel}>Recent Invoices</p>
        <div className="bg-[#111] border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {["Invoice", "Client", "Date", "Amount", "Status"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QB.recentInvoices.map(inv => (
                <tr key={inv.num} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-[#888]">#{inv.num}</td>
                  <td className="px-5 py-3">{inv.client}</td>
                  <td className="px-5 py-3 text-[#888]">{inv.date}</td>
                  <td className="px-5 py-3 font-medium">{inv.amount}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs tracking-[1px] uppercase px-2 py-1 ${inv.paid ? "bg-[#4ade8018] text-[#4ade80]" : "bg-[#fbbf2418] text-[#fbbf24]"}`}>
                      {inv.paid ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
    return null;
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <span className="text-xl font-black tracking-tight uppercase">Luck Images</span>
        <div className="flex items-center gap-6">
          <span className="text-xs tracking-[2px] uppercase text-[#666]">Admin</span>
          <a href="/login" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</a>
        </div>
      </header>

      <div className="flex-1 px-8 py-12 max-w-7xl mx-auto w-full space-y-12">

        {/* TITLE */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#666] mb-2">Welcome back</p>
            <h1 className="text-4xl font-black tracking-tight uppercase">{userName || "Dashboard"}</h1>
          </div>
          <div className="flex items-center gap-5">
            <p className="text-xs tracking-[2px] uppercase text-[#444]">Last synced: June 10, 2026</p>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="text-xs tracking-[2px] uppercase text-white flex items-center gap-1.5 hover:text-white/70 transition-colors"
              >
                Sections
                <span className="text-[10px]">{menuOpen ? "▲" : "▼"}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 bg-[#181818] border border-white/10 py-2 z-50 min-w-[200px]">
                  {order.map((s, i) => (
                    <div key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={visible[s]}
                        onChange={() => toggle(s)}
                        className="accent-white w-3 h-3 cursor-pointer flex-shrink-0"
                      />
                      <span className="text-xs tracking-[2px] uppercase text-white flex-1">{s}</span>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveSection(s, -1)} disabled={i === 0} className="text-[#555] hover:text-white disabled:opacity-20 leading-none text-[10px]">▲</button>
                        <button onClick={() => moveSection(s, 1)} disabled={i === order.length - 1} className="text-[#555] hover:text-white disabled:opacity-20 leading-none text-[10px]">▼</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {order.map(renderSection)}

      </div>
    </main>
  );
}
