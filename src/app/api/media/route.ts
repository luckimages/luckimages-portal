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
  // thumb_path is a recent addition — degrade gracefully if the migration
  // hasn't run yet in this environment.
  const first = await db
    .from("media")
    .select("id, file_name, file_type, file_path, original_path, thumb_path, created_at")
    .eq("shoot_id", shootId)
    .order("created_at");
  let items: Array<Record<string, any>> | null = first.data; // eslint-disable-line @typescript-eslint/no-explicit-any
  let error = first.error;

  if (error && error.message?.includes("thumb_path")) {
    const second = await db
      .from("media")
      .select("id, file_name, file_type, file_path, original_path, created_at")
      .eq("shoot_id", shootId)
      .order("created_at");
    items = second.data;
    error = second.error;
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
    // download_url stays a signed URL to the private original — access
    // control matters there. preview_url (thumb) is a stable PUBLIC URL when
    // available: no rotating token means it's actually cacheable by the
    // browser, unlike a fresh signed URL on every request.
    const [{ data: download }] = await Promise.all([
      db.storage.from("shoot-media").createSignedUrl(m.original_path || m.file_path, 7200),
    ]);
    let preview_url: string | null = null;
    const thumbPath = (m as { thumb_path?: string | null }).thumb_path;
    if (thumbPath) {
      preview_url = db.storage.from("shoot-thumbnails").getPublicUrl(thumbPath).data.publicUrl;
    } else {
      const { data: signedPreview } = await db.storage.from("shoot-media").createSignedUrl(m.file_path, 7200);
      preview_url = signedPreview?.signedUrl || null;
    }
    const service_type = parseServiceType(m.file_path, shootId);
    return { ...m, service_type, preview_url, download_url: download?.signedUrl || null };
  }));

  return NextResponse.json({ media: withUrls, canEdit });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const db = service();

  let { data: m } = await db
    .from("media")
    .select("id, shoot_id, file_path, original_path, thumb_path")
    .eq("id", id)
    .single();

  if (!m) {
    ({ data: m } = await db.from("media").select("id, shoot_id, file_path, original_path").eq("id", id).single());
  }

  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { allowed, canEdit } = await checkAccess(user.id, user.email || "", m.shoot_id);
  if (!allowed || !canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pathsToDelete = [m.file_path, m.original_path].filter(Boolean) as string[];
  await db.storage.from("shoot-media").remove(pathsToDelete);
  const thumbPath = (m as { thumb_path?: string | null }).thumb_path;
  if (thumbPath) await db.storage.from("shoot-thumbnails").remove([thumbPath]);
  await db.from("media").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
