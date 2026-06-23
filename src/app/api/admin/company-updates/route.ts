import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = service();

  // Manual posts
  const { data: posts } = await db.from("company_updates").select("*").order("created_at", { ascending: false }).limit(20);

  // Auto-generated activity from other tables (last 48h)
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const [{ data: calls }, { data: contacts }, { data: shoots }] = await Promise.all([
    db.from("cold_calls").select("id, called_at, outcome, called_by, listing_address, contact_id").gte("called_at", since).order("called_at", { ascending: false }).limit(10),
    db.from("contacts").select("id, name, created_at, stage").gte("created_at", since).order("created_at", { ascending: false }).limit(10),
    db.from("shoots").select("id, address, scheduled_at, status, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5),
  ]);

  // Merge contact names into calls
  const contactIds = [...new Set((calls || []).map((c: {contact_id: string}) => c.contact_id))];
  const { data: contactNames } = contactIds.length
    ? await db.from("contacts").select("id, name").in("id", contactIds)
    : { data: [] };
  const nameMap = Object.fromEntries((contactNames || []).map((c: {id: string; name: string}) => [c.id, c.name]));

  type AutoItem = { id: string; type: string; message: string; created_at: string; by?: string };
  const auto: AutoItem[] = [
    ...(calls || []).map((c: {id: string; called_at: string; outcome: string; called_by: string; listing_address: string | null; contact_id: string}) => ({
      id: `call-${c.id}`,
      type: "call",
      message: `${c.called_by} logged a call — ${nameMap[c.contact_id] || "contact"}${c.listing_address ? ` (${c.listing_address})` : ""} — ${c.outcome.replace("_", " ")}`,
      created_at: c.called_at,
      by: c.called_by,
    })),
    ...(contacts || []).map((c: {id: string; name: string; created_at: string; stage: string}) => ({
      id: `contact-${c.id}`,
      type: "contact",
      message: `New contact added — ${c.name} (${c.stage})`,
      created_at: c.created_at,
    })),
    ...(shoots || []).map((s: {id: string; address: string; scheduled_at: string; status: string; created_at: string}) => ({
      id: `shoot-${s.id}`,
      type: "shoot",
      message: `Shoot ${s.status} — ${s.address}`,
      created_at: s.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 15);

  return NextResponse.json({ posts: posts || [], auto });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "No message" }, { status: 400 });

  const db = service();
  const name = user.email?.split("@")[0] || "unknown";
  const { data, error } = await db.from("company_updates").insert({ message: message.trim(), created_by: name }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}
