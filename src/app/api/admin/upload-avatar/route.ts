import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ADMIN_EMAILS } from "@/lib/constants";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const contactId = formData.get("contactId") as string | null;
  if (!file || !contactId) {
    return NextResponse.json({ error: "Missing file or contactId" }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const bytes = await file.arrayBuffer();
  const compressed = await sharp(Buffer.from(bytes))
    .resize(400, 400, { fit: "cover", position: "center" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const { error } = await supabaseAdmin.storage.from("avatars").upload(contactId, compressed, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "public, max-age=86400",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${contactId}`,
  });
}
