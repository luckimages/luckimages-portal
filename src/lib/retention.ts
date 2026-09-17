import type { SupabaseClient } from "@supabase/supabase-js";
import { assigneeFromSourcedBy, createAutoFollowUp, todayCentral } from "@/lib/followUps";

// Dormant-client nudges (daily cron). A client "goes quiet" relative to their
// own rhythm: someone who books every 2 weeks is quiet after ~3 weeks,
// someone who books every 3 months isn't flagged until ~4.5 months.
//   2+ shoots: flagged once days since last shoot > max(1.5 × their median gap, 30)
//   1 shoot:   flagged at 60 days with no second booking
// Skipped when they have an upcoming shoot, an open follow-up, or are Do Not
// Contact / dead / deleted / staff. One nudge per "last shoot" (auto_key), so
// it never repeats until they book again and go quiet again.

const DAY_MS = 86400000;

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export async function flagDormantClients(db: SupabaseClient): Promise<{ checked: number; flagged: number }> {
  const today = todayCentral();
  const now = Date.now();

  const [{ data: contacts }, { data: shoots }] = await Promise.all([
    db.from("contacts").select("id, name, type, stage, user_id, sourced_by, do_not_contact").not("stage", "in", "(deleted,dead)"),
    db.from("shoots").select("id, contact_id, client_id, scheduled_at, address, status").neq("status", "cancelled").not("scheduled_at", "is", null),
  ]);

  const contactByUser = new Map((contacts || []).filter(c => c.user_id).map(c => [c.user_id as string, c.id as string]));
  const byContact = new Map<string, { id: string; at: number; address: string | null }[]>();
  for (const s of shoots || []) {
    const cid = s.contact_id || (s.client_id ? contactByUser.get(s.client_id) : undefined);
    if (!cid) continue;
    const list = byContact.get(cid) ?? [];
    list.push({ id: s.id, at: new Date(s.scheduled_at as string).getTime(), address: s.address });
    byContact.set(cid, list);
  }

  let checked = 0;
  let flagged = 0;
  for (const c of contacts || []) {
    if (c.do_not_contact || c.type === "employee" || c.type === "admin") continue;
    const list = byContact.get(c.id);
    if (!list?.length) continue;
    if (list.some(s => s.at > now)) continue; // already has something booked

    checked++;
    const past = list.sort((a, b) => a.at - b.at);
    const last = past[past.length - 1];
    const daysSince = Math.floor((now - last.at) / DAY_MS);

    let threshold = 60;
    let rhythm = "";
    if (past.length >= 2) {
      const gaps = past.slice(1).map((s, i) => (s.at - past[i].at) / DAY_MS).filter(g => g >= 1);
      if (gaps.length) {
        const typical = Math.round(median(gaps));
        threshold = Math.max(Math.round(typical * 1.5), 30);
        rhythm = `Usually books about every ${typical} days (${past.length} shoots). `;
      }
    }
    if (daysSince <= threshold) continue;

    const lastDate = new Date(last.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
    const id = await createAutoFollowUp(db, {
      autoKey: `dormant:${c.id}:${last.id}`,
      contactId: c.id,
      dueDate: today,
      title: `Check in with ${c.name} — no shoot in ${daysSince} days`,
      note: `${rhythm}Last shoot: ${last.address || "—"} on ${lastDate}.`,
      assignee: assigneeFromSourcedBy(c.sourced_by),
      createdBy: "retention",
    });
    if (id) flagged++;
  }
  return { checked, flagged };
}
