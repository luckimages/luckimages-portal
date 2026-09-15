import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-ads";
import { requireAdmin } from "@/lib/supabase-server";

// After Google redirects back, swap the code for tokens. Logged server-side
// only (Vercel function logs) — same pattern as auth/google/callback and
// search-console/callback — rather than rendered in the response, since a
// refresh token in a browser tab/history is a standing credential leak.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code in query string" }, { status: 400 });
  }

  const tokens = await exchangeCodeForTokens(code);
  console.log("GOOGLE_ADS_REFRESH_TOKEN:", tokens.refresh_token);

  return NextResponse.json({
    message: "Token generated. Check Vercel function logs for the refresh_token value, then add it as GOOGLE_ADS_REFRESH_TOKEN.",
  });
}
