import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase-server";

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const { contactId, userId, email, leadSource, referredByContactId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // This writes contacts.user_id (who owns a CRM record — and therefore its
  // shoot/media/invoice history) from a client-supplied userId. Without
  // confirming that id matches the caller's own logged-in session, anyone
  // could link an arbitrary agent's unclaimed lead record to their own
  // account and read that agent's whole portal history.
  const session = await createSessionClient();
  const { data: { user: caller } } = await session.auth.getUser();
  if (!caller || caller.id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = service();

  const sourceFields: Record<string, string | null> = {};
  if (leadSource) sourceFields.lead_source = leadSource;
  if (referredByContactId) sourceFields.referred_by_contact_id = referredByContactId;

  const registeredAt = new Date().toISOString();

  const { data: { user } } = await db.auth.admin.getUserById(userId);

  // This route only ever runs for the realtor /register flow (photographers
  // register through the separate /api/auth/photographer-invite path), so
  // every registrant here is a realtor — full stop, no metadata check needed.
  // Most contacts start life as a cold-call or web lead (type "lead") long
  // before they ever register, so this has to apply when linking an
  // EXISTING contact too, not just a brand-new one — never downgrades an
  // already-elevated type (employee/admin/realtor).
  const registrantType = "realtor";
  function promotedType(currentType: string | null | undefined) {
    return !currentType || currentType === "lead" ? { type: registrantType } : {};
  }

  // Shoots booked for a contact BEFORE they registered only carry contact_id
  // (client_id is set at booking time only if the contact already had a
  // portal account — see admin/shoots POST). Without this, a contact who
  // registers after already having shoots on the books never gets client_id
  // backfilled on those rows, and the client portal's shoot query filters on
  // client_id, so their existing shoots silently never appear.
  async function backfillShootClientId(contactId: string) {
    await db.from("shoots").update({ client_id: userId }).eq("contact_id", contactId).is("client_id", null);
  }

  if (contactId) {
    const { data: existingContact } = await db.from("contacts").select("type").eq("id", contactId).maybeSingle();
    await db.from("contacts").update({ user_id: userId, email: email || undefined, registered_at: registeredAt, ...sourceFields, ...promotedType(existingContact?.type) }).eq("id", contactId).is("user_id", null);
    await backfillShootClientId(contactId);
  } else if (email) {
    const { data: existing } = await db.from("contacts").select("id, user_id, email, type").eq("email", email).maybeSingle();
    if (existing && !existing.user_id) {
      await db.from("contacts").update({ user_id: userId, email, registered_at: registeredAt, ...sourceFields, ...promotedType(existing.type) }).eq("id", existing.id);
      await backfillShootClientId(existing.id);
    } else if (!existing) {
      if (user) {
        await db.from("contacts").insert({
          name: user.user_metadata?.full_name || email.split("@")[0],
          email: user.email,
          phone: user.user_metadata?.phone || null,
          brokerage: user.user_metadata?.brokerage || null,
          stage: "registered",
          type: registrantType,
          user_id: userId,
          registered_at: registeredAt,
          ...sourceFields,
        });
      }
    }
  }

  // Notify admins of new portal registration
  try {
    const name = user?.user_metadata?.full_name || email || "Someone";
    await db.from("company_updates").insert({ message: `New portal registration — ${name}`, created_by: "system", link: "/admin/contacts", category: "clients" });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
