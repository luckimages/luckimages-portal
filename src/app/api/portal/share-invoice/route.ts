import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { buildShareInvoiceEmail } from "@/lib/shareInvoiceEmail";
import { CLIENT_EMAILS_ENABLED } from "@/lib/constants";

function db() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// A logged-in realtor shares one of their own invoices with a third party
// (an accountant, the homeowner, a broker...) who needs to pay it but has no
// portal login of their own. Emails that person a no-login-required pay
// link (/invoice/[id]) and drops a Command Center note so Ryan/Leif know who
// it went to and how that person relates to the shoot.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoiceId, recipientName, recipientEmail, relationship } = await req.json();
  if (!invoiceId || !recipientName?.trim() || !recipientEmail?.trim()) {
    return NextResponse.json({ error: "Recipient name and email are required" }, { status: 400 });
  }
  const email = recipientEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const svc = db();

  const { data: invoice } = await svc
    .from("invoices")
    .select("id, shoot_id, amount_cents, client_id, contact_id")
    .eq("id", invoiceId)
    .single();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Same ownership check as paying an invoice — a realtor can only share
  // their own invoices, never one they merely have the id of.
  let owns = invoice.client_id === user.id;
  if (!owns && invoice.contact_id) {
    const { data: c } = await svc.from("contacts").select("user_id, name").eq("id", invoice.contact_id).single();
    owns = c?.user_id === user.id;
  }
  if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: contact } = await svc.from("contacts").select("name").eq("user_id", user.id).maybeSingle();
  const realtorName = contact?.name || user.user_metadata?.full_name || "Your Luck Images realtor";

  let address = "your property";
  let services: string[] = [];
  if (invoice.shoot_id) {
    const { data: shoot } = await svc.from("shoots").select("address, services").eq("id", invoice.shoot_id).maybeSingle();
    if (shoot) { address = shoot.address; services = shoot.services || []; }
  }

  const { subject, html, invoiceUrl } = buildShareInvoiceEmail({
    recipientName: recipientName.trim(),
    realtorName,
    address,
    services,
    amountCents: invoice.amount_cents,
    invoiceId: invoice.id,
  });

  const resendKey = process.env.RESEND_API_KEY;
  if (CLIENT_EMAILS_ENABLED && resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Ryan Luck <ryan@luckimages.com>",
        to: [email],
        reply_to: "ryan@luckimages.com",
        subject,
        html,
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Could not send the email — try again in a moment." }, { status: 502 });
    }
  }

  await svc.from("company_updates").insert({
    message: `📤 ${realtorName} shared an invoice (${address}) with ${recipientName.trim()}${relationship?.trim() ? ` — ${relationship.trim()}` : ""} · ${email}`,
    created_by: "system",
    category: "finance",
    link: "/dashboard/revenue",
  });

  return NextResponse.json({ ok: true, invoiceUrl });
}
