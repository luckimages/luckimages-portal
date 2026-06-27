"use client";

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

function fmtMoney(n: number) {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs tracking-[4px] uppercase text-[#555] flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-[''] mb-6">
      {children}
    </p>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#111] border border-white/10 p-6" style={accent ? { borderBottom: `2px solid ${accent}` } : {}}>
      <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-xs text-[#555] mt-2">{sub}</p>}
    </div>
  );
}

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

export default function InsightsPage({ shoots, contacts, snapshot }: { shoots: Shoot[]; contacts: Contact[]; snapshot?: QBSnapshot | null }) {

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const thisMonthKey = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = monthKey(lastMonthDate);
  const sameMonthLastYearKey = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Revenue — use QB snapshot when available, fall back to shoots
  const breakdown = snapshot?.monthly_breakdown ?? {};
  const revThisMonth = snapshot ? (breakdown[thisMonthKey] ?? 0) : 0;
  const revLastMonth = snapshot ? (breakdown[lastMonthKey] ?? 0) : 0;
  const revSameMonthLY = snapshot ? (breakdown[sameMonthLastYearKey] ?? 0) : 0;
  const revYTD = snapshot?.rev_ytd ?? 0;
  const netIncome = snapshot?.net_income ?? 0;
  const expensesYTD = snapshot?.expenses_ytd ?? 0;
  const avgPerInvoice = snapshot && snapshot.ytd_invoices > 0
    ? Math.round(revYTD / snapshot.ytd_invoices)
    : 0;

  const completedShoots = shoots.filter((s) =>
    ["delivered", "completed"].includes(s.status) && s.price
  );

  function delta(current: number, prior: number) {
    if (!prior) return null;
    const pct = Math.round(((current - prior) / prior) * 100);
    return pct;
  }
  function deltaLabel(pct: number | null, priorLabel: string) {
    if (pct === null) return `No data for ${priorLabel}`;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct}% vs ${priorLabel}`;
  }
  function deltaColor(pct: number | null) {
    if (pct === null) return "text-[#555]";
    return pct >= 0 ? "text-[#4ade80]" : "text-red-400";
  }

  const vsLastMonth = delta(revThisMonth, revLastMonth);
  const vsSameMonthLY = delta(revThisMonth, revSameMonthLY);

  // Shoot counts this month
  const shootsThisMonth = shoots.filter(
    (s) => s.scheduled_at && monthKey(new Date(s.scheduled_at)) === thisMonthKey
  );
  const shootsLastMonth = shoots.filter(
    (s) => s.scheduled_at && monthKey(new Date(s.scheduled_at)) === lastMonthKey
  );
  const shootCountDelta = delta(shootsThisMonth.length, shootsLastMonth.length);

  // Daily ops
  const todayShoots = shoots.filter((s) => s.scheduled_at?.slice(0, 10) === todayStr);
  const upcomingWeek = shoots.filter((s) => {
    if (!s.scheduled_at) return false;
    const d = new Date(s.scheduled_at);
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 7 && !["cancelled", "delivered", "completed"].includes(s.status);
  });
  const pendingEdits = shoots.filter((s) =>
    ["editing", "wrapping"].includes(s.status)
  );
  const newLeads = contacts.filter((c) => {
    const daysAgo = (now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return c.type === "lead" && daysAgo <= 7;
  });

  // Client relationship metrics — group shoots by contact
  const contactShootMap: Record<string, Shoot[]> = {};
  for (const s of shoots) {
    if (!s.contact_id) continue;
    if (!contactShootMap[s.contact_id]) contactShootMap[s.contact_id] = [];
    contactShootMap[s.contact_id].push(s);
  }

  const clientMetrics = contacts
    .filter((c) => c.type === "realtor" || c.type === "lead")
    .map((c) => {
      const cShoots = contactShootMap[c.id] ?? [];
      const completed = cShoots.filter((s) => ["delivered", "completed"].includes(s.status));
      const lifetimeRev = completed.reduce((sum, s) => sum + (s.price ?? 0), 0);
      const lastShoot = completed.length
        ? completed.sort((a, b) =>
            new Date(b.scheduled_at!).getTime() - new Date(a.scheduled_at!).getTime()
          )[0].scheduled_at
        : null;
      const avgRev = completed.length ? Math.round(lifetimeRev / completed.length) : 0;
      const daysSinceLast = lastShoot
        ? Math.floor((now.getTime() - new Date(lastShoot).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return { ...c, lifetimeRev, totalShoots: completed.length, lastShoot, avgRev, daysSinceLast };
    })
    .filter((c) => c.totalShoots > 0)
    .sort((a, b) => b.lifetimeRev - a.lifetimeRev);

  const top10 = clientMetrics.slice(0, 10);
  const inactive = clientMetrics.filter((c) => c.daysSinceLast !== null && c.daysSinceLast >= 60);

  // Service breakdown (all-time)
  const serviceCounts: Record<string, number> = {};
  for (const s of shoots) {
    for (const svc of s.services ?? []) {
      const key = svc.toLowerCase().trim();
      serviceCounts[key] = (serviceCounts[key] ?? 0) + 1;
    }
  }
  const serviceRows = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1]);

  // Avg time between bookings across all clients
  const allGaps: number[] = [];
  for (const cm of clientMetrics) {
    const cShoots = (contactShootMap[cm.id] ?? [])
      .filter((s) => s.scheduled_at && ["delivered", "completed"].includes(s.status))
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
    for (let i = 1; i < cShoots.length; i++) {
      const gap =
        (new Date(cShoots[i].scheduled_at!).getTime() - new Date(cShoots[i - 1].scheduled_at!).getTime()) /
        (1000 * 60 * 60 * 24);
      allGaps.push(gap);
    }
  }
  const avgGap = allGaps.length ? Math.round(allGaps.reduce((a, b) => a + b, 0) / allGaps.length) : null;

  // Repeat client %
  const realtorContacts = contacts.filter((c) => c.type === "realtor" || c.type === "lead");
  const repeatClients = realtorContacts.filter((c) => (contactShootMap[c.id]?.filter((s) => ["delivered","completed"].includes(s.status)).length ?? 0) > 1);
  const repeatPct = realtorContacts.length
    ? Math.round((repeatClients.length / realtorContacts.filter(c => (contactShootMap[c.id]?.filter(s=>["delivered","completed"].includes(s.status)).length??0)>0).length) * 100)
    : 0;

  const totalLeads = contacts.filter((c) => c.type === "lead").length;
  const convertedLeads = contacts.filter((c) => c.type === "realtor").length;
  const conversionRate = (totalLeads + convertedLeads) > 0
    ? Math.round((convertedLeads / (totalLeads + convertedLeads)) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-12">

      {/* Revenue with Deltas */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <SectionLabel>Revenue Intelligence</SectionLabel>
          {snapshot?.synced_at && (
            <p className="text-[10px] text-[#333] mb-6 shrink-0">
              QB synced {new Date(snapshot.synced_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {new Date(snapshot.synced_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>
        {!snapshot && (
          <p className="text-xs text-[#555] mb-4">No QuickBooks data synced yet — showing $0 until QB sync runs.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-[#111] border border-white/10 border-b-2 p-6" style={{ borderBottomColor: "#4ade80" }}>
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Revenue This Month</p>
            <p className="text-3xl font-bold mb-3">{fmtMoney(revThisMonth)}</p>
            <div className="flex flex-col gap-1">
              <p className={`text-xs ${deltaColor(vsLastMonth)}`}>{deltaLabel(vsLastMonth, "last month")}</p>
              <p className={`text-xs ${deltaColor(vsSameMonthLY)}`}>{deltaLabel(vsSameMonthLY, "same month LY")}</p>
            </div>
          </div>
          <div className="bg-[#111] border border-white/10 border-b-2 p-6" style={{ borderBottomColor: "#60a5fa" }}>
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Revenue YTD</p>
            <p className="text-3xl font-bold mb-3">{fmtMoney(revYTD)}</p>
            <p className="text-xs text-[#555]">{snapshot?.ytd_invoices ?? 0} invoices · avg {fmtMoney(avgPerInvoice)}/invoice</p>
          </div>
          <div className="bg-[#111] border border-white/10 border-b-2 p-6" style={{ borderBottomColor: "#a78bfa" }}>
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Net Income YTD</p>
            <p className="text-3xl font-bold mb-3">{fmtMoney(netIncome)}</p>
            <p className="text-xs text-[#555]">Expenses: {fmtMoney(expensesYTD)}</p>
          </div>
          <div className="bg-[#111] border border-white/10 border-b-2 p-6" style={{ borderBottomColor: "#fbbf24" }}>
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Shoots This Month</p>
            <p className="text-3xl font-bold mb-3">{shootsThisMonth.length}</p>
            <p className={`text-xs ${deltaColor(shootCountDelta)}`}>
              {deltaLabel(shootCountDelta, "last month")}
            </p>
          </div>
          <div className="bg-[#111] border border-white/10 border-b-2 p-6" style={{ borderBottomColor: "#f87171" }}>
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Unpaid Invoices</p>
            <p className="text-3xl font-bold mb-3">{snapshot?.unpaid_count ?? 0}</p>
            <p className="text-xs text-[#555]">Awaiting payment in QB</p>
          </div>
          <div className="bg-[#111] border border-white/10 border-b-2 p-6" style={{ borderBottomColor: "#34d399" }}>
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Avg Rev / Invoice</p>
            <p className="text-3xl font-bold mb-3">{avgPerInvoice ? fmtMoney(avgPerInvoice) : "—"}</p>
            <p className="text-xs text-[#555]">Based on YTD QB invoices</p>
          </div>
        </div>
      </section>

      {/* Daily Ops */}
      <section>
        <SectionLabel>Daily Operations</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Today's Shoots" value={String(todayShoots.length)} accent="#4ade80" />
          <Stat label="Pending Edits" value={String(pendingEdits.length)} accent="#fbbf24" />
          <Stat label="New Leads (7d)" value={String(newLeads.length)} accent="#60a5fa" />
          <Stat label="Upcoming (7d)" value={String(upcomingWeek.length)} accent="#a78bfa" />
        </div>

        {todayShoots.length > 0 && (
          <div className="border border-white/10 divide-y divide-white/5">
            <p className="text-[10px] tracking-[3px] uppercase text-[#444] px-5 py-3">Today&apos;s Shoots</p>
            {todayShoots.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{s.address}</p>
                  <p className="text-xs text-[#555]">{s.services?.join(", ")}</p>
                </div>
                <span className="text-xs tracking-[1px] uppercase text-[#666]">{s.status.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}

        {upcomingWeek.length > 0 && (
          <div className="border border-white/10 divide-y divide-white/5 mt-3">
            <p className="text-[10px] tracking-[3px] uppercase text-[#444] px-5 py-3">Upcoming This Week</p>
            {upcomingWeek.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{s.address}</p>
                  <p className="text-xs text-[#555]">{s.services?.join(", ")}</p>
                </div>
                <span className="text-xs text-[#666]">{s.scheduled_at ? fmtDate(s.scheduled_at) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Client Health */}
      <section>
        <SectionLabel>Client Health</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Total Clients" value={String(clientMetrics.length)} />
          <Stat label="Repeat Client %" value={`${repeatPct}%`} accent="#4ade80" sub="Booked more than once" />
          <Stat label="Avg Days Between Bookings" value={avgGap ? `${avgGap}d` : "—"} />
          <Stat label="Inactive 60+ Days" value={String(inactive.length)} accent={inactive.length > 5 ? "#fbbf24" : undefined} sub="No shoot in 60+ days" />
        </div>

        {/* Top 10 */}
        <div className="border border-white/10 divide-y divide-white/5 mb-4">
          <p className="text-[10px] tracking-[3px] uppercase text-[#444] px-5 py-3">Top 10 Clients by Lifetime Revenue</p>
          {top10.map((c, i) => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#444] w-4">{i + 1}</span>
                <div>
                  <a href={`/admin/contacts/${c.id}`} className="text-sm text-white hover:text-[#4ade80] transition-colors">
                    {c.name}
                  </a>
                  <p className="text-xs text-[#555]">{c.totalShoots} shoot{c.totalShoots !== 1 ? "s" : ""} · avg {fmtMoney(c.avgRev)}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-white shrink-0">{fmtMoney(c.lifetimeRev)}</span>
            </div>
          ))}
        </div>

        {/* Inactive */}
        {inactive.length > 0 && (
          <div className="border border-white/10 divide-y divide-white/5">
            <p className="text-[10px] tracking-[3px] uppercase text-[#444] px-5 py-3">Inactive 60+ Days — Follow Up</p>
            {inactive.slice(0, 10).map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <a href={`/admin/contacts/${c.id}`} className="text-sm text-white hover:text-[#4ade80] transition-colors">
                  {c.name}
                </a>
                <span className="text-xs text-[#fbbf24]">{c.daysSinceLast}d ago</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Marketing Metrics */}
      <section>
        <SectionLabel>Marketing Metrics</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label="Total Leads" value={String(totalLeads)} accent="#fbbf24" />
          <Stat label="Converted to Realtor" value={String(convertedLeads)} accent="#4ade80" />
          <Stat label="Conversion Rate" value={`${conversionRate}%`} accent="#60a5fa" sub="Leads → registered realtors" />
          <Stat label="Repeat Client %" value={`${repeatPct}%`} sub="Clients with 2+ shoots" />
          <Stat label="New Leads This Week" value={String(newLeads.length)} />
          <div className="bg-[#111] border border-white/10 p-6 flex flex-col justify-between">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Google Reviews</p>
            <p className="text-2xl font-bold text-[#555]">—</p>
            <p className="text-xs text-[#444] mt-2">Connect Google Business to track</p>
          </div>
        </div>
      </section>

      {/* Service Breakdown */}
      <section>
        <SectionLabel>Service Breakdown (All-Time)</SectionLabel>
        <div className="border border-white/10 divide-y divide-white/5">
          {serviceRows.length === 0 && (
            <p className="px-5 py-6 text-xs text-[#444]">No service data yet.</p>
          )}
          {serviceRows.map(([svc, count]) => {
            const maxCount = serviceRows[0]?.[1] ?? 1;
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={svc} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm capitalize">{svc}</span>
                  <span className="text-sm font-bold">{count}</span>
                </div>
                <div className="h-px bg-white/5 relative">
                  <div className="absolute left-0 top-0 h-px bg-[#4ade80]/40 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
