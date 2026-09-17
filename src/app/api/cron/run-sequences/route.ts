import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { runDueSequenceSteps } from "@/lib/sequences";

export const maxDuration = 60;

// Daily (vercel.json, ~9–10am Austin): sends due sequence emails and turns
// due call/text steps into follow-ups.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runDueSequenceSteps(createAdminClient());
  if (summary.errors.length) console.error("run-sequences errors", summary.errors);
  return NextResponse.json(summary);
}
