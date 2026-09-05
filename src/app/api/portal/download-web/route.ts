import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { serviceClient, checkShootAccess, checkCanDownload } from "@/lib/shootAccess";

export const maxDuration = 30;

// Streams a web-optimized (long edge capped, compressed) JPEG for one media
// item, generated on demand — this is the "Small — Web & MLS" download
// option. The full-resolution original (the "Large — Print" option) is just
// the existing signed URL to shoot-media; this route exists only because the
// web-sized derivative doesn't exist ahead of time and has to be resized here.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mediaId = searchParams.get("media_id");
  if (!mediaId) return NextResponse.json({ error: "media_id required" }, { status: 400 });

  const db = serviceClient();
  const { data: m } = await db
    .from("media")
    .select("id, shoot_id, file_path, original_path, file_name, file_type")
    .eq("id", mediaId)
    .single();
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!m.file_type?.startsWith("image/")) return NextResponse.json({ error: "Not an image" }, { status: 400 });

  const { allowed, canEdit } = await checkShootAccess(user.id, user.email || "", m.shoot_id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const canDownload = await checkCanDownload(db, canEdit, m.shoot_id);
  if (!canDownload) return NextResponse.json({ error: "Payment required" }, { status: 402 });

  const { data: file, error } = await db.storage.from("shoot-media").download(m.original_path || m.file_path);
  if (error || !file) return NextResponse.json({ error: error?.message || "Could not read file" }, { status: 500 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const sharp = (await import("sharp")).default;
  const webBuffer = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const webName = `${m.file_name.replace(/\.[^.]+$/, "")}-web.jpg`;

  return new NextResponse(new Uint8Array(webBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${webName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
