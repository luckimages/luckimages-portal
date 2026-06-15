import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");

  if (!code || !realmId) {
    return NextResponse.json({ error: "Missing code or realmId" }, { status: 400 });
  }

  const clientId = process.env.QB_CLIENT_ID!;
  const clientSecret = process.env.QB_CLIENT_SECRET!;
  const redirectUri = "https://luckimages-portal.vercel.app/api/qb/callback";

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const responseText = await tokenRes.text();

  let tokens: { refresh_token?: string; access_token?: string; expires_in?: number; [key: string]: unknown };
  try { tokens = JSON.parse(responseText); } catch { tokens = { raw: responseText }; }

  if (!tokens.refresh_token) {
    return NextResponse.json({
      error: "Token exchange failed",
      httpStatus: tokenRes.status,
      details: tokens,
    }, { status: 500 });
  }

  // Store tokens in Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from("qb_tokens").upsert({
    id: 1,
    realm_id: realmId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });

  return NextResponse.redirect("https://luckimages-portal.vercel.app/dashboard?qb=connected");
}
