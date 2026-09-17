import type { SupabaseClient } from "@supabase/supabase-js";
import { adminSender } from "@/lib/constants";
import { addDays, assigneeFromEmail, setFollowUp, todayCentral } from "@/lib/followUps";
import { sendMarketingEmail } from "@/lib/marketingEmail";

// Sequences (see supabase-crm-phase2-3.sql): ordered steps on day offsets from
// enrollment. Email steps send automatically; call and text steps become the
// contact's follow-up for a person to do — texts are never sent automatically
// (automated marketing texts to cell phones need prior written consent under
// the TCPA; a person texting one-to-one from their phone doesn't).

export type SequenceStep = { day: number; kind: "email" | "call" | "text"; subject?: string; body?: string; note?: string };
export type Sequence = { id: string; name: string; description: string | null; active: boolean; steps: SequenceStep[] };
export type Enrollment = {
  id: string; sequence_id: string; contact_id: string; status: string; next_step: number;
  next_run_on: string | null; started_on: string; enrolled_by: string | null; created_at: string;
};

export function normalizeSteps(raw: unknown): SequenceStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s): SequenceStep | null => {
      if (!s || typeof s !== "object") return null;
      const r = s as Record<string, unknown>;
      const kind = r.kind === "email" || r.kind === "call" || r.kind === "text" ? r.kind : null;
      const day = Math.max(0, Math.min(365, Math.round(Number(r.day) || 0)));
      if (!kind) return null;
      if (kind === "email") return { day, kind, subject: String(r.subject || "").slice(0, 200), body: String(r.body || "").slice(0, 10000) };
      return { day, kind, note: String(r.note || "").slice(0, 2000) };
    })
    .filter((s): s is SequenceStep => !!s)
    .sort((a, b) => a.day - b.day);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function fillTokens(text: string, vars: { firstName: string; senderName: string }): string {
  return text.replace(/\{first_name\}/gi, vars.firstName).replace(/\{sender_name\}/gi, vars.senderName);
}

// Plain-text step body → simple, personal-looking HTML (paragraphs, line
// breaks, clickable links). Deliberately not a designed template: sequence
// emails should read like a one-to-one note.
export function renderSequenceEmailHtml(text: string): string {
  const paragraphs = escapeHtml(text).split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 14px;">${p
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563eb;">$1</a>')
      .replace(/\n/g, "<br>")}</p>`
  ).join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;background:#fff;">${paragraphs}</body></html>`;
}

async function stop(db: SupabaseClient, enrollmentId: string, reason: string) {
  await db.from("sequence_enrollments").update({ status: "stopped", stopped_reason: reason, next_run_on: null }).eq("id", enrollmentId);
}

export type RunSummary = { processed: number; emailed: number; tasks: number; stopped: number; completed: number; errors: string[] };

