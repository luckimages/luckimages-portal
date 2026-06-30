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

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = service();

  const url = new URL(req.url ?? "http://localhost");
  const history = url.searchParams.get("history") === "1";

  // Manual posts (includes system-generated ones with links)
  const postsQuery = db.from("company_updates").select("id, message, created_by, created_at, category").order("created_at", { ascending: false });
  if (!history) postsQuery.limit(40);
  const { data: posts } = await postsQuery;

  // Auto-generated activity from other tables (last 120h, or all-time if ?history=1)
  const since = history ? new Date(0).toISOString() : new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString();
  const rowLimit = history ? 500 : 15;
  const [{ data: calls }, { data: contacts }, { data: shoots }, { data: lateShoots }] = await Promise.all([
    db.from("cold_calls").select("id, called_at, outcome, called_by, listing_address, contact_id").gte("called_at", since).order("called_at", { ascending: false }).limit(rowLimit),
    db.from("contacts").select("id, name, created_at, stage").gte("created_at", since).order("created_at", { ascending: false }).limit(rowLimit),
    db.from("shoots").select("id, address, scheduled_at, status, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(rowLimit),
    // Late photographer check — only truly missing (scheduled/en_route = not yet arrived)
    // on_site/wrapping = clearly there, just didn't log check-in → no alert
    db.from("shoots").select("id, address, scheduled_at, status").in("status", ["scheduled", "en_route"]).lt("scheduled_at", new Date(Date.now() + 60 * 60 * 1000).toISOString()).is("checked_in_at", null),
  ]);

  // Merge contact names into calls
  const contactIds = [...new Set((calls || []).map((c: {contact_id: string}) => c.contact_id))];
  const { data: contactNames } = contactIds.length
    ? await db.from("contacts").select("id, name").in("id", contactIds)
    : { data: [] };
  const nameMap = Object.fromEntries((contactNames || []).map((c: {id: string; name: string}) => [c.id, c.name]));

  type AutoItem = { id: string; type: string; category: string; message: string; created_at: string; by?: string; link?: string };
  const nowIso = new Date().toISOString();
  const lateAlerts: AutoItem[] = (lateShoots || []).map((s: {id: string; address: string; scheduled_at: string}) => ({
    id: `late-${s.id}`,
    type: "alert",
    category: "alerts",
    message: `Photographer not checked in — ${s.address} was scheduled for ${new Date(s.scheduled_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
    created_at: nowIso,
    link: "/dashboard/board",
  }));
  const auto: AutoItem[] = [
    ...(calls || []).map((c: {id: string; called_at: string; outcome: string; called_by: string; listing_address: string | null; contact_id: string}) => ({
      id: `call-${c.id}`,
      type: "call",
      category: "clients",
      message: `${c.called_by} logged a call — ${nameMap[c.contact_id] || "contact"}${c.listing_address ? ` (${c.listing_address})` : ""} — ${c.outcome.replace("_", " ")}`,
      created_at: c.called_at,
      by: c.called_by,
      link: c.contact_id ? `/admin/contacts/${c.contact_id}` : undefined,
    })),
    ...(contacts || []).map((c: {id: string; name: string; created_at: string; stage: string}) => ({
      id: `contact-${c.id}`,
      type: "contact",
      category: "clients",
      message: `New contact — ${c.name} (${c.stage})`,
      created_at: c.created_at,
      link: `/admin/contacts/${c.id}`,
    })),
    ...(shoots || []).map((s: {id: string; address: string; scheduled_at: string; status: string; created_at: string}) => ({
      id: `shoot-${s.id}`,
      type: "shoot",
      category: "shoots",
      message: `Shoot booked — ${s.address}`,
      created_at: s.created_at,
      link: "/dashboard/board",
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 15);

  // Late alerts always float to top regardless of scheduled_at
  const allAuto = [...lateAlerts, ...auto];

  const mappedPosts = (posts || []).map((p: { id: string; message: string; created_at: string; created_by: string; category?: string }) => ({
    id: p.id,
    type: p.created_by === "system" ? "tool" : "post",
    category: p.category || "nocturne",
    message: p.message,
    created_at: p.created_at,
    by: p.created_by !== "system" ? p.created_by : undefined,
  }));

  return NextResponse.json({ posts: mappedPosts, auto: allAuto });
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
