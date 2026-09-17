import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { flagDormantClients } from "@/lib/retention";

export const maxDuration = 60;

// Daily (vercel.json, early morning Austin): "check in" follow-ups for clients
// who've gone quiet relative to their usual booking rhythm (lib/retention.ts).
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await flagDormantClients(createAdminClient()));
  } catch (e) {
    console.error("client-retention failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
