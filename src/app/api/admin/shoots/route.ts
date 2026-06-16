import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createShootEvent } from "@/lib/googleCalendar";

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";

  const query = supabase
    .from("shoots")
    .select("id, address, scheduled_at, services, notes, square_footage, client_id, status")
    .order("scheduled_at", { ascending: true });

  if (!all) query.eq("status", "pending");
  else query.in("status", ["pending", "scheduled"]);

  const { data: shoots, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Look up client names from profiles
  const clientIds = [...new Set((shoots ?? []).map(s => s.client_id).filter(Boolean))];
  const nameMap: Record<string, string> = {};
  const emailMap: Record<string, string> = {};

  if (clientIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", clientIds);
    for (const p of profiles ?? []) {
      nameMap[p.id] = p.full_name ?? "";
    }

    // Also grab emails from auth
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users?.users ?? []) {
      if (clientIds.includes(u.id)) emailMap[u.id] = u.email ?? "";
    }
  }

  const result = (shoots ?? []).map(s => ({
    ...s,
    client_name: nameMap[s.client_id] || emailMap[s.client_id] || s.client_id,
    client_email: emailMap[s.client_id] || "",
  }));

  return NextResponse.json(result);
}

export async function PATCH(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { id, status } = await req.json();

  // Fetch shoot details before updating (needed for calendar event)
  const { data: shoot } = await supabase
    .from("shoots")
    .select("id, address, scheduled_at, services, notes, client_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("shoots").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If confirming, create Google Calendar event
  if (status === "scheduled" && shoot?.scheduled_at) {
    try {
      // Resolve client name + email
      let clientName = "";
      let clientEmail = "";
      if (shoot.client_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", shoot.client_id)
          .single();
        clientName = profile?.full_name ?? "";

        const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const user = users?.users.find(u => u.id === shoot.client_id);
        clientEmail = user?.email ?? "";
      }

      await createShootEvent({
        address: shoot.address,
        scheduledAt: shoot.scheduled_at,
        services: shoot.services ?? [],
        notes: shoot.notes ?? "",
        clientEmail: clientEmail || undefined,
        clientName: clientName || undefined,
      });
    } catch (calErr) {
      console.error("Google Calendar event creation failed:", calErr);
      // Don't fail the whole request if calendar fails
    }
  }

  return NextResponse.json({ ok: true });
}
