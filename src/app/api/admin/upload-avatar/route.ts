import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const contactId = formData.get("contactId") as string | null;

  if (!file || !contactId) {
    return NextResponse.json({ error: "Missing file or contactId" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from("avatars")
    .upload(contactId, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${contactId}`;
  return NextResponse.json({ url });
}
