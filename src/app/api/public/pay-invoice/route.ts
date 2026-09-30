import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getStripe, stripeConfigured } from "@/lib/stripe";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

// Anyone with the invoice link — no login — can start payment for it. This
// is the deliberate counterpart to /api/portal/pay-invoice (which requires
// the realtor's own session): a shared-invoice link is meant to let a
// realtor's accountant, the homeowner, etc. pay on their behalf, so the
// invoice's own unguessable id is the access control here, not a user
// session. Mirrors that route's Stripe session logic exactly, just without
// the ownership check and with public-page redirect targets.
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Payments are not set up yet." }, { status: 503 });
  }

  const { invoiceId } = await req.json();
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: invoice } = await db.from("invoices").select("*").eq("id", invoiceId).single();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.paid) return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });

  const stripe = getStripe();

  if (invoice.stripe_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(invoice.stripe_session_id);
      if (existing.status === "open" && existing.url) {
        return NextResponse.json({ url: existing.url });
      }
    } catch {
      // Session doesn't exist / expired — fall through and create a new one.
    }
  }

  type InvoiceLineItem = { label: string; amount_cents: number };
  const stripeLineItems = invoice.line_items && invoice.line_items.length > 0
    ? invoice.line_items.map((li: InvoiceLineItem) => ({
        quantity: 1,
        price_data: { currency: "usd", unit_amount: li.amount_cents, product_data: { name: li.label } },
      }))
    : [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: invoice.amount_cents,
          product_data: { name: invoice.description || "Luck Images — Real Estate Media" },
        },
      }];

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: stripeLineItems,
    success_url: `${SITE_URL}/invoice/${invoice.id}?paid=1`,
    cancel_url: `${SITE_URL}/invoice/${invoice.id}`,
    metadata: { invoice_id: invoice.id },
  });

  await db.from("invoices").update({ stripe_session_id: session.id }).eq("id", invoice.id);

  return NextResponse.json({ url: session.url });
}
