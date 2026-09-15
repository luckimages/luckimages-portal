import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Hardcoded rather than resolved via auth.admin.listUsers({perPage:1000}) —
// see src/app/api/me/route.ts for why: that's a full GoTrue admin API call
// just to look up 2 stable ids, paid on every photographer-picker load
// across 4+ pages. Nothing here has ever rendered .email, so it's dropped
// rather than replaced with a per-id getUserById lookup.
const ADMINS = [
  { id: "81d6e793-ff8d-4bf1-87c2-480d9eef61d8", name: "Ryan", email: "ryan@luckimages.com" },
  { id: "dc9ee0b0-878b-4f77-8e2d-38faf466ff45", name: "Leif", email: "leif@luckimages.com" },
];

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "photographer");

  const seen = new Set(ADMINS.map(a => a.id));
  const result: { id: string; name: string; email: string }[] = [...ADMINS];

  for (const p of profiles ?? []) {
    if (!seen.has(p.id)) {
      result.push({ id: p.id, name: p.full_name || p.id, email: "" });
      seen.add(p.id);
    }
  }

  return NextResponse.json(result);
}
