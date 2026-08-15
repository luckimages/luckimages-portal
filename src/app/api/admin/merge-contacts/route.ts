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

  const [{ data: keep }, { data: drop }] = await Promise.all([
    db.from("contacts").select("*").eq("id", keepId).single(),
    db.from("contacts").select("*").eq("id", dropId).single(),
  ]);

  if (!keep || !drop) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // Patch keeper with any data the duplicate has that the keeper is missing
  const patch: Record<string, unknown> = {};
  if (!keep.email      && drop.email)      patch.email      = drop.email;
  if (!keep.phone      && drop.phone)      patch.phone      = drop.phone;
  if (!keep.brokerage  && drop.brokerage)  patch.brokerage  = drop.brokerage;
  if (!keep.notes      && drop.notes)      patch.notes      = drop.notes;
  if (!keep.user_id    && drop.user_id)    patch.user_id    = drop.user_id;
  if (!keep.lead_source && drop.lead_source) patch.lead_source = drop.lead_source;
  if (Object.keys(patch).length > 0) {
    await db.from("contacts").update(patch).eq("id", keepId);
  }

  // Re-point all child records from drop → keep
  for (const { table, col } of CONTACT_REF_TABLES) {
    await db.from(table).update({ [col]: keepId }).eq(col, dropId);
  }

  // Delete the duplicate
  const { error } = await db.from("contacts").delete().eq("id", dropId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("company_updates").insert({
    message: `🔀 Contacts merged — "${drop.name}" folded into "${keep.name}" by ${user.email?.split("@")[0] || "admin"}`,
    created_by: user.email?.split("@")[0] || "system",
    category: "admin",
    link: `/admin/contacts/${keepId}`,
  });

  return NextResponse.json({ ok: true, keepId, droppedId: dropId });
}
