import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { r2SignedUrl, R2_MEDIA_BUCKET } from "@/lib/r2";
import { adminSender } from "@/lib/constants";

// POST /api/archive/share { file_id, contact_id }
// Emails a File Archive item's download link to a contact via Resend, same
// sender pattern as /api/admin/send-email (from whichever admin clicked
// share). The link is a 7-day presigned R2 URL — long enough for a
// recipient to actually get to it, short enough not to be a permanent leak.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { file_id, contact_id } = await req.json();
  if (!file_id || !contact_id) return NextResponse.json({ error: "file_id and contact_id required" }, { status: 400 });

  const db = createAdminClient();
  const [{ data: file }, { data: contact }] = await Promise.all([
    db.from("archive_files").select("id, name, file_key").eq("id", file_id).single(),
    db.from("contacts").select("id, name, email").eq("id", contact_id).single(),
  ]);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!contact?.email) return NextResponse.json({ error: "Contact has no email" }, { status: 400 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });

  const url = await r2SignedUrl(R2_MEDIA_BUCKET, file.file_key, 7 * 24 * 3600);
  const sender = adminSender(admin.email);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: sender.from,
      reply_to: sender.replyTo,
      to: [contact.email],
      subject: `File shared: ${file.name}`,
      html: `<p>${sender.fullName} shared a file with you: <strong>${file.name}</strong></p><p><a href="${url}">Download ${file.name}</a></p><p style="color:#888;font-size:12px">This link expires in 7 days.</p>`,
    }),
  });
  if (!resendRes.ok) {
    const errText = await resendRes.text();
    return NextResponse.json({ error: `Resend API error (${resendRes.status}): ${errText}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
