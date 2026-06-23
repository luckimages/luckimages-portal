import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { applyWatermark } from "@/lib/watermark";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Auth check
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

  if (!shootId || !file) {
    return NextResponse.json({ error: "Missing shoot_id or file" }, { status: 400 });
  }

  // Verify photographer is assigned to this shoot
  const { data: shoot } = await service
    .from("shoots")
    .select("photographer_ids")
    .eq("id", shootId)
    .single();

  if (!shoot?.photographer_ids?.includes(user.id)) {
    return NextResponse.json({ error: "Not your shoot" }, { status: 403 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const originalBuffer = Buffer.from(arrayBuffer);
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Upload original (private — served only after payment)
  const originalPath = `${shootId}/original/${timestamp}_${safeName}`;
  await service.storage.from("shoot-media").upload(originalPath, originalBuffer, {
    contentType: file.type,
    upsert: false,
  });

  // Apply watermark and upload watermarked version
  let watermarkedBuffer: Buffer;
  try {
    watermarkedBuffer = await applyWatermark(originalBuffer);
  } catch {
    // If watermark fails (e.g. non-image file), fall back to original
    watermarkedBuffer = originalBuffer;
  }

  const watermarkedPath = `${shootId}/watermarked/${timestamp}_${safeName}`;
  await service.storage.from("shoot-media").upload(watermarkedPath, watermarkedBuffer, {
    contentType: "image/jpeg",
    upsert: false,
  });

  // Insert media record pointing to watermarked path; store original path too
  const { data: media, error: dbError } = await service.from("media").insert({
    shoot_id: shootId,
    uploaded_by: user.id,
    file_path: watermarkedPath,
    original_path: originalPath,
    file_name: file.name,
    file_type: file.type,
  }).select().single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true, media });
}
