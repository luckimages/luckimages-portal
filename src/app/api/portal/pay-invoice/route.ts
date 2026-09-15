import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { getStripe, stripeConfigured } from "@/lib/stripe";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

// A logged-in client starts payment for one of their invoices. Creates a
// Stripe Checkout Session and returns its URL for redirect.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Verify this invoice belongs to the requester (by client_id or their contact)
  let owns = invoice.client_id === user.id;
  if (!owns && invoice.contact_id) {
    const { data: c } = await db.from("contacts").select("user_id").eq("id", invoice.contact_id).single();
    owns = c?.user_id === user.id;
  }
  if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const stripe = getStripe();

  // Two tabs / a reload / a double-click can hit this before either checkout
  // completes — reusing a still-open session instead of always creating a
  // fresh one means at most one live payment link exists per invoice at a
  // time, so there's nothing for the customer to accidentally pay twice.
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
    customer_email: user.email || undefined,
    line_items: stripeLineItems,
    success_url: `${SITE_URL}/client?paid=1`,
    cancel_url: `${SITE_URL}/client?tab=invoices`,
    metadata: { invoice_id: invoice.id },
  });

  await db.from("invoices").update({ stripe_session_id: session.id }).eq("id", invoice.id);

  return NextResponse.json({ url: session.url });
}
