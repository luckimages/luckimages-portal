import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";
import { exchangeSCCodeForTokens } from "@/lib/google-search-console";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code in query string" }, { status: 400 });

  const tokens = await exchangeSCCodeForTokens(code);

  // Refresh tokens shouldn't sit in a browser tab or history — log server-side
  // (check Vercel function logs) and update GOOGLE_SC_REFRESH_TOKEN there,
  // same pattern as the Gmail/Calendar reconnect flow.
  console.log("GOOGLE_SC_REFRESH_TOKEN:", tokens.refresh_token ?? "(not returned — ensure prompt=consent was set)");

  return new NextResponse(
    `<html><body style="font-family:monospace;background:#0c0c0c;color:#fff;padding:40px">
      <h2 style="color:#4ade80">✓ Connected to Google Search Console</h2>
      <p style="color:#888;">Token generated — check Vercel's function logs for this request to get the new GOOGLE_SC_REFRESH_TOKEN value, then update it in the project's environment variables.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
