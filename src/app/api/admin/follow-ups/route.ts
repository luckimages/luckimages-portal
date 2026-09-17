import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { addDays, assigneeFromEmail, completeFollowUps, setFollowUp, todayCentral, type FollowUpAssignee } from "@/lib/followUps";

// Contact follow-ups (todos with a contact_id — see lib/followUps.ts).
//
// GET ?view=due               open follow-ups due today or overdue, with contact info (Updates box)
// GET ?view=open              { contact_id, due_date, assigned_to } for every open follow-up (Contacts list)
// GET ?contact_id=<id>        { open, history } for one contact (contact page)
// POST { action: "set", contactId, dueDate, note?, assignee? }
// POST { action: "snooze", contactId, days }
// POST { action: "complete", contactId }
//
// GETs answer with empty data plus unavailable: true if the todos.contact_id
// column doesn't exist yet (supabase-crm-phase1.sql not run), so pages degrade
// to "nothing due" instead of erroring.

const FIELDS = "id, title, notes, due_date, assigned_to, contact_id, created_at, created_by, completed_at, completed_by";

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contact_id");
  const view = searchParams.get("view");

  if (contactId) {
    const [{ data: open, error }, { data: history }] = await Promise.all([
      db.from("todos").select(FIELDS).eq("contact_id", contactId).is("completed_at", null).order("created_at", { ascending: true }).limit(1).maybeSingle(),
      db.from("todos").select(FIELDS).eq("contact_id", contactId).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(25),
    ]);
    if (error) return NextResponse.json({ open: null, history: [], unavailable: true });
    return NextResponse.json({ open, history: history || [] });
  }

  if (view === "open") {
    const { data, error } = await db.from("todos").select("contact_id, due_date, assigned_to").not("contact_id", "is", null).is("completed_at", null);
    if (error) return NextResponse.json({ followUps: [], unavailable: true });
    return NextResponse.json({ followUps: data || [], today: todayCentral() });
  }

  if (view === "due") {
    const today = todayCentral();
    const { data: todos, error } = await db
      .from("todos")
      .select(FIELDS)
      .not("contact_id", "is", null)
      .is("completed_at", null)
      .lte("due_date", today)
      .order("due_date", { ascending: true });
    if (error) return NextResponse.json({ followUps: [], today, unavailable: true });

    const ids = [...new Set((todos || []).map(t => t.contact_id as string))];
    const { data: contacts } = ids.length
      ? await db.from("contacts").select("id, name, phone, email, brokerage, stage, do_not_contact").in("id", ids)
      : { data: [] };
    const byId = new Map((contacts || []).map(c => [c.id, c]));
    return NextResponse.json({
      today,
      followUps: (todos || []).map(t => ({ ...t, contact: byId.get(t.contact_id as string) || null })),
    });
  }

  return NextResponse.json({ error: "contact_id or view required" }, { status: 400 });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const body = await req.json();
  const { action, contactId } = body;
  if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });
  const who = (admin.email || "").split("@")[0] || "admin";

  try {
    if (action === "set") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate || "")) return NextResponse.json({ error: "dueDate must be YYYY-MM-DD" }, { status: 400 });
      const assignee: FollowUpAssignee | undefined = ["ryan", "leif", "both"].includes(body.assignee) ? body.assignee : undefined;
      const result = await setFollowUp(db, {
        contactId,
        dueDate: body.dueDate,
        note: body.note,
        assignee: assignee ?? (body.note !== undefined ? assigneeFromEmail(admin.email) : undefined),
        createdBy: who,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "snooze") {
      const days = Number(body.days);
      if (!Number.isInteger(days) || days < 1 || days > 365) return NextResponse.json({ error: "days must be 1–365" }, { status: 400 });
      const result = await setFollowUp(db, { contactId, dueDate: addDays(todayCentral(), days), createdBy: who });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "complete") {
      await completeFollowUps(db, contactId, who);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message || "Follow-up update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
