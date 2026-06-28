import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = service();
  const [{ data: lists }, { data: active }, { data: completed }] = await Promise.all([
    db.from("todo_lists").select("*").order("position", { ascending: true }),
    db.from("todos").select("*").is("completed_at", null).order("position", { ascending: true }).order("created_at", { ascending: true }),
    db.from("todos").select("*").not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(50),
  ]);

  return NextResponse.json({ lists: lists || [], active: active || [], completed: completed || [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, id } = body;
  const db = service();
  const name = user.email?.split("@")[0] || "unknown";

  if (action === "create") {
    const { title, text, notes, list_id, assigned_to, due_date, is_urgent } = body;
    const { data, error } = await db.from("todos").insert({
      text: (title || text || "").trim(),
      title: (title || text || "").trim(),
      notes: notes?.trim() || null,
      list_id: list_id || null,
      assigned_to: assigned_to || "both",
      due_date: due_date || null,
      created_by: name,
      is_urgent: !!is_urgent,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ todo: data });
  }

  if (action === "update" && id) {
    const { title, notes, is_urgent, assigned_to, due_date, list_id } = body;
    const patch: Record<string, unknown> = {};
    if (title !== undefined) { patch.title = title?.trim() || null; patch.text = (title || "").trim(); }
    if (notes !== undefined) patch.notes = notes?.trim() || null;
    if (is_urgent !== undefined) patch.is_urgent = is_urgent;
    if (assigned_to !== undefined) patch.assigned_to = assigned_to;
    if (due_date !== undefined) patch.due_date = due_date || null;
    if (list_id !== undefined) patch.list_id = list_id || null;
    const { error } = await db.from("todos").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete" && id) {
    const { error } = await db.from("todos").update({ completed_at: new Date().toISOString(), completed_by: name }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "uncomplete" && id) {
    const { error } = await db.from("todos").update({ completed_at: null, completed_by: null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete" && id) {
    const { error } = await db.from("todos").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // List actions
  if (action === "create_list") {
    const { name: listName, position } = body;
    const { data, error } = await db.from("todo_lists").insert({ name: listName?.trim() || "New List", position: position ?? 99 }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ list: data });
  }

  if (action === "rename_list" && id) {
    const { name: listName } = body;
    const { error } = await db.from("todo_lists").update({ name: listName?.trim() }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_list" && id) {
    const { error } = await db.from("todo_lists").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
