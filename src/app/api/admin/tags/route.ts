import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Contact tags (contacts.tags text[]).
// GET ?view=all        [{ tag, count }] most-used first
// GET ?view=contacts   { tagsByContact: { [contactId]: string[] } }
// POST { action: "set", contactId, tags }
// POST { action: "rename", from, to }     every contact with the tag
// POST { action: "delete", tag }          every contact with the tag
// GETs return empty data (unavailable: true) until supabase-crm-phase2-3.sql runs.

// Trimmed, single-spaced, ≤40 chars, case-insensitively unique (first
// spelling wins, so "KW" and "kw" don't split one list into two).
function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const tag = String(t ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
  }
  return out.slice(0, 20);
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const view = new URL(req.url).searchParams.get("view") || "all";
  const { data, error } = await createAdminClient().from("contacts").select("id, tags").neq("stage", "deleted").neq("tags", "{}");
  if (error) return NextResponse.json(view === "contacts" ? { tagsByContact: {}, unavailable: true } : { tags: [], unavailable: true });

  if (view === "contacts") {
    return NextResponse.json({ tagsByContact: Object.fromEntries((data || []).map(c => [c.id, c.tags || []])) });
  }
  const counts = new Map<string, number>();
  for (const c of data || []) for (const t of c.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  return NextResponse.json({ tags: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count })) });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const body = await req.json();

  if (body.action === "set" && body.contactId) {
    const tags = cleanTags(body.tags);
    const { error } = await db.from("contacts").update({ tags }).eq("id", body.contactId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tags });
  }

  if ((body.action === "rename" || body.action === "delete") && (body.from || body.tag)) {
    const from = String(body.from || body.tag);
    const to = body.action === "rename" ? cleanTags([body.to])[0] : null;
    if (body.action === "rename" && !to) return NextResponse.json({ error: "New tag name required" }, { status: 400 });
    const { data: tagged, error } = await db.from("contacts").select("id, tags").contains("tags", [from]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const c of tagged || []) {
      const next = cleanTags((c.tags || []).map((t: string) => (t === from ? to : t)).filter(Boolean));
      await db.from("contacts").update({ tags: next }).eq("id", c.id);
    }
    return NextResponse.json({ updated: (tagged || []).length });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
