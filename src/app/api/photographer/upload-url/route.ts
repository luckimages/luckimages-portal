import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";
import { r2SignedPutUrl, R2_MEDIA_BUCKET } from "@/lib/r2";

// Step 1 of the upload flow: the browser asks for a presigned URL, then PUTs
// the file straight to R2 with it (see ShootGallery's confirmUpload). Step 2
// is /api/photographer/upload, which processes the now-uploaded original.
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
  const fileName = body.file_name as string;
  const fileType = (body.file_type as string) || "application/octet-stream";
  const serviceType = (body.service_type as string | null) || "";

  if (!shootId || !fileName) {
    return NextResponse.json({ error: "Missing shoot_id or file_name" }, { status: 400 });
  }

  const { data: shoot } = await service
    .from("shoots")
    .select("photographer_ids")
    .eq("id", shootId)
    .single();

  const isAdmin = ADMIN_EMAILS.includes(user.email || "");
  if (!isAdmin && !shoot?.photographer_ids?.includes(user.id)) {
    return NextResponse.json({ error: "Not your shoot" }, { status: 403 });
  }

  const serviceSlug = serviceType
    ? serviceType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = serviceSlug
    ? `${shootId}/${serviceSlug}/${Date.now()}_${safeName}`
    : `${shootId}/${Date.now()}_${safeName}`;

  const uploadUrl = await r2SignedPutUrl(R2_MEDIA_BUCKET, filePath, fileType, 600);

  return NextResponse.json({ uploadUrl, filePath });
}
