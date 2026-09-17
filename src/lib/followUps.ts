import type { SupabaseClient } from "@supabase/supabase-js";

// Follow-ups are todos linked to a contact (todos.contact_id, see
// supabase-crm-phase1.sql). A contact has at most one open follow-up — setting
// a new date moves the existing one instead of stacking another. They show on
// the contact's page, the Contacts list, Updates → Follow-ups Due, and Todos.

export type FollowUpAssignee = "ryan" | "leif" | "both";

// Today as YYYY-MM-DD in Austin time — the server runs in UTC, which would
// flip to "tomorrow" every evening after 7pm.
export function todayCentral(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function assigneeFromEmail(email: string | null | undefined): FollowUpAssignee {
  const who = (email || "").split("@")[0].toLowerCase();
  return who === "ryan" || who === "leif" ? who : "both";
}

// Same rule as /api/admin/todos: a todo with no list_id never renders on the
// Todos board, so follow-ups land in "General".
async function generalListId(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from("todo_lists").select("id").eq("name", "General").maybeSingle();
  return data?.id ?? null;
}

// Creates the contact's follow-up, or moves their existing open one.
// `title` / `note` / `assignee` only overwrite the existing one when passed.
export async function setFollowUp(
  db: SupabaseClient,
  opts: { contactId: string; dueDate: string; note?: string | null; assignee?: FollowUpAssignee; title?: string; createdBy: string },
): Promise<{ id: string; created: boolean }> {
  const { data: open, error: openError } = await db
    .from("todos")
    .select("id")
    .eq("contact_id", opts.contactId)
    .is("completed_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (openError) throw openError;

  if (open) {
    const patch: Record<string, unknown> = { due_date: opts.dueDate };
    if (opts.title) { patch.title = opts.title; patch.text = opts.title; }
    if (opts.note !== undefined) patch.notes = opts.note?.trim() || null;
    if (opts.assignee) patch.assigned_to = opts.assignee;
    const { error } = await db.from("todos").update(patch).eq("id", open.id);
    if (error) throw error;
    return { id: open.id, created: false };
  }

  let title = opts.title;
  if (!title) {
    const { data: contact } = await db.from("contacts").select("name").eq("id", opts.contactId).maybeSingle();
    title = `Follow up: ${contact?.name || "contact"}`;
  }
  const { data, error } = await db.from("todos").insert({
    text: title,
    title,
    notes: opts.note?.trim() || null,
    list_id: await generalListId(db),
    assigned_to: opts.assignee || "both",
    due_date: opts.dueDate,
    created_by: opts.createdBy,
    is_urgent: false,
    contact_id: opts.contactId,
  }).select("id").single();
  if (error) throw error;
  return { id: data.id, created: true };
}

export async function completeFollowUps(db: SupabaseClient, contactId: string, completedBy: string): Promise<void> {
  const { error } = await db
    .from("todos")
    .update({ completed_at: new Date().toISOString(), completed_by: completedBy })
    .eq("contact_id", contactId)
    .is("completed_at", null);
  if (error) throw error;
}
