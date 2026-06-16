import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all realtor profiles
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, brokerage, areas, referral_source, created_at")
    .eq("role", "realtor")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get emails from auth.users for each profile
  const ids = (profiles ?? []).map((p) => p.id);
  const emailMap: Record<string, string> = {};

  if (ids.length > 0) {
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users?.users ?? []) {
      if (ids.includes(u.id)) emailMap[u.id] = u.email ?? "";
    }
  }

  const result = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap[p.id] ?? "",
  }));

  return NextResponse.json(result);
}
