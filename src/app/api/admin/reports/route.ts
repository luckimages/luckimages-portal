import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Where the money comes from. GET ?range=all|365|90|30
// Cohort = contacts created in the range (excluding staff/deleted). For each
// group (lead source / brokerage / who generated it):
//   leads         contacts in the cohort
//   clients       of those, how many have booked at least one (non-cancelled) shoot
//   conversion    clients ÷ leads
//   median_days_to_first_shoot   contact created → first shoot date (only when the shoot came after)
//   revenue_cents paid invoices on those contacts' shoots, all time
//   ltv_cents     revenue ÷ clients

type Row = {
  key: string; leads: number; clients: number; conversion: number;
  median_days_to_first_shoot: number | null; revenue_cents: number; ltv_cents: number;
};

const DAY_MS = 86400000;

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rangeParam = new URL(req.url).searchParams.get("range") || "all";
  const days = rangeParam === "all" ? null : Number(rangeParam);
  const since = days ? new Date(Date.now() - days * DAY_MS).toISOString() : null;

  const db = createAdminClient();
  const [{ data: contacts, error }, { data: shoots }, { data: invoices }] = await Promise.all([
    db.from("contacts").select("id, lead_source, brokerage, sourced_by, created_at, type, stage, user_id"),
    db.from("shoots").select("id, contact_id, client_id, scheduled_at, created_at, status").neq("status", "cancelled"),
    db.from("invoices").select("shoot_id, amount_cents, paid"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const people = (contacts || []).filter(c => c.stage !== "deleted" && c.type !== "employee" && c.type !== "admin");
  const contactByUser = new Map(people.filter(c => c.user_id).map(c => [c.user_id as string, c.id as string]));

  const paidByShoot = new Map<string, number>();
  for (const inv of invoices || []) {
    if (inv.paid && inv.shoot_id) paidByShoot.set(inv.shoot_id, (paidByShoot.get(inv.shoot_id) || 0) + (inv.amount_cents || 0));
  }
  const perContact = new Map<string, { firstShootAt: number; revenue: number }>();
  for (const s of shoots || []) {
    const cid = s.contact_id || (s.client_id ? contactByUser.get(s.client_id) : undefined);
    if (!cid) continue;
    const at = new Date((s.scheduled_at || s.created_at) as string).getTime();
    const cur = perContact.get(cid) ?? { firstShootAt: at, revenue: 0 };
    cur.firstShootAt = Math.min(cur.firstShootAt, at);
    cur.revenue += paidByShoot.get(s.id) || 0;
    perContact.set(cid, cur);
  }

  const cohort = since ? people.filter(c => c.created_at >= since) : people;

  function group(keyOf: (c: typeof people[0]) => string): Row[] {
    const buckets = new Map<string, { leads: number; clients: number; days: number[]; revenue: number }>();
    for (const c of cohort) {
      const key = keyOf(c);
      const b = buckets.get(key) ?? { leads: 0, clients: 0, days: [], revenue: 0 };
      b.leads++;
      const pc = perContact.get(c.id);
      if (pc) {
        b.clients++;
        b.revenue += pc.revenue;
        const d = (pc.firstShootAt - new Date(c.created_at).getTime()) / DAY_MS;
        if (d >= 0) b.days.push(d);
      }
      buckets.set(key, b);
    }
    return [...buckets.entries()].map(([key, b]) => ({
      key,
      leads: b.leads,
      clients: b.clients,
      conversion: b.leads ? b.clients / b.leads : 0,
      median_days_to_first_shoot: median(b.days),
      revenue_cents: b.revenue,
      ltv_cents: b.clients ? Math.round(b.revenue / b.clients) : 0,
    })).sort((a, b) => b.revenue_cents - a.revenue_cents || b.leads - a.leads);
  }

  // Brokerages are typed by hand ("KW", "Keller Williams Austin NW") — group
  // case-insensitively on the trimmed name.
  const brokerageLabel = new Map<string, string>();
  for (const c of cohort) {
    const b = (c.brokerage || "").trim();
    if (b && !brokerageLabel.has(b.toLowerCase())) brokerageLabel.set(b.toLowerCase(), b);
  }

  const totals = group(() => "All")[0] ?? { key: "All", leads: 0, clients: 0, conversion: 0, median_days_to_first_shoot: null, revenue_cents: 0, ltv_cents: 0 };
  return NextResponse.json({
    range: rangeParam,
    totals,
    bySource: group(c => c.lead_source || "unknown"),
    byBrokerage: group(c => brokerageLabel.get((c.brokerage || "").trim().toLowerCase()) || "No brokerage").slice(0, 25),
    bySourcedBy: group(c => (c.sourced_by || "").trim() || "Not set"),
  });
}
