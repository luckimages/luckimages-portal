import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";
import sharp from "sharp";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const formData = await req.formData();
  const shootId = formData.get("shoot_id") as string;
  const file = formData.get("file") as File;
  const serviceType = (formData.get("service_type") as string | null) || "";

  if (!shootId || !file) {
    return NextResponse.json({ error: "Missing shoot_id or file" }, { status: 400 });
  }

  // Slugify service name for path segment: "HDR Photography" → "hdr-photography"
  const serviceSlug = serviceType
    ? serviceType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "";

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

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  const filePath = serviceSlug
    ? `${shootId}/${serviceSlug}/${timestamp}_${safeName}`
    : `${shootId}/${timestamp}_${safeName}`;

  // Full-res originals are the whole reason egress blew past quota last cycle —
  // private signed URLs get a fresh token every request, so browsers can never
  // cache them, and the gallery grid/lightbox were loading full originals just
  // to show a small thumbnail. Cache-Control here helps the (rarer) direct
  // download path; the real fix is the separate compressed thumbnail below.
  const { error: storageError } = await service.storage
    .from("shoot-media")
    .upload(filePath, buffer, { contentType: file.type, upsert: false, cacheControl: "31536000" });

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  // Compressed thumbnail in a PUBLIC bucket — a public URL has no rotating
  // signed token, so it's actually cacheable (unlike shoot-media's signed
  // URLs), and it's what the gallery grid/lightbox should load instead of
  // the multi-MB original. Only for images; video/other files have none.
  let thumbPath: string | null = null;
  if (file.type.startsWith("image/")) {
    try {
      const thumbBuffer = await sharp(buffer, { failOn: "none" })
        .rotate() // apply EXIF orientation before resizing
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();

      const candidateThumbPath = `${shootId}/${serviceSlug ? serviceSlug + "/" : ""}${timestamp}_thumb.jpg`;
      const { error: thumbError } = await service.storage
        .from("shoot-thumbnails")
        .upload(candidateThumbPath, thumbBuffer, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
      if (!thumbError) thumbPath = candidateThumbPath;
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
    file_name: file.name,
    file_type: file.type,
  };
  if (thumbPath) insertPayload.thumb_path = thumbPath;

  // thumb_path is a recent addition — if the migration hasn't run yet in this
  // environment, fall back to inserting without it rather than failing the
  // whole upload.
  let { data: media, error: dbError } = await service.from("media").insert(insertPayload).select().single();

  if (dbError && dbError.message?.includes("thumb_path")) {
    delete insertPayload.thumb_path;
    ({ data: media, error: dbError } = await service.from("media").insert(insertPayload).select().single());
  }

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true, media });
}
