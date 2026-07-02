import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createAdminClient();

  // Return the current snapshot immediately — actual sync happens via the
  // daily scheduled task in Claude Code (7 AM daily) which has QB MCP access.
  const { data: snap } = await service
    .from("kpi_snapshots")
    .select("*")
    .eq("id", 1)
    .single();

  return NextResponse.json(snap ?? {});
}
