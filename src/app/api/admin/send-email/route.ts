import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { sendAdminEmail } from "@/lib/sendAdminEmail";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId, to, subject, body, html, category, cc, additionalContactIds } = await req.json();

  const service = createAdminClient();

  // Every send through here is marketing/outreach (Outreach templates, Quick
  // Send, Mass Invite, cold-call pitches), so it honors unsubscribe and Do Not
  // Contact. Booking, delivery, and invoice emails don't come through here.
  const result = await sendAdminEmail(service, admin, { contactId, to, subject, body, html, category, cc, additionalContactIds });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, ...(result.skipped ? { skipped: true, reason: result.reason } : {}) },
      { status: result.status }
    );
  }

  return NextResponse.json({ ok: true, skippedCc: result.skippedCc });
}
