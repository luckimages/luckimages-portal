import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { email, name } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Generate a magic link (signup or login) for the client
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://luckimages-portal.vercel.app"}/client`,
      data: { full_name: name || "" },
    },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ link: data.properties?.action_link });
}
