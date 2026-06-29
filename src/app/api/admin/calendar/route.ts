import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7); // YYYY-MM
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(year, mon - 1, 1).toISOString();
  const end = new Date(year, mon, 1).toISOString();

  const db = service();

  const [
    { data: shoots },
    { data: updates },
    { data: contacts },
    { data: calls },
    { data: timeEntries },
  ] = await Promise.all([
    db.from("shoots")
      .select("id, address, status, scheduled_at, delivered_at, paid_at, contact_id, price")
      .or(`scheduled_at.gte.${start},delivered_at.gte.${start},paid_at.gte.${start}`)
      .lt("scheduled_at", end)
      .order("scheduled_at", { ascending: true }),
    db.from("company_updates")
      .select("id, message, category, created_at, created_by")
      .gte("created_at", start).lt("created_at", end)
      .order("created_at", { ascending: true }),
    db.from("contacts")
      .select("id, name, created_at, stage")
      .gte("created_at", start).lt("created_at", end)
      .order("created_at", { ascending: true }),
    db.from("cold_calls")
      .select("id, called_at, outcome, called_by, contact_id, listing_address")
      .gte("called_at", start).lt("called_at", end)
      .order("called_at", { ascending: true }),
    db.from("time_entries")
      .select("id, user_id, user_name, started_at, stopped_at, duration_seconds")
      .gte("started_at", start).lt("started_at", end)
      .order("started_at", { ascending: true }),
  ]);

  // Merge contact names into calls
  const callContactIds = [...new Set((calls || []).map((c: { contact_id: string }) => c.contact_id).filter(Boolean))];
  const { data: callContacts } = callContactIds.length
    ? await db.from("contacts").select("id, name").in("id", callContactIds)
    : { data: [] };
  const nameMap = Object.fromEntries((callContacts || []).map((c: { id: string; name: string }) => [c.id, c.name]));

  return NextResponse.json({
    shoots: shoots || [],
    updates: updates || [],
    contacts: contacts || [],
    calls: (calls || []).map((c: { id: string; called_at: string; outcome: string; called_by: string; contact_id: string; listing_address: string | null }) => ({
      ...c,
      contact_name: nameMap[c.contact_id] || null,
    })),
    timeEntries: timeEntries || [],
  });
}
