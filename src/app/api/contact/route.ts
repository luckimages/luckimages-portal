import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { firstName, lastName, email, phone, address, listingType, services, deliverBy, details } = await request.json();

  if (!firstName || !email || !phone || !address || !services?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

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
      from: "Luck Images Contact <contact@luckimages.com>",
      to: ["ryan@luckimages.com", "leif@luckimages.com"],
      reply_to: email,
      subject: `New inquiry — ${firstName} ${lastName} · ${address}`,
      text: body,
    }),
  });

  if (!res.ok) {
    console.error("Resend error:", await res.text());
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
