import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { r2Upload, r2PublicUrl, R2_PUBLIC_BUCKET } from "@/lib/r2";
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

  const key = `avatars/${contact.id}`;
  try {
    await r2Upload(R2_PUBLIC_BUCKET, key, compressed, "image/jpeg");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ url: r2PublicUrl(key) });
}
