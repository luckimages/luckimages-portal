import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { serviceClient, checkShootAccess, checkCanDownload } from "@/lib/shootAccess";
import { r2SignedUrl, r2PublicUrl, r2Delete, R2_MEDIA_BUCKET, R2_PUBLIC_BUCKET } from "@/lib/r2";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shootId = searchParams.get("shoot_id");
  if (!shootId) return NextResponse.json({ error: "shoot_id required" }, { status: 400 });

  const { allowed, canEdit } = await checkShootAccess(user.id, user.email || "", shootId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = serviceClient();

  // Admins/photographers always get full access (they need it to review and
  // manage their own uploads). A client/viewer is gated on invoice status —
  // this is the actual enforcement point: the watermarked thumb and a null
  // download_url are what an unpaid browser receives, not just a UI hide.
  const canDownload = await checkCanDownload(db, canEdit, shootId);

  // thumb_path / thumb_watermarked_path are recent additions — degrade
  // gracefully if a migration hasn't run yet in this environment.
  const first = await db
    .from("media")
    .select("id, file_name, file_type, file_path, original_path, thumb_path, thumb_watermarked_path, created_at")
    .eq("shoot_id", shootId)
    .order("created_at");
  let items: Array<Record<string, any>> | null = first.data; // eslint-disable-line @typescript-eslint/no-explicit-any
  let error = first.error;

  if (error && (error.message?.includes("thumb_watermarked_path") || error.message?.includes("thumb_path"))) {
    const second = await db
      .from("media")
      .select("id, file_name, file_type, file_path, original_path, thumb_path, created_at")
      .eq("shoot_id", shootId)
      .order("created_at");
    items = second.data;
    error = second.error;
    if (error && error.message?.includes("thumb_path")) {
      const third = await db
        .from("media")
        .select("id, file_name, file_type, file_path, original_path, created_at")
        .eq("shoot_id", shootId)
        .order("created_at");
      items = third.data;
      error = third.error;
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Parse service_type from path: {shootId}/{service-slug}/{file} or {shootId}/{file}
  function parseServiceType(filePath: string, sid: string): string {
    const prefix = sid + "/";
    const rest = filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
    const parts = rest.split("/");
    // If there's a sub-folder before the filename, that's the service slug
    return parts.length > 1 ? parts[0] : "";
  }

  const withUrls = await Promise.all((items || []).map(async (m) => {
    // download_url is a signed URL to the private original — only issued when
    // canDownload, so an unpaid client's API response never carries a working
    // download link, not just a hidden button. preview_url (thumb) is a
    // stable PUBLIC URL when available: no rotating token means it's actually
    // cacheable by the browser, unlike a fresh signed URL on every request.
    let download_url: string | null = null;
    if (canDownload) {
      download_url = await r2SignedUrl(R2_MEDIA_BUCKET, m.original_path || m.file_path, 7200);
    }

    let preview_url: string | null = null;
    const thumbPath = (m as { thumb_path?: string | null }).thumb_path;
    const thumbWatermarkedPath = (m as { thumb_watermarked_path?: string | null }).thumb_watermarked_path;
    const chosenThumb = canDownload ? (thumbPath || thumbWatermarkedPath) : (thumbWatermarkedPath || thumbPath);
    if (chosenThumb) {
      preview_url = r2PublicUrl(chosenThumb);
    } else if (canDownload) {
      preview_url = await r2SignedUrl(R2_MEDIA_BUCKET, m.file_path, 7200);
    }
    // No watermarked thumb exists (older upload, pre-dates this feature) and
    // the client hasn't paid — fall back to the CSS overlay in ShootGallery
    // rather than leaking the clean original.
    const needsCssWatermark = !canDownload && !thumbWatermarkedPath;

    const service_type = parseServiceType(m.file_path, shootId);
    return { ...m, service_type, preview_url, download_url, needsCssWatermark };
  }));

  return NextResponse.json({ media: withUrls, canEdit, canDownload });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const db = serviceClient();

  let { data: m } = await db
    .from("media")
    .select("id, shoot_id, file_path, original_path, thumb_path, thumb_watermarked_path")
    .eq("id", id)
    .single();

  if (!m) {
    ({ data: m } = await db.from("media").select("id, shoot_id, file_path, original_path").eq("id", id).single());
  }

  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { allowed, canEdit } = await checkShootAccess(user.id, user.email || "", m.shoot_id);
  if (!allowed || !canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pathsToDelete = [m.file_path, m.original_path].filter(Boolean) as string[];
  await r2Delete(R2_MEDIA_BUCKET, [...new Set(pathsToDelete)]);
  const thumbPath = (m as { thumb_path?: string | null }).thumb_path;
  const thumbWatermarkedPath = (m as { thumb_watermarked_path?: string | null }).thumb_watermarked_path;
  const thumbsToDelete = [thumbPath, thumbWatermarkedPath].filter(Boolean) as string[];
  if (thumbsToDelete.length) await r2Delete(R2_PUBLIC_BUCKET, thumbsToDelete);
  await db.from("media").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
