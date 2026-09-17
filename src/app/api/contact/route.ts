import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { captureWebLead } from "@/lib/webLeads";

export async function POST(request: NextRequest) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const allowed = await checkRateLimit(db, `contact:${getClientIp(request)}`, { max: 5, windowSeconds: 600 });
  if (!allowed) return NextResponse.json({ error: "Too many requests — please try again in a few minutes." }, { status: 429 });

  const { firstName, lastName, email, phone, address, listingType, services, deliverBy, details } = await request.json();

  if (!firstName || !email || !phone || !address || !services?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Into the CRM first: match or create the contact and give them a "call
  // them" follow-up due today (Updates → Follow-ups Due).
  const name = `${firstName} ${lastName || ""}`.trim();
  const contactId = await captureWebLead(db, {
    name,
    email,
    phone,
    source: "website-form",
    followUpNote: [
      `Website contact form: ${services.join(", ")}`,
      address,
      deliverBy ? `Needed by ${deliverBy}` : null,
      details || null,
    ].filter(Boolean).join(" · "),
  });

  // Save the inquiry itself (Command Center → Updates → Website Inquiries) so
  // the lead survives even if the email below fails or gets junked.
  const { error: saveError } = await db.from("contact_inquiries").insert({
    kind: "contact",
    contact_id: contactId,
    first_name: firstName,
    last_name: lastName || null,
    email,
    phone,
    address,
    listing_type: listingType || null,
    services,
    deliver_by: deliverBy || null,
    details: details || null,
  });
  if (saveError) console.error("contact: failed to save inquiry", saveError);

  const body = [
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Address: ${address}`,
    listingType ? `Listing Type: ${listingType}` : null,
    `Services: ${services.join(", ")}`,
    deliverBy ? `Deliver By: ${deliverBy}` : null,
    details ? `\nDetails:\n${details}` : null,
  ].filter(Boolean).join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Ryan Luck <ryan@luckimages.com>",
      to: ["ryan@luckimages.com"],
      cc: ["leif@luckimages.com"],
      reply_to: email,
      subject: `New inquiry — ${firstName} ${lastName} · ${address}`,
      text: body,
    }),
  });

  if (!res.ok) {
    console.error("Resend error:", await res.text());
    // Only tell the visitor it failed if it also didn't save — otherwise we
    // have it in Nocturne and they'd just resubmit a duplicate.
    if (saveError) return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
