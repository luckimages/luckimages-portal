import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all users with role = photographer from profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "photographer");

  if (!profiles?.length) return NextResponse.json([]);

  // Get their emails from auth
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailMap: Record<string, string> = {};
  for (const u of users?.users ?? []) emailMap[u.id] = u.email ?? "";

  const result = profiles.map(p => ({
    id: p.id,
    name: p.full_name || emailMap[p.id] || p.id,
    email: emailMap[p.id] || "",
  }));

  return NextResponse.json(result);
}
