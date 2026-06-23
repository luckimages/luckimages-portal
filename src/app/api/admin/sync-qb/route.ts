import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Return the current snapshot immediately — actual sync happens via the
  // daily scheduled task in Claude Code (7 AM daily) which has QB MCP access.
  const { data: snap } = await service
    .from("kpi_snapshots")
    .select("*")
    .eq("id", 1)
    .single();

  return NextResponse.json(snap ?? {});
}
