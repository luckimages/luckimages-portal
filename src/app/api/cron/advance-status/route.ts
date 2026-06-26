import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Runs at midnight — advances shoots from "wrapping" → "editing"
// if the shoot date has already passed, so the next day shows Editing.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = service();

  // Find wrapping shoots whose scheduled date is in the past
  const { data: shoots, error } = await db
    .from("shoots")
    .select("id, address, scheduled_at")
    .eq("status", "wrapping")
    .lt("scheduled_at", new Date().toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!shoots?.length) return NextResponse.json({ updated: 0 });

  const ids = shoots.map(s => s.id);
  await db.from("shoots").update({ status: "editing" }).in("id", ids);

  // Log each to Command Center
  await Promise.all(shoots.map(s =>
    db.from("company_updates").insert({
      message: `🖥️ Editing started — ${s.address}`,
      created_by: "system",
    })
  ));

  return NextResponse.json({ updated: ids.length });
}