// Runs every step that's due for the given enrollments (or all active ones
// due today or earlier). Called by the daily cron and right after enrolling
// so day-0 steps don't wait for tomorrow.
export async function runDueSequenceSteps(db: SupabaseClient, onlyEnrollmentIds?: string[]): Promise<RunSummary> {
  const today = todayCentral();
  const summary: RunSummary = { processed: 0, emailed: 0, tasks: 0, stopped: 0, completed: 0, errors: [] };

  let q = db.from("sequence_enrollments").select("*").eq("status", "active").lte("next_run_on", today);
  if (onlyEnrollmentIds?.length) q = q.in("id", onlyEnrollmentIds);
  const { data: enrollments, error } = await q.limit(200);
  if (error) { summary.errors.push(error.message); return summary; }
  if (!enrollments?.length) return summary;

  const seqIds = [...new Set(enrollments.map(e => e.sequence_id))];
  const { data: seqRows } = await db.from("sequences").select("id, name, description, active, steps").in("id", seqIds);
  const sequences = new Map((seqRows || []).map(s => [s.id, { ...s, steps: normalizeSteps(s.steps) } as Sequence]));

  for (const e of enrollments as Enrollment[]) {
    summary.processed++;
    const seq = sequences.get(e.sequence_id);
    if (!seq) { await stop(db, e.id, "sequence_deleted"); summary.stopped++; continue; }
    if (!seq.active) continue; // paused — picks back up when turned on again

    const { data: contact } = await db
      .from("contacts")
      .select("id, name, email, stage, user_id, do_not_contact, email_unsubscribed_at")
      .eq("id", e.contact_id)
      .maybeSingle();
    if (!contact) { await stop(db, e.id, "contact_deleted"); summary.stopped++; continue; }
    if (contact.do_not_contact) { await stop(db, e.id, "do_not_contact"); summary.stopped++; continue; }
    if (contact.stage === "dead" || contact.stage === "deleted") { await stop(db, e.id, "marked_dead"); summary.stopped++; continue; }

    // Booked a shoot or replied since enrolling → the sequence did its job.
    const shootFilter = contact.user_id ? `contact_id.eq.${contact.id},client_id.eq.${contact.user_id}` : `contact_id.eq.${contact.id}`;
    const [{ count: booked }, { count: replied }] = await Promise.all([
      db.from("shoots").select("id", { count: "exact", head: true }).or(shootFilter).neq("status", "cancelled").gte("created_at", e.created_at),
      db.from("email_replies").select("id", { count: "exact", head: true }).eq("contact_id", contact.id).gte("received_at", e.created_at),
    ]);
    if ((booked ?? 0) > 0) { await stop(db, e.id, "booked"); summary.stopped++; continue; }
    if ((replied ?? 0) > 0) { await stop(db, e.id, "replied"); summary.stopped++; continue; }

    let nextStep = e.next_step;
    let nextRunOn: string | null = e.next_run_on;
    let status = "active";
    let stoppedReason: string | null = null;
    const firstName = (contact.name || "").split(" ")[0] || "there";
    const senderName = adminSender(e.enrolled_by).fullName;

    while (status === "active") {
      const step = seq.steps[nextStep];
      if (!step) { status = "completed"; nextRunOn = null; summary.completed++; break; }
      const runOn = addDays(e.started_on, step.day);
      if (runOn > today) { nextRunOn = runOn; break; }

      if (step.kind === "email") {
        if (contact.email) {
          const vars = { firstName, senderName };
          const body = fillTokens(step.body || "", vars);
          const result = await sendMarketingEmail(db, {
            senderEmail: e.enrolled_by,
            contactId: contact.id,
            subject: fillTokens(step.subject || seq.name, vars),
            html: renderSequenceEmailHtml(body),
            text: body,
            category: `Sequence: ${seq.name}`,
          });
          if (!result.ok && (result.skipped === "unsubscribed" || result.skipped === "do_not_contact")) {
            status = "stopped"; stoppedReason = result.skipped; nextRunOn = null; summary.stopped++; break;
          }
          if (!result.ok && !result.skipped) {
            // Resend hiccup — leave this step in place and retry tomorrow.
            summary.errors.push(`${contact.name}: ${result.error}`);
            nextRunOn = addDays(today, 1);
            break;
          }
          if (result.ok) summary.emailed++;
        }
      } else {
        await setFollowUp(db, {
          contactId: contact.id,
          dueDate: today,
          title: `${step.kind === "call" ? "Call" : "Text"} ${contact.name} — ${seq.name}`,
          note: step.note ? fillTokens(step.note, { firstName, senderName }) : `Step ${nextStep + 1} of ${seq.steps.length} in "${seq.name}"`,
          assignee: assigneeFromEmail(e.enrolled_by),
          createdBy: "sequence",
        });
        summary.tasks++;
      }
      nextStep++;
    }

    await db.from("sequence_enrollments").update({
      next_step: nextStep,
      next_run_on: nextRunOn,
      status,
      stopped_reason: stoppedReason,
      last_step_at: nextStep !== e.next_step ? new Date().toISOString() : undefined,
    }).eq("id", e.id);
  }

  return summary;
}
