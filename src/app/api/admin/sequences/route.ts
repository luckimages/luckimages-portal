import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { addDays, todayCentral } from "@/lib/followUps";
import { normalizeSteps, runDueSequenceSteps } from "@/lib/sequences";

export const maxDuration = 60;

// GET                    all sequences with enrollment counts
// GET ?sequence_id=<id>  that sequence's enrollments (newest 200) with contact names
// GET ?contact_id=<id>   the contact's active (or most recent) enrollment
// POST { action: "save", id?, name, description?, steps, active? }
// POST { action: "delete", id }
// POST { action: "enroll", sequenceId, contactIds?: string[], tag?: string }
// POST { action: "stop", enrollmentId }
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const { searchParams } = new URL(req.url);
  const sequenceId = searchParams.get("sequence_id");
  const contactId = searchParams.get("contact_id");

  if (contactId) {
    const { data, error } = await db
      .from("sequence_enrollments")
      .select("id, sequence_id, status, next_step, next_run_on, started_on, stopped_reason, created_at, sequences(name, steps)")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return NextResponse.json({ enrollments: [], unavailable: true });
    return NextResponse.json({ enrollments: data || [] });
  }

  if (sequenceId) {
    const { data: enrollments, error } = await db
      .from("sequence_enrollments")
      .select("id, contact_id, status, next_step, next_run_on, started_on, stopped_reason, enrolled_by, created_at")
      .eq("sequence_id", sequenceId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const ids = [...new Set((enrollments || []).map(e => e.contact_id))];
    const { data: contacts } = ids.length ? await db.from("contacts").select("id, name, brokerage, email").in("id", ids) : { data: [] };
    const byId = new Map((contacts || []).map(c => [c.id, c]));
    return NextResponse.json({ enrollments: (enrollments || []).map(e => ({ ...e, contact: byId.get(e.contact_id) || null })) });
  }

  const [{ data: sequences, error }, { data: enrollments }] = await Promise.all([
    db.from("sequences").select("*").order("created_at", { ascending: true }),
    db.from("sequence_enrollments").select("sequence_id, status"),
  ]);
  if (error) return NextResponse.json({ sequences: [], unavailable: true });
  const counts = new Map<string, { active: number; completed: number; stopped: number }>();
  for (const e of enrollments || []) {
    const c = counts.get(e.sequence_id) ?? { active: 0, completed: 0, stopped: 0 };
    if (e.status === "active" || e.status === "completed" || e.status === "stopped") c[e.status as "active" | "completed" | "stopped"]++;
    counts.set(e.sequence_id, c);
  }
  return NextResponse.json({
    sequences: (sequences || []).map(s => ({ ...s, steps: normalizeSteps(s.steps), counts: counts.get(s.id) ?? { active: 0, completed: 0, stopped: 0 } })),
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const body = await req.json();

  if (body.action === "save") {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const steps = normalizeSteps(body.steps);
    const bad = steps.find(s => s.kind === "email" && (!s.subject?.trim() || !s.body?.trim()));
    if (bad) return NextResponse.json({ error: `The day ${bad.day} email needs a subject and a message.` }, { status: 400 });
    const row = {
      name,
      description: String(body.description || "").trim() || null,
      steps,
      active: body.active !== false,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = body.id
      ? await db.from("sequences").update(row).eq("id", body.id).select().single()
      : await db.from("sequences").insert({ ...row, created_by: admin.email?.split("@")[0] || null }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sequence: { ...data, steps: normalizeSteps(data.steps) } });
  }

  if (body.action === "delete" && body.id) {
    const { error } = await db.from("sequences").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "stop" && body.enrollmentId) {
    const { error } = await db.from("sequence_enrollments")
      .update({ status: "stopped", stopped_reason: "manual", next_run_on: null })
      .eq("id", body.enrollmentId).eq("status", "active");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "enroll" && body.sequenceId) {
    const { data: seq } = await db.from("sequences").select("id, active, steps").eq("id", body.sequenceId).maybeSingle();
    if (!seq) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    const steps = normalizeSteps(seq.steps);
    if (!seq.active || steps.length === 0) return NextResponse.json({ error: "Turn the sequence on and give it at least one step first." }, { status: 400 });

    let candidateIds: string[] = Array.isArray(body.contactIds) ? body.contactIds.filter((x: unknown) => typeof x === "string") : [];
    if (body.tag) {
      const { data: tagged } = await db.from("contacts").select("id").contains("tags", [String(body.tag)]);
      candidateIds = [...candidateIds, ...(tagged || []).map(c => c.id)];
    }
    candidateIds = [...new Set(candidateIds)];
    if (candidateIds.length === 0) return NextResponse.json({ error: "No contacts to enroll" }, { status: 400 });

    const [{ data: contacts }, { data: busy }] = await Promise.all([
      db.from("contacts").select("id, stage, do_not_contact").in("id", candidateIds),
      db.from("sequence_enrollments").select("contact_id").in("contact_id", candidateIds).eq("status", "active"),
    ]);
    const busyIds = new Set((busy || []).map(b => b.contact_id));
    const eligible = (contacts || []).filter(c => !c.do_not_contact && c.stage !== "dead" && c.stage !== "deleted" && !busyIds.has(c.id));
    const skipped = candidateIds.length - eligible.length;
    if (eligible.length === 0) return NextResponse.json({ enrolled: 0, skipped, note: "Everyone was already in a sequence, Do Not Contact, or dead." });

    const today = todayCentral();
    const { data: inserted, error } = await db.from("sequence_enrollments").insert(eligible.map(c => ({
      sequence_id: seq.id,
      contact_id: c.id,
      status: "active",
      next_step: 0,
      started_on: today,
      next_run_on: addDays(today, steps[0].day),
      enrolled_by: admin.email || null,
    }))).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Day-0 steps go out now for small batches; bigger batches go out with
    // tomorrow morning's run so this request can't time out mid-send.
    const ids = (inserted || []).map(r => r.id);
    const ranNow = steps[0].day === 0 && ids.length <= 15;
    const summary = ranNow ? await runDueSequenceSteps(db, ids) : null;
    return NextResponse.json({ enrolled: ids.length, skipped, ranNow, summary });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
