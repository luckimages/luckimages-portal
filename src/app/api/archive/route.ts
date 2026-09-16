import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { r2SignedPutUrl, r2Delete, R2_MEDIA_BUCKET } from "@/lib/r2";

// The File Archive — a shared "Google Drive" for Ryan and Leif, reachable
// from My Nocturne. Folders + file metadata live in Postgres
// (archive_folders / archive_files); the actual bytes live in R2 under the
// "archive/" prefix. Upload follows the same presigned-PUT pattern as
// photographer media (see /api/photographer/upload-url).
//
// GET    /api/archive?folder_id=<uuid|null>&sort=name|date
// GET    /api/archive?search=<term>              (flat search across all folders)
// POST   /api/archive  { action: "create_folder" | "upload_url" | "record_file", ... }
// DELETE /api/archive?type=file|folder&id=<uuid>

function firstName(user: { email?: string | null; user_metadata?: { full_name?: string } }): string {
  const full = user.user_metadata?.full_name;
  if (full) return full.split(" ")[0];
  return (user.email?.split("@")[0] || "Someone").replace(/^./, c => c.toUpperCase());
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const sort = searchParams.get("sort") === "date" ? "date" : "name";

  if (search) {
    const [{ data: folders }, { data: files }] = await Promise.all([
      db.from("archive_folders").select("*").ilike("name", `%${search}%`),
      db.from("archive_files").select("*").ilike("name", `%${search}%`),
    ]);
    sortRows(folders ?? [], sort);
    sortRows(files ?? [], sort);
    return NextResponse.json({ folder: null, folders: folders ?? [], files: files ?? [], searching: true });
  }

  const folderId = searchParams.get("folder_id") || null;

  const [{ data: folder }, { data: folders }, { data: files }] = await Promise.all([
    folderId ? db.from("archive_folders").select("*").eq("id", folderId).single() : Promise.resolve({ data: null }),
    folderId ? db.from("archive_folders").select("*").eq("parent_id", folderId) : db.from("archive_folders").select("*").is("parent_id", null),
    folderId ? db.from("archive_files").select("*").eq("folder_id", folderId) : db.from("archive_files").select("*").is("folder_id", null),
  ]);

  sortRows(folders ?? [], sort);
  sortRows(files ?? [], sort);

  return NextResponse.json({ folder: folder ?? null, folders: folders ?? [], files: files ?? [], searching: false });
}

function sortRows<T extends { name: string; created_at: string }>(rows: T[], sort: "name" | "date") {
  if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
  else rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const body = await req.json();
  const name = firstName(admin);

  if (body.action === "create_folder") {
    const folderName = (body.name || "").trim();
    if (!folderName) return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    const { data, error } = await db.from("archive_folders").insert({
      name: folderName,
      parent_id: body.parent_id || null,
      created_by: admin.id,
      created_by_name: name,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ folder: data });
  }

  if (body.action === "upload_url") {
    const fileName = (body.name || "").trim();
    const contentType = body.content_type || "application/octet-stream";
    if (!fileName) return NextResponse.json({ error: "File name is required" }, { status: 400 });
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `archive/${body.folder_id || "root"}/${Date.now()}_${safeName}`;
    const uploadUrl = await r2SignedPutUrl(R2_MEDIA_BUCKET, fileKey, contentType, 600);
    return NextResponse.json({ uploadUrl, fileKey });
  }

  if (body.action === "record_file") {
    const fileName = (body.name || "").trim();
    if (!fileName || !body.file_key) return NextResponse.json({ error: "Missing file name or key" }, { status: 400 });
    const { data, error } = await db.from("archive_files").insert({
      folder_id: body.folder_id || null,
      name: fileName,
      file_key: body.file_key,
      size_bytes: body.size_bytes || 0,
      content_type: body.content_type || null,
      uploaded_by: admin.id,
      uploaded_by_name: name,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ file: data });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type");
  if (!id || (type !== "file" && type !== "folder")) return NextResponse.json({ error: "id and type required" }, { status: 400 });

  if (type === "file") {
    const { data: file } = await db.from("archive_files").select("file_key").eq("id", id).single();
    if (file?.file_key) await r2Delete(R2_MEDIA_BUCKET, [file.file_key]);
    const { error } = await db.from("archive_files").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Deleting a folder: gather every descendant folder (BFS) and every file
  // key under any of them, delete the R2 objects, then delete the folder —
  // ON DELETE CASCADE takes care of the child folder/file rows.
  const folderIds = [id];
  for (let i = 0; i < folderIds.length; i++) {
    const { data: children } = await db.from("archive_folders").select("id").eq("parent_id", folderIds[i]);
    for (const c of children ?? []) folderIds.push(c.id);
  }
  const { data: descendantFiles } = await db.from("archive_files").select("file_key").in("folder_id", folderIds);
  const keys = (descendantFiles ?? []).map(f => f.file_key).filter(Boolean);
  if (keys.length) await r2Delete(R2_MEDIA_BUCKET, keys);

  const { error } = await db.from("archive_folders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
