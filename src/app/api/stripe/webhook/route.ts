import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

// Stripe calls this when a payment completes. Verifies the signature, then
// marks the matching invoice paid. Configure the endpoint + signing secret in
// the Stripe dashboard (STRIPE_WEBHOOK_SECRET).
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text(); // raw body required for signature verification
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("stripe webhook: signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      payment_intent?: string;
      metadata?: { invoice_id?: string };
    };
    const invoiceId = session.metadata?.invoice_id;

    const db = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Match by metadata invoice id, falling back to the stored session id.
    const query = db.from("invoices").update({
      paid: true,
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    });
    const { data: updated } = invoiceId
      ? await query.eq("id", invoiceId).select("id, description, amount_cents").maybeSingle()
      : await query.eq("stripe_session_id", session.id).select("id, description, amount_cents").maybeSingle();

    if (updated) {
      await db.from("company_updates").insert({
        message: `💵 Invoice paid — ${updated.description || "Luck Images"} · $${(updated.amount_cents / 100).toLocaleString()}`,
        created_by: "system",
        category: "finance",
      });
    }
  }

  return NextResponse.json({ received: true });
}
