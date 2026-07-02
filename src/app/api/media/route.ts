import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function checkAccess(userId: string, userEmail: string, shootId: string) {
  if (ADMIN_EMAILS.includes(userEmail)) return { allowed: true, canEdit: true };

  const db = service();
  const { data: shoot } = await db
    .from("shoots")
    .select("photographer_ids, client_id, contact_id")
    .eq("id", shootId)
    .single();

  if (!shoot) return { allowed: false, canEdit: false };

  if (shoot.photographer_ids?.includes(userId)) return { allowed: true, canEdit: true };

  if (shoot.client_id === userId) return { allowed: true, canEdit: false };

  if (shoot.contact_id) {
    const { data: contact } = await db.from("contacts").select("user_id").eq("id", shoot.contact_id).single();
    if (contact?.user_id === userId) return { allowed: true, canEdit: false };
  }

  return { allowed: false, canEdit: false };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shootId = searchParams.get("shoot_id");
  if (!shootId) return NextResponse.json({ error: "shoot_id required" }, { status: 400 });

  const { allowed, canEdit } = await checkAccess(user.id, user.email || "", shootId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = service();
  const { data: items, error } = await db
    .from("media")
    .select("id, file_name, file_type, file_path, original_path, created_at")
    .eq("shoot_id", shootId)
    .order("created_at");

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
    const [{ data: preview }, { data: download }] = await Promise.all([
      db.storage.from("shoot-media").createSignedUrl(m.file_path, 7200),
      db.storage.from("shoot-media").createSignedUrl(m.original_path || m.file_path, 7200),
    ]);
    const service_type = parseServiceType(m.file_path, shootId);
    return { ...m, service_type, preview_url: preview?.signedUrl || null, download_url: download?.signedUrl || null };
  }));

  return NextResponse.json({ media: withUrls, canEdit });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const db = service();

  const { data: m } = await db
    .from("media")
    .select("id, shoot_id, file_path, original_path")
    .eq("id", id)
    .single();

  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { allowed, canEdit } = await checkAccess(user.id, user.email || "", m.shoot_id);
  if (!allowed || !canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pathsToDelete = [m.file_path, m.original_path].filter(Boolean) as string[];
  await db.storage.from("shoot-media").remove(pathsToDelete);
  await db.from("media").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
