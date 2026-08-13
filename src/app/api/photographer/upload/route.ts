import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";

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

  // The browser already uploaded the original straight to Storage (bypassing
  // Vercel's ~4.5MB serverless request-body limit, which silently failed
  // every real estate/drone original over that size when the raw bytes used
  // to be routed through this route). Download it back server-side — this
  // is our own outbound fetch, not an inbound request body, so it isn't
  // subject to that limit — just to generate the compressed thumbnail.
  const { data: downloaded, error: downloadError } = await service.storage
    .from("shoot-media")
    .download(filePath);
  if (downloadError || !downloaded) {
    return NextResponse.json({ error: downloadError?.message || "Could not read uploaded file" }, { status: 500 });
  }
  const buffer = Buffer.from(await downloaded.arrayBuffer());

  // Compressed thumbnail in a PUBLIC bucket — a public URL has no rotating
  // signed token, so it's actually cacheable (unlike shoot-media's signed
  // URLs), and it's what the gallery grid/lightbox should load instead of
  // the multi-MB original. Only for images; video/other files have none.
  let thumbPath: string | null = null;
  if (fileType.startsWith("image/")) {
    try {
      // Dynamic import so a broken sharp/libvips install (a real incident —
      // it crashed every upload in this route when sharp was a static
      // top-level import, since a native-module load failure throws before
      // this try/catch even runs) degrades to "no thumbnail" instead of
      // taking the whole upload down with it.
      const sharp = (await import("sharp")).default;
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
    file_name: fileName,
    file_type: fileType,
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
