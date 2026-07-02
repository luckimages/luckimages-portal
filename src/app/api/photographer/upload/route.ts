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

  const { error: storageError } = await service.storage
    .from("shoot-media")
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { data: media, error: dbError } = await service.from("media").insert({
    shoot_id: shootId,
    uploaded_by: user.id,
    file_path: filePath,
    original_path: filePath,
    file_name: file.name,
    file_type: file.type,
  }).select().single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true, media });
}
