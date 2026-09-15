import { SupabaseClient } from "@supabase/supabase-js";

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Simple fixed-window rate limit backed by Supabase (rate_limit_hits table,
// see supabase-rate-limits.sql) — enough to blunt casual scripted abuse of
// public forms (contact, quote, password reset), not meant to withstand a
// determined distributed attacker. There's a small race between the count
// check and the insert under concurrent hits from the same bucket; that's an
// acceptable trade for not needing a Postgres function/lock for this.
export async function checkRateLimit(
  db: SupabaseClient,
  bucket: string,
  { max, windowSeconds }: { max: number; windowSeconds: number }
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // Opportunistic cleanup so a repeatedly-hit bucket doesn't grow unbounded.
  await db.from("rate_limit_hits").delete().eq("bucket", bucket).lt("created_at", cutoff);

  const { count } = await db
    .from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .gte("created_at", cutoff);

  if ((count ?? 0) >= max) return false;

  await db.from("rate_limit_hits").insert({ bucket });
  return true;
}
