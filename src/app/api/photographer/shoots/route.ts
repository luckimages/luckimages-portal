import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

// PATCH — photographer advances shoot status
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();

  // Only allow photographer-owned stages
  const ALLOWED = ["en_route", "on_site", "wrapping", "editing", "delivered"];
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify this photographer is assigned to this shoot
  const { data: shoot } = await service
    .from("shoots")
    .select("id, photographer_ids")
    .eq("id", id)
    .single();

  if (!shoot || !shoot.photographer_ids?.includes(user.id)) {
    return NextResponse.json({ error: "Not your shoot" }, { status: 403 });
  }

  const { error } = await service.from("shoots").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
