import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-ads";

// After Google redirects back, swap the code for tokens and show them
// so you can paste the refresh_token into .env.local
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code in query string" }, { status: 400 });
  }

  const tokens = await exchangeCodeForTokens(code);

  return new NextResponse(
    `<html><body style="font-family:monospace;background:#0c0c0c;color:#fff;padding:40px">
      <h2 style="color:#4ade80">✓ Connected to Google Ads</h2>
      <p style="color:#888;margin-bottom:24px">Copy the refresh_token below into your <code>.env.local</code></p>
      <pre style="background:#111;padding:20px;border:1px solid #333;border-radius:4px;overflow-x:auto">${JSON.stringify(tokens, null, 2)}</pre>
      <p style="color:#555;margin-top:24px">Add to .env.local:<br/>
      <code style="color:#fbbf24">GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token ?? "(not returned — ensure prompt=consent was set)"}</code></p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
