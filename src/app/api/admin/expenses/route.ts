import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";
import { expensesDb, buildPnl } from "@/lib/expenses";

// GET    /api/admin/expenses?scope=month&month=YYYY-MM  → P&L for that month
// GET    /api/admin/expenses?scope=ytd                  → P&L year-to-date
// POST   { incurred_on, category, label, amount_cents, recurring, note }
// PATCH  { id, ...fields }
// DELETE { id }   (operating-budget rows only)

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "month" ? "month" : "ytd";
  const month = url.searchParams.get("month") || currentMonth();

  const db = expensesDb();
  const pnl = await buildPnl(db, scope, scope === "month" ? month : undefined);
  return NextResponse.json(pnl);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const label = (body.label || "").trim();
  const amount_cents = Math.round(Number(body.amount_cents));
  if (!label) return NextResponse.json({ error: "Label required" }, { status: 400 });
  if (!Number.isFinite(amount_cents) || amount_cents < 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  const month: string = /^\d{4}-\d{2}$/.test(body.month) ? body.month : currentMonth();

  const db = expensesDb();
  const { data, error } = await db
    .from("operating_expenses")
    .insert({
      incurred_on: body.incurred_on || `${month}-01`,
      category: body.category || "other",
      label,
      amount_cents,
      recurring: !!body.recurring,
      note: body.note || null,
      created_by: admin.email || "admin",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim();
  if (body.category) patch.category = body.category;
  if (body.amount_cents != null) {
    const c = Math.round(Number(body.amount_cents));
    if (!Number.isFinite(c) || c < 0) return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
    patch.amount_cents = c;
  }
  if (typeof body.recurring === "boolean") patch.recurring = body.recurring;
  if ("note" in body) patch.note = body.note || null;

  const db = expensesDb();
  const { error } = await db.from("operating_expenses").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = expensesDb();
  const { error } = await db.from("operating_expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
