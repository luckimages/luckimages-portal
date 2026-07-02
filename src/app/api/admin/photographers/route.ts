import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin, ADMIN_EMAILS } from "@/lib/supabase-server";

const ADMIN_NAMES: Record<string, string> = {
  "ryan@luckimages.com": "Ryan",
  "leif@luckimages.com": "Leif",
};

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const allUsers = users?.users ?? [];

  // Build result: admins first, then any profiles with role=photographer
  const result: { id: string; name: string; email: string }[] = [];
  const seen = new Set<string>();

  // Add admins by email
  for (const email of ADMIN_EMAILS) {
    const u = allUsers.find(u => u.email === email);
    if (u) {
      result.push({ id: u.id, name: ADMIN_NAMES[email] || email.split("@")[0], email });
      seen.add(u.id);
    }
  }

  // Add any additional users with role=photographer
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "photographer");

  const emailMap: Record<string, string> = {};
  for (const u of allUsers) emailMap[u.id] = u.email ?? "";

  for (const p of profiles ?? []) {
    if (!seen.has(p.id)) {
      result.push({ id: p.id, name: p.full_name || emailMap[p.id] || p.id, email: emailMap[p.id] || "" });
    }
  }

  return NextResponse.json(result);
}
