import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin, ADMIN_EMAILS } from "@/lib/supabase-server";

// Admin-wide mileage report — every photographer, broken out by month:
// miles driven, gas cost, and the IRS standard-rate deduction (reporting
// only, for tax season). The photographer-scoped view is /api/portal/mileage.
//
// GET /api/admin/mileage                → JSON, all months
// GET /api/admin/mileage?format=csv     → CSV download

const ADMIN_NAMES: Record<string, string> = {
  "ryan@luckimages.com": "Ryan",
  "leif@luckimages.com": "Leif",
};

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  const { data: days } = await db
    .from("mileage_days")
    .select("photographer_id, day, effective_miles, estimated_miles, actual_miles, gas_cost_cents, deduction_cents")
    .order("day", { ascending: false });

  // Names for each photographer id
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const nameById: Record<string, string> = {};
  for (const u of users?.users ?? []) {
    if (u.email && ADMIN_NAMES[u.email]) nameById[u.id] = ADMIN_NAMES[u.email];
    else if (u.email) nameById[u.id] = u.email.split("@")[0];
  }
  const { data: profiles } = await db.from("profiles").select("id, full_name");
  for (const p of profiles ?? []) if (p.full_name && !ADMIN_NAMES[nameById[p.id]]) nameById[p.id] = p.full_name;

  // Aggregate by photographer + month
  type Row = {
    photographer_id: string;
    name: string;
    month: string;
    day_count: number;
    miles: number;
    gas_cents: number;
    deduction_cents: number;
  };
  const map = new Map<string, Row>();
  for (const d of days ?? []) {
    const month = String(d.day).slice(0, 7);
    const key = `${d.photographer_id}|${month}`;
    let row = map.get(key);
    if (!row) {
      row = {
        photographer_id: d.photographer_id,
        name: nameById[d.photographer_id] || "Unknown",
        month,
        day_count: 0,
        miles: 0,
        gas_cents: 0,
        deduction_cents: 0,
      };
      map.set(key, row);
    }
    row.day_count += 1;
    row.miles += Number(d.effective_miles ?? d.estimated_miles ?? 0);
    row.gas_cents += d.gas_cost_cents ?? 0;
    row.deduction_cents += d.deduction_cents ?? 0;
  }
  const rows = [...map.values()].sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name));

  const url = new URL(req.url);
  if (url.searchParams.get("format") === "csv") {
    const header = "Month,Photographer,Days driven,Miles,Gas cost,IRS deduction";
    const body = rows
      .map(r => [r.month, r.name, r.day_count, r.miles.toFixed(1), money(r.gas_cents), money(r.deduction_cents)].join(","))
      .join("\n");
    const totals = rows.reduce(
      (t, r) => ({ miles: t.miles + r.miles, gas: t.gas + r.gas_cents, ded: t.ded + r.deduction_cents }),
      { miles: 0, gas: 0, ded: 0 }
    );
    const totalLine = `\nAll,All,,${totals.miles.toFixed(1)},${money(totals.gas)},${money(totals.ded)}`;
    return new NextResponse(`${header}\n${body}${totalLine}\n`, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="mileage-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    rows,
    totals: {
      miles: rows.reduce((s, r) => s + r.miles, 0),
      gas_cents: rows.reduce((s, r) => s + r.gas_cents, 0),
      deduction_cents: rows.reduce((s, r) => s + r.deduction_cents, 0),
    },
  });
}
