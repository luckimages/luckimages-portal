import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Per-shoot editing cost — whoever delivers a shoot records what they spent
// on editing. Required before "Deliver to Client" unlocks (enforced in
// /api/admin/deliver-shoot and /api/photographer/shoots).
//
// GET  /api/admin/editing-cost?shootId=…
// POST { shootId, amountCents }

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shootId = new URL(req.url).searchParams.get("shootId");
  if (!shootId) return NextResponse.json({ error: "shootId required" }, { status: 400 });

  const db = createAdminClient();
  const { data } = await db
    .from("shoots")
    .select("editing_cost_cents, editing_cost_by, editing_cost_at")
    .eq("id", shootId)
    .maybeSingle();

  return NextResponse.json(data ?? { editing_cost_cents: null });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shootId, amountCents } = await req.json();
  if (!shootId) return NextResponse.json({ error: "shootId required" }, { status: 400 });

  const cents = Math.round(Number(amountCents));
  if (!Number.isFinite(cents) || cents < 0) {
    return NextResponse.json({ error: "Enter a valid editing cost" }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from("shoots")
    .update({
      editing_cost_cents: cents,
      editing_cost_by: admin.email || "admin",
      editing_cost_at: new Date().toISOString(),
    })
    .eq("id", shootId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
