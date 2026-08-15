import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";

const CONTACT_REF_TABLES = [
  { table: "shoots",      col: "contact_id" },
  { table: "invoices",    col: "contact_id" },
  { table: "email_log",   col: "contact_id" },
  { table: "link_clicks", col: "contact_id" },
  { table: "cold_calls",  col: "contact_id" },
  { table: "messages",    col: "contact_id" },
  { table: "quotes",      col: "contact_id" },
];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keepId, dropId } = await req.json();
  if (!keepId || !dropId || keepId === dropId) {
    return NextResponse.json({ error: "keepId and dropId required and must differ" }, { status: 400 });
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Pick the "base" contact: registered > has email > older
  const [{ data: rawA }, { data: rawB }] = await Promise.all([
    db.from("contacts").select("*").eq("id", keepId).single(),
    db.from("contacts").select("*").eq("id", dropId).single(),
  ]);
  if (!rawA || !rawB) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // Always base on the better record, regardless of which ID was passed as keepId
  function pickBase(a: Record<string,unknown>, b: Record<string,unknown>): [Record<string,unknown>, Record<string,unknown>] {
    if (a.user_id && !b.user_id) return [a, b];
    if (b.user_id && !a.user_id) return [b, a];
    if (a.email   && !b.email)   return [a, b];
    if (b.email   && !a.email)   return [b, a];
    return new Date(a.created_at as string) <= new Date(b.created_at as string) ? [a, b] : [b, a];
  }
  const [keep, drop] = pickBase(rawA, rawB);

  // Combine all data — never discard anything from either contact
  const patch: Record<string, unknown> = {};

  // Email: keep both if different
  const emails = [keep.email, drop.email].filter(Boolean).map((e) => (e as string).toLowerCase().trim());
  const uniqueEmails = [...new Set(emails)];
  if (uniqueEmails.length > 0) patch.email = uniqueEmails.join(", ");

  // Phone: keep both if different
  const phones = [keep.phone, drop.phone].filter(Boolean).map((p) => (p as string).trim());
  const uniquePhones = [...new Set(phones)];
  if (uniquePhones.length > 0) patch.phone = uniquePhones.join(", ");

  // Notes: concatenate both
  const notesParts = [keep.notes, drop.notes].filter(Boolean);
  if (notesParts.length > 0) patch.notes = notesParts.join("\n---\n");

  // Scalar fields: prefer non-null value, fall back to the other
  if (!keep.brokerage   && drop.brokerage)   patch.brokerage   = drop.brokerage;
  if (!keep.user_id     && drop.user_id)     patch.user_id     = drop.user_id;
  if (!keep.lead_source && drop.lead_source) patch.lead_source = drop.lead_source;

  if (Object.keys(patch).length > 0) {
    await db.from("contacts").update(patch).eq("id", keep.id);
  }

  // Re-point all child records from drop → keep
  for (const { table, col } of CONTACT_REF_TABLES) {
    await db.from(table).update({ [col]: keep.id }).eq(col, drop.id);
  }

  // Delete the duplicate
  const { error } = await db.from("contacts").delete().eq("id", drop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("company_updates").insert({
    message: `🔀 Contacts merged — "${drop.name}" folded into "${keep.name}" by ${user.email?.split("@")[0] || "admin"}`,
    created_by: user.email?.split("@")[0] || "system",
    category: "admin",
    link: `/admin/contacts/${keep.id}`,
  });

  return NextResponse.json({ ok: true, keepId: keep.id, droppedId: drop.id });
}
