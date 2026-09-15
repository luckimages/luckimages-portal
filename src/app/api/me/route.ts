import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { buildPnl, monthRange } from "@/lib/expenses";

// "My Nocturne" — consolidated personal dashboard for an admin (Ryan or
// Leif): commission/earnings, shoots, mileage, cold-calling stats, and
// availability, all scoped to one person. Either admin can view either
// person's data (the page defaults to self, with a toggle).
//
// GET /api/me?person=ryan|leif&month=YYYY-MM

const PERSON_EMAIL: Record<string, string> = {
  ryan: "ryan@luckimages.com",
  leif: "leif@luckimages.com",
};
const PERSON_NAME: Record<string, string> = { ryan: "Ryan", leif: "Leif" };

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const person = (searchParams.get("person") || "").toLowerCase();
  if (!PERSON_EMAIL[person]) return NextResponse.json({ error: "person must be ryan or leif" }, { status: 400 });

  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const db = createAdminClient();

  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const personUser = users?.users.find(u => u.email?.toLowerCase() === PERSON_EMAIL[person]);
  const personId = personUser?.id ?? null;
  const personName = PERSON_NAME[person];

  const range = monthRange(month);

  // ── Commission / earnings ────────────────────────────────────────────────
  const pnl = await buildPnl(db, "month", month);
  const commission_cents = person === "leif" ? pnl.memo.leif_profit_share_cents : null;
  const personShootRows = person === "leif" ? pnl.shoot_expenses.filter(r => r.leif_sourced) : [];

  // ── Shoots photographed by this person ───────────────────────────────────
  const { data: shoots } = personId
    ? await db
        .from("shoots")
        .select("id, address, scheduled_at, status, price, package_name, photographer_ids")
        .contains("photographer_ids", [personId])
        .gte("scheduled_at", range.start)
        .lte("scheduled_at", range.end)
        .order("scheduled_at", { ascending: false })
    : { data: [] as { id: string; address: string; scheduled_at: string; status: string; price: number | null; package_name: string | null }[] };

  // ── Mileage ───────────────────────────────────────────────────────────────
  const { data: mileageDays } = personId
    ? await db
        .from("mileage_days")
        .select("day, effective_miles, gas_cost_cents, deduction_cents")
        .eq("photographer_id", personId)
        .gte("day", range.start.slice(0, 10))
        .lte("day", range.end.slice(0, 10))
        .order("day", { ascending: false })
    : { data: [] as { day: string; effective_miles: number; gas_cost_cents: number; deduction_cents: number }[] };
  const mileage = {
    days: mileageDays ?? [],
    total_miles: (mileageDays ?? []).reduce((s, d) => s + (d.effective_miles || 0), 0),
    total_gas_cents: (mileageDays ?? []).reduce((s, d) => s + (d.gas_cost_cents || 0), 0),
    total_deduction_cents: (mileageDays ?? []).reduce((s, d) => s + (d.deduction_cents || 0), 0),
  };

  // ── Cold calling / outreach ──────────────────────────────────────────────
  const { data: calls } = await db
    .from("cold_calls")
    .select("id, outcome, called_at, contact_id")
    .ilike("called_by", personName)
    .gte("called_at", range.start)
    .lte("called_at", range.end)
    .order("called_at", { ascending: false });
  const outcomeCounts: Record<string, number> = {};
  for (const c of calls ?? []) outcomeCounts[c.outcome || "unknown"] = (outcomeCounts[c.outcome || "unknown"] || 0) + 1;
  const cold_calling = {
    total_calls: (calls ?? []).length,
    by_outcome: outcomeCounts,
    recent: (calls ?? []).slice(0, 10),
  };

  // Leads this person sourced that turned into shoots this month (their pipeline impact)
  const { data: sourcedContacts } = personId
    ? await db.from("contacts").select("id").ilike("sourced_by", `%${personName}%`)
    : { data: [] as { id: string }[] };
  const sourced_leads_count = (sourcedContacts ?? []).length;

  // ── Availability blocks ──────────────────────────────────────────────────
  const { data: availability } = personId
    ? await db
        .from("availability_blocks")
        .select("id, user_id, user_name, all_day, start_at, end_at, note")
        .eq("user_id", personId)
        .gte("end_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(20)
    : { data: [] as { id: string; user_id: string; user_name: string; all_day: boolean; start_at: string; end_at: string; note: string | null }[] };

  return NextResponse.json({
    person,
    person_name: personName,
    month,
    commission_cents,
    commission_shoots: personShootRows,
    shoots: shoots ?? [],
    mileage,
    cold_calling,
    sourced_leads_count,
    availability: availability ?? [],
    is_leif: person === "leif",
  });
}
