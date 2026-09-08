import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

function db() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

// A realtor refers another agent from their portal. Creates a lead contact on
// our side (attributed to the referrer), emails the referred agent a
// registration link, and drops a Command Center note for the team.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { friendName, friendEmail } = await request.json();
  if (!friendName?.trim() || !friendEmail?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  const email = friendEmail.trim().toLowerCase();

  // Identify the referrer from their own logged-in contact record — never
  // trust an id from the request body.
  const { data: referrer } = await db()
    .from("contacts")
    .select("id, name")
    .eq("user_id", user.id)
    .single();
  if (!referrer) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const referrerName = referrer.name || user.user_metadata?.full_name || "A Luck Images client";
  const referralLink = `${BASE_URL}/register?ref=${referrer.id}`;

  // Create the lead — but don't clobber an existing contact (e.g. someone
  // who's already a client). Only fill in the referral attribution if it's
  // genuinely new or still an untracked lead.
  const { data: existing } = await db().from("contacts").select("id, stage").eq("email", email).maybeSingle();
  let alreadyKnown = false;
  if (existing) {
    alreadyKnown = existing.stage !== "lead";
    if (existing.stage === "lead") {
      await db().from("contacts").update({ referred_by_contact_id: referrer.id, lead_source: "referral" }).eq("id", existing.id);
    }
  } else {
    await db().from("contacts").insert({
      name: friendName.trim(),
      email,
      stage: "lead",
      lead_source: "referral",
      referred_by_contact_id: referrer.id,
    });
  }

  const resendKey = process.env.RESEND_API_KEY;

  // Email the referred agent with the registration link
  if (resendKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Ryan Luck <ryan@luckimages.com>",
        to: [email],
        reply_to: "ryan@luckimages.com",
        subject: `${referrerName} thinks you'd love Luck Images`,
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#000;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:48px 0;"><tr><td align="center">
  <table width="520" cellpadding="0" cellspacing="0" style="background:#0c0c0c;border:1px solid #222;padding:48px;">
    <tr><td>
      <img src="${BASE_URL}/logo.png" width="40" height="40" alt="Luck Images" style="display:block;margin:0 auto 24px;border:0;" />
      <p style="margin:0 0 32px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#555;text-align:center;">You've been referred</p>
      <p style="margin:0 0 20px;font-size:14px;color:#888;line-height:1.6;">Hey ${friendName.trim().split(" ")[0]},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#888;line-height:1.6;"><strong style="color:#fff;">${referrerName}</strong> referred you to Luck Images — Austin's real estate media team. Professional listing photos, drone, video, Matterport, virtual staging and more, delivered within 24 hours.</p>
      <p style="margin:0 0 32px;font-size:14px;color:#888;line-height:1.6;">Create your account and book your first shoot:</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 32px;">
        <a href="${referralLink}" style="display:inline-block;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:16px 32px;text-decoration:none;">Create Your Account →</a>
      </td></tr></table>
      <p style="margin:0;font-size:11px;color:#333;text-align:center;">Luck Images · Austin, TX · luckimages.com</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`,
      }),
    });
  }

  await db().from("company_updates").insert({
    message: `🤝 New referral from ${referrerName} — ${friendName.trim()} (${email})${alreadyKnown ? " · already in contacts" : " · added as a lead"}. Registration email sent.`,
    created_by: "system",
    category: "clients",
    link: "/admin/contacts",
  });

  return NextResponse.json({ ok: true, alreadyKnown });
}
