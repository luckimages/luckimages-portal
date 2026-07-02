import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";

const ASAP_LIST_ID = "f910a06f-cb9a-4c50-987e-ec85fc5754f4";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Called client-side when a late shoot is detected.
// Creates an ASAP task and a notification — both deduplicated by shoot ID.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shootId, address, scheduledAt, minutesPast, status: shootStatus } = await req.json();
  if (!shootId) return NextResponse.json({ error: "shootId required" }, { status: 400 });

  // Don't fire for on_site/wrapping — photographer is clearly there
  if (shootStatus && ["on_site", "wrapping"].includes(shootStatus)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const db = service();
  const dedupKey = `LATE-SHOOT:${shootId}`;

  // Check if ASAP task already exists for this shoot
  const { data: existing } = await db
    .from("todos")
    .select("id")
    .like("notes", `%${dedupKey}%`)
    .is("completed_at", null)
    .maybeSingle();

  if (!existing) {
    const timeLabel = scheduledAt
      ? new Date(scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
      : "scheduled time";

    await db.from("todos").insert({
      text: `Photographer not on site — ${address}`,
      title: `Photographer not on site — ${address}`,
      notes: `Scheduled ${timeLabel} CT · ${minutesPast}min past with no check-in.\n\n${dedupKey}`,
      list_id: ASAP_LIST_ID,
      assigned_to: "both",
      is_urgent: true,
      created_by: "system",
    });

    await db.from("company_updates").insert({
      message: `Late shoot alert — ${address}\n---\n• Scheduled ${timeLabel} CT\n• ${minutesPast} minutes past scheduled time with no check-in\n• Photographer portal status not updated to On Site\n• ASAP task created automatically`,
      created_by: "system",
      category: "alerts",
    });
  }

  return NextResponse.json({ ok: true, alreadyFired: !!existing });
}
