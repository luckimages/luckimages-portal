import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Per-admin acknowledgment tracking, shared across every Command Center box
// (pending shoots, new registrations, and any future box type).
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sourceType = searchParams.get("source_type");
  if (!sourceType) return NextResponse.json({ error: "source_type required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("notification_acks")
    .select("source_id")
    .eq("source_type", sourceType)
    .eq("acked_by", admin.email || "");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ackedIds: (data || []).map(d => d.source_id) });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourceType, sourceId } = await req.json();
  if (!sourceType || !sourceId) return NextResponse.json({ error: "sourceType and sourceId required" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db
    .from("notification_acks")
    .upsert({ source_type: sourceType, source_id: sourceId, acked_by: admin.email || "" }, { onConflict: "source_type,source_id,acked_by" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
