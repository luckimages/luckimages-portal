import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contact } = await supabaseUser
    .from("contacts").select("id").eq("user_id", user.id).single();
  if (!contact) return NextResponse.json({ error: "No contact linked to this user" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const compressed = await sharp(Buffer.from(bytes))
    .resize(400, 400, { fit: "cover", position: "center" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseAdmin.storage.from("avatars").upload(contact.id, compressed, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "public, max-age=86400",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${contact.id}`,
  });
}
