import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { r2SignedUrl, R2_MEDIA_BUCKET } from "@/lib/r2";

// GET /api/archive/download?id=<file id> → { url } a short-lived presigned
// GET link straight to R2, same as the photographer media viewer.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = createAdminClient();
  const { data: file } = await db.from("archive_files").select("file_key, name").eq("id", id).single();
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await r2SignedUrl(R2_MEDIA_BUCKET, file.file_key, 300);
  return NextResponse.json({ url, name: file.name });
}
