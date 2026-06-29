import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const { contactId, userId, email, leadSource, referredByContactId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = service();

  const sourceFields: Record<string, string | null> = {};
  if (leadSource) sourceFields.lead_source = leadSource;
  if (referredByContactId) sourceFields.referred_by_contact_id = referredByContactId;

  if (contactId) {
    await db.from("contacts").update({ user_id: userId, ...sourceFields }).eq("id", contactId).is("user_id", null);
  } else if (email) {
    const { data: existing } = await db.from("contacts").select("id, user_id").eq("email", email).maybeSingle();
    if (existing && !existing.user_id) {
      await db.from("contacts").update({ user_id: userId, ...sourceFields }).eq("id", existing.id);
    } else if (!existing) {
      const { data: { user } } = await db.auth.admin.getUserById(userId);
      if (user) {
        await db.from("contacts").insert({
          name: user.user_metadata?.full_name || email.split("@")[0],
          email: user.email,
          phone: user.user_metadata?.phone || null,
          brokerage: user.user_metadata?.brokerage || null,
          stage: "registered",
          type: "client",
          user_id: userId,
          ...sourceFields,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
