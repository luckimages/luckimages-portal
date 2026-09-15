import { SupabaseClient } from "@supabase/supabase-js";

// Shoots default to a 2-hour calendar block (see googleCalendar.ts) — two
// shoots for the same photographer starting within 2 hours of each other
// can't both be real, so that's the overlap window checked here.
const CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface BookingConflict {
  id: string;
  address: string;
  scheduled_at: string;
}

// Finds another *scheduled* shoot that shares a photographer with the given
// list and starts within 2 hours of the proposed time. Returns null when
// there's no conflict (or nothing to check — no time or no photographers
// assigned yet, which is the normal state for a still-pending request).
export async function findBookingConflict(
  db: SupabaseClient,
  {
    shootId,
    scheduledAt,
    photographerIds,
  }: { shootId?: string | null; scheduledAt: string | null | undefined; photographerIds: string[] | null | undefined }
): Promise<BookingConflict | null> {
  if (!scheduledAt || !photographerIds?.length) return null;

  const center = new Date(scheduledAt).getTime();
  const windowStart = new Date(center - CONFLICT_WINDOW_MS).toISOString();
  const windowEnd = new Date(center + CONFLICT_WINDOW_MS).toISOString();

  let query = db
    .from("shoots")
    .select("id, address, scheduled_at")
    .eq("status", "scheduled")
    .overlaps("photographer_ids", photographerIds)
    .gte("scheduled_at", windowStart)
    .lte("scheduled_at", windowEnd);

  if (shootId) query = query.neq("id", shootId);

  const { data, error } = await query;
  if (error) {
    console.error("findBookingConflict: query failed", error);
    return null; // fail open — don't block a booking over an unrelated query error
  }
  return data?.[0] ?? null;
}
