import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("team_id");
  if (!teamId) return NextResponse.json({ name: null });
  const { data } = await db.from("teams").select("name").eq("id", teamId).single();
  return NextResponse.json({ name: data?.name || null });
}
