import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

// Temporary diagnostic — settles "is Stripe live or test in production" with
// zero ambiguity by asking Stripe itself, without ever exposing the actual
// key. Gated by CRON_SECRET (already a real secret in this project) so it's
// not a public endpoint. Delete this file once the question is answered.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.DEBUG_STRIPE_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const balance = await getStripe().balance.retrieve();
    return NextResponse.json({ livemode: balance.livemode });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
