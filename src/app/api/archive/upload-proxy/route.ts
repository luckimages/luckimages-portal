import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { r2Upload, R2_MEDIA_BUCKET } from "@/lib/r2";

// Fallback upload path: routes the file's bytes through OUR server instead
// of straight to R2. The normal path (browser -> presigned PUT -> R2)
// bypasses Vercel's request-size limit, but it's a direct cross-origin
// connection to r2.cloudflarestorage.com — on a locked-down network
// (corporate firewall, some VPNs/endpoint-protection software) that
// connection can get silently blocked, which shows up in the browser as a
// bare "Failed to fetch" with no useful detail. Proxying through this
// same-origin route sidesteps that, at the cost of a real body-size cap.
export const maxDuration = 60;

const MAX_PROXY_BYTES = 4 * 1024 * 1024; // ~Vercel serverless body limit

function firstName(user: { email?: string | null; user_metadata?: { full_name?: string } }): string {
  const full = user.user_metadata?.full_name;
  if (full) return full.split(" ")[0];
  return (user.email?.split("@")[0] || "Someone").replace(/^./, c => c.toUpperCase());
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (file.size > MAX_PROXY_BYTES) {
    return NextResponse.json({ error: `File is too large for this fallback path (${(file.size / (1024 * 1024)).toFixed(1)}MB, limit ~4MB) — try a smaller file or a different network` }, { status: 413 });
  }

  const folderIdRaw = form.get("folder_id");
  const folder_id = typeof folderIdRaw === "string" && folderIdRaw ? folderIdRaw : null;
  const nameRaw = form.get("name");
  const name = (typeof nameRaw === "string" && nameRaw.trim()) || file.name;

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileKey = `archive/${folder_id || "root"}/${Date.now()}_${safeName}`;
  const contentType = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());

  await r2Upload(R2_MEDIA_BUCKET, fileKey, buffer, contentType);

  const db = createAdminClient();
  const { data, error } = await db.from("archive_files").insert({
    folder_id,
    name,
    file_key: fileKey,
    size_bytes: file.size,
    content_type: contentType,
    uploaded_by: admin.id,
    uploaded_by_name: firstName(admin),
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ file: data });
}
