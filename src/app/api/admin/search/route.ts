import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// ⌘K search across contacts (name, email, brokerage, phone) and shoots
// (address). GET /api/admin/search?q=<text>
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ contacts: [], shoots: [] });

  // Strip characters that are syntax inside a PostgREST or() filter or LIKE
  // wildcards, so typed text can only ever be a plain substring match.
  const text = q.replace(/[,()"\\%*]/g, " ").replace(/\s+/g, " ").trim();
  // Phones are stored formatted ("(512) 555-1234") — match typed digits in
  // order with anything between them.
  const digits = q.replace(/\D/g, "");

  const db = createAdminClient();
  const contactCols = "id, name, email, phone, brokerage, type, stage";
  const [byText, byPhone, shoots] = await Promise.all([
    text.length >= 2
      ? db.from("contacts").select(contactCols)
          .or(`name.ilike."%${text}%",email.ilike."%${text}%",brokerage.ilike."%${text}%"`)
          .neq("stage", "deleted").order("name").limit(8)
      : Promise.resolve({ data: [] }),
    digits.length >= 3
      ? db.from("contacts").select(contactCols).ilike("phone", `%${digits.split("").join("%")}%`).neq("stage", "deleted").limit(8)
      : Promise.resolve({ data: [] }),
    text.length >= 2
      ? db.from("shoots").select("id, address, scheduled_at, status").ilike("address", `%${text}%`).order("scheduled_at", { ascending: false }).limit(6)
      : Promise.resolve({ data: [] }),
  ]);

  const seen = new Set<string>();
  const contacts = [...(byText.data || []), ...(byPhone.data || [])].filter(c => !seen.has(c.id) && seen.add(c.id)).slice(0, 8);
  return NextResponse.json({ contacts, shoots: shoots.data || [] });
}
