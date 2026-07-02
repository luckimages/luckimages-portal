import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    "https://luckimages-portal.vercel.app/api/auth/google/callback"
  );

  const { tokens } = await auth.getToken(code);

  // Log server-side only (Vercel function logs) rather than rendering in the
  // response — refresh tokens shouldn't sit in a browser tab or history.
  console.log("GOOGLE_REFRESH_TOKEN:", tokens.refresh_token);

  return NextResponse.json({
    message: "Token generated. Check Vercel function logs for the refresh_token value, then add it as GOOGLE_REFRESH_TOKEN.",
  });
}
