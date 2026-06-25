import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const { contactId, userId, email } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = service();

  if (contactId) {
    // Direct link by contactId
    await db.from("contacts").update({ user_id: userId }).eq("id", contactId).is("user_id", null);
  } else if (email) {
    // Auto-link by email match
    const { data: existing } = await db.from("contacts").select("id, user_id").eq("email", email).maybeSingle();
    if (existing && !existing.user_id) {
      await db.from("contacts").update({ user_id: userId }).eq("id", existing.id);
    } else if (!existing) {
      // Auto-create contact from their auth profile
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
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
