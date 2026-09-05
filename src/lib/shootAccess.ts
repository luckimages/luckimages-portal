import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ADMIN_EMAILS } from "@/lib/constants";

export function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function checkShootAccess(userId: string, userEmail: string, shootId: string) {
  if (ADMIN_EMAILS.includes(userEmail)) return { allowed: true, canEdit: true };

  const db = serviceClient();
  const { data: shoot } = await db
    .from("shoots")
    .select("photographer_ids, client_id, contact_id")
    .eq("id", shootId)
    .single();

  if (!shoot) return { allowed: false, canEdit: false };

  if (shoot.photographer_ids?.includes(userId)) return { allowed: true, canEdit: true };

  if (shoot.client_id === userId) return { allowed: true, canEdit: false };

  if (shoot.contact_id) {
    const { data: contact } = await db.from("contacts").select("user_id").eq("id", shoot.contact_id).single();
    if (contact?.user_id === userId) return { allowed: true, canEdit: false };
  }

  return { allowed: false, canEdit: false };
}

// Admins/photographers always have full access. A client/viewer is gated on
// invoice status — no invoice, or a paid one, unlocks downloads.
export async function checkCanDownload(db: ReturnType<typeof serviceClient>, canEdit: boolean, shootId: string) {
  if (canEdit) return true;
  const { data: invoice } = await db.from("invoices").select("paid").eq("shoot_id", shootId).maybeSingle();
  return !invoice || invoice.paid;
}
