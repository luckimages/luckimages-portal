import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const { path, referrer, sessionId, userAgent } = await req.json();
  if (!path || !sessionId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("page_views")
    .insert({ path, referrer: referrer || null, session_id: sessionId, user_agent: userAgent || null })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
