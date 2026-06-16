import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    "https://luckimages-portal.vercel.app/api/auth/google/callback"
  );

  const { tokens } = await auth.getToken(code);

  // Show the refresh token so it can be saved as a Vercel env var
  return NextResponse.json({
    message: "Copy the refresh_token below and add it to Vercel as GOOGLE_REFRESH_TOKEN",
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
  });
}
