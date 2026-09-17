import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public. POST only — never unsubscribe on GET, because email security
// scanners open every link in a message (Mass Invite already sees those bot
// clicks) and would silently unsubscribe people.
//
// POST /api/unsubscribe?t=<token>   one-click (Gmail/Yahoo List-Unsubscribe-Post)
// POST /api/unsubscribe { token }   the /unsubscribe page's button
// POST /api/unsubscribe { email }   the /unsubscribe page without a token
//
// Always answers { ok: true } for a well-formed request, so the endpoint
// can't be used to check whether an email address is in our contacts.
export async function POST(req: Request) {
  const db = createAdminClient();
  if (!(await checkRateLimit(db, `unsubscribe:${getClientIp(req)}`, { max: 20, windowSeconds: 600 }))) {
    return NextResponse.json({ error: "Too many requests — please try again in a few minutes." }, { status: 429 });
  }

  let token = new URL(req.url).searchParams.get("t");
  let email: string | null = null;
  if ((req.headers.get("content-type") || "").includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    token = body.token || token;
    email = typeof body.email === "string" ? body.email.trim() : null;
  }

  const now = new Date().toISOString();
  if (token && UUID_RE.test(token)) {
    await db.from("contacts").update({ email_unsubscribed_at: now }).eq("unsubscribe_token", token).is("email_unsubscribed_at", null);
    return NextResponse.json({ ok: true });
  }
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const { data } = await db.from("contacts").select("id").ilike("email", email.replace(/[\\%_]/g, c => `\\${c}`));
    const ids = (data || []).map(c => c.id);
    if (ids.length) await db.from("contacts").update({ email_unsubscribed_at: now }).in("id", ids).is("email_unsubscribed_at", null);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "A valid unsubscribe link or email address is required." }, { status: 400 });
}
