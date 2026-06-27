import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { name, email, sqft, service, addons, total } = await request.json();

  if (!name || !email || !service) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

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
      from: "Luck Images Quote <onboarding@resend.dev>",
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

  return NextResponse.json({ ok: true });
}
