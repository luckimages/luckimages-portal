import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { captureWebLead } from "@/lib/webLeads";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(request: NextRequest) {
  const allowed = await checkRateLimit(db(), `quote:${getClientIp(request)}`, { max: 5, windowSeconds: 600 });
  if (!allowed) return NextResponse.json({ error: "Too many requests — please try again in a few minutes." }, { status: 429 });

  const { name, email, sqft, service, addons, total } = await request.json();

  if (!name || !email || !service) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Into the CRM: contact + "call them" follow-up, and the request itself for
  // Updates → Website Inquiries. Failures are logged, never block the email.
  const addonNames: string[] = (addons || []).map((a: { name: string }) => a.name);
  const contactId = await captureWebLead(db(), {
    name,
    email,
    phone: null,
    source: "website-quote",
    followUpNote: [
      `Quote request: ${[service.name, ...addonNames].join(", ")}`,
      total != null ? `Est. $${total}` : null,
      sqft ? `${sqft} sq ft` : null,
    ].filter(Boolean).join(" · "),
  });
  const { error: saveError } = await db().from("contact_inquiries").insert({
    kind: "quote",
    contact_id: contactId,
    first_name: name,
    email,
    services: [service.name, ...addonNames],
    square_footage: sqft ? String(sqft) : null,
    quote_total: typeof total === "number" ? total : Number(total) || null,
  });
  if (saveError) console.error("quote: failed to save inquiry", saveError);

  const addonLines = addons?.length
    ? addons.map((a: { name: string; price: number }) => `  · ${a.name} — $${a.price}`).join("\n")
    : "  None";

  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    sqft ? `Square Footage / Acreage: ${sqft}` : null,
    ``,
    `Primary Service: ${service.name} — $${service.price}`,
    ``,
    `Add-Ons:`,
    addonLines,
    ``,
    `Estimated Total: $${total}`,
  ].filter((l) => l !== null).join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Ryan Luck <ryan@luckimages.com>",
      to: ["ryan@luckimages.com"],
      reply_to: email,
      subject: `New quote request — ${name}`,
      text: body,
    }),
  });

  if (!res.ok) {
    console.error("Resend error:", await res.text());
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  // Log to company_updates so the lead survives even if the email above
  // gets missed/junked — this used to insert into a "web_leads" table that
  // was referenced in code but never actually existed in the database, so
  // every quote request was silently dropped everywhere except the email.
  const { error: logError } = await db().from("company_updates").insert({
    message: `💬 New quote request — ${name} · ${service?.name || "Unknown service"} ($${total ?? service?.price ?? "?"})${email ? ` · ${email}` : ""}`,
    created_by: "system",
    category: "clients",
  });
  if (logError) console.error("quote: failed to log company_updates row", logError);

  return NextResponse.json({ ok: true });
}
