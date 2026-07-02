import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { createGmailDraft } from "@/lib/gmail";
import { ADMIN_EMAILS } from "@/lib/constants";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contactId, to, subject, html } = await req.json();
  if (!to || !subject || !html) {
    return NextResponse.json({ error: "to, subject, and html are required" }, { status: 400 });
  }

  try {
    const draft = await createGmailDraft({ to, subject, html });

    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await service.from("email_log").insert({
      contact_id: contactId || null,
      subject: `[DRAFT] ${subject}`,
      body: null,
      sent_by: user.email?.split("@")[0] || "ryan",
    });

    return NextResponse.json({ ok: true, draftId: draft.id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to create draft" }, { status: 502 });
  }
}
