import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";
import { r2Download, r2Upload, R2_MEDIA_BUCKET, R2_PUBLIC_BUCKET } from "@/lib/r2";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await req.json();
  const shootId = body.shoot_id as string;
  const filePath = body.file_path as string;
  const fileName = body.file_name as string;
  const fileType = (body.file_type as string) || "application/octet-stream";
  const serviceType = (body.service_type as string | null) || "";

  if (!shootId || !filePath || !fileName) {
    return NextResponse.json({ error: "Missing shoot_id, file_path, or file_name" }, { status: 400 });
  }

  const serviceSlug = serviceType
    ? serviceType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "";
  const timestamp = Date.now();

  // Verify access
  const { data: shoot } = await service
    .from("shoots")
    .select("photographer_ids")
    .eq("id", shootId)
    .single();

  const isAdmin = ADMIN_EMAILS.includes(user.email || "");
  if (!isAdmin && !shoot?.photographer_ids?.includes(user.id)) {
    return NextResponse.json({ error: "Not your shoot" }, { status: 403 });
  }

  // The browser already uploaded the original straight to R2 via a presigned
  // URL (bypassing Vercel's ~4.5MB serverless request-body limit, which
  // silently failed every real estate/drone original over that size when the
  // raw bytes used to be routed through this route). Download it back
  // server-side — this is our own outbound fetch, not an inbound request
  // body, so it isn't subject to that limit — just to generate the thumbnail.
  let buffer: Buffer;
  try {
    buffer = await r2Download(R2_MEDIA_BUCKET, filePath);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not read uploaded file" }, { status: 500 });
  }

  // Compressed thumbnail in a PUBLIC bucket — a public URL has no rotating
  // signed token, so it's actually cacheable (unlike the private bucket's signed
  // URLs), and it's what the gallery grid/lightbox should load instead of
  // the multi-MB original. Only for images; video/other files have none.
  // A second, watermarked copy of that same thumbnail is what unpaid clients
  // actually see — /api/media decides which of the two to hand back based on
  // invoice status, so the clean version never reaches an unpaid browser.
  let thumbPath: string | null = null;
  let thumbWatermarkedPath: string | null = null;
  if (fileType.startsWith("image/")) {
    try {
      // Dynamic import so a broken sharp/libvips install (a real incident —
      // it crashed every upload in this route when sharp was a static
      // top-level import, since a native-module load failure throws before
      // this try/catch even runs) degrades to "no thumbnail" instead of
      // taking the whole upload down with it.
      const sharp = (await import("sharp")).default;
      const { applyWatermark } = await import("@/lib/watermark");
      const thumbBuffer = await sharp(buffer, { failOn: "none" })
        .rotate() // apply EXIF orientation before resizing
        .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();

      const candidateThumbPath = `${shootId}/${serviceSlug ? serviceSlug + "/" : ""}${timestamp}_thumb.jpg`;
      try {
        await r2Upload(R2_PUBLIC_BUCKET, candidateThumbPath, thumbBuffer, "image/jpeg");
        thumbPath = candidateThumbPath;
      } catch {
        // Thumbnail is a bandwidth optimization — fall back to the original
        // everywhere thumb_path is missing rather than failing the upload.
      }

      try {
        const watermarkedBuffer = await applyWatermark(thumbBuffer);
        const candidateWmPath = `${shootId}/${serviceSlug ? serviceSlug + "/" : ""}${timestamp}_thumb_wm.jpg`;
        await r2Upload(R2_PUBLIC_BUCKET, candidateWmPath, watermarkedBuffer, "image/jpeg");
        thumbWatermarkedPath = candidateWmPath;
      } catch {
        // Watermarked preview is what gates pre-payment viewing — if it fails
        // to generate, fall back to the clean thumb everywhere in /api/media
        // rather than failing the upload outright.
      }
    } catch {
      // Thumbnail generation is a bandwidth optimization, not a requirement —
      // if a file sharp can't parse (odd RAW variant, etc.) just skip it and
      // fall back to the original everywhere thumb_path is missing.
    }
  }

  const insertPayload: Record<string, unknown> = {
    shoot_id: shootId,
    uploaded_by: user.id,
    file_path: filePath,
    original_path: filePath,
    file_name: fileName,
    file_type: fileType,
  };
  if (thumbPath) insertPayload.thumb_path = thumbPath;
  if (thumbWatermarkedPath) insertPayload.thumb_watermarked_path = thumbWatermarkedPath;

  // thumb_path / thumb_watermarked_path are recent additions — if a migration
  // hasn't run yet in this environment, drop whichever column is missing and
  // retry rather than failing the whole upload.
  let { data: media, error: dbError } = await service.from("media").insert(insertPayload).select().single();

  while (dbError && (dbError.message?.includes("thumb_path") || dbError.message?.includes("thumb_watermarked_path"))) {
    if (dbError.message?.includes("thumb_watermarked_path")) delete insertPayload.thumb_watermarked_path;
    else if (dbError.message?.includes("thumb_path")) delete insertPayload.thumb_path;
    else break;
    ({ data: media, error: dbError } = await service.from("media").insert(insertPayload).select().single());
  }

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true, media });
}
