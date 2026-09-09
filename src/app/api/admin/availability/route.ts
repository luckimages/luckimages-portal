import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Ryan / Leif availability blocks on the Master Calendar.

function firstName(user: { email?: string | null; user_metadata?: { full_name?: string } }): string {
  const full = user.user_metadata?.full_name;
  if (full) return full.split(" ")[0];
  return (user.email?.split("@")[0] || "Someone").replace(/^./, c => c.toUpperCase());
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  const db = createAdminClient();

  let q = db.from("availability_blocks").select("*").order("start_at", { ascending: true });
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString();
    const end = new Date(y, m, 1).toISOString();
    // any block that overlaps the month
    q = q.lt("start_at", end).gte("end_at", start);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blocks: data || [] });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allDay, startAt, endAt, note } = await req.json();
  if (!startAt || !endAt) return NextResponse.json({ error: "Start and end are required" }, { status: 400 });
  if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
    return NextResponse.json({ error: "End is before start" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db.from("availability_blocks").insert({
    user_id: admin.id,
    user_name: firstName(admin),
    all_day: !!allDay,
    start_at: startAt,
    end_at: endAt,
    note: note?.trim() || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("company_updates").insert({
    message: `🚫 ${firstName(admin)} blocked off ${new Date(startAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}${
      new Date(startAt).toDateString() !== new Date(endAt).toDateString() ? `–${new Date(endAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""
    }${note ? ` — ${note}` : ""} (not available to shoot)`,
    created_by: "system",
    category: "team",
    link: "/dashboard/calendar",
  });

  return NextResponse.json({ block: data });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = createAdminClient();
  // Either partner can clear a block.
  const { error } = await db.from("availability_blocks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
