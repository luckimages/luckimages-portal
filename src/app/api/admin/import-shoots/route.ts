import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows } = await req.json() as { rows: Record<string, string>[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const db = service();
  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const address = row.address?.trim();
    if (!address) { results.skipped++; continue; }

    // Find contact by name if provided
    let contactId: string | null = null;
    const clientName = row.client_name?.trim() || row.contact_name?.trim() || row.realtor?.trim();
    if (clientName) {
      const { data: found } = await db.from("contacts")
        .select("id").ilike("name", clientName).limit(1).maybeSingle();
      contactId = found?.id || null;

      // Create contact if not found and we have a name
      if (!contactId) {
        const { data: created } = await db.from("contacts").insert({
          name: clientName, type: "client", stage: "client",
        }).select("id").single();
        contactId = created?.id || null;
      }
    }

    // Parse date
    let scheduledAt: string | null = null;
    const dateStr = row.date?.trim() || row.scheduled_at?.trim();
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) scheduledAt = parsed.toISOString();
    }

    // Parse services
    const servicesRaw = row.services?.trim();
    const services = servicesRaw
      ? servicesRaw.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
      : [];

    // Parse price
    const price = row.price ? parseFloat(row.price.replace(/[$,]/g, "")) || null : null;

    // Status
    const rawStatus = (row.status?.trim() || "completed").toLowerCase();
    const validStatuses = ["pending","scheduled","en_route","on_site","wrapping","editing","delivered","completed","cancelled"];
    const status = validStatuses.includes(rawStatus) ? rawStatus : "completed";

    const { error } = await db.from("shoots").insert({
      address,
      scheduled_at: scheduledAt,
      services,
      status,
      price,
      contact_id: contactId,
      package_name: services.length === 1 ? services[0] : services.length > 1 ? services.join(" + ") : null,
      notes: row.notes?.trim() || null,
      square_footage: row.sqft ? parseInt(row.sqft) || null : null,
    });

    if (error) {
      results.errors.push(`${address}: ${error.message}`);
    } else {
      results.imported++;
    }
  }

  return NextResponse.json(results);
}
