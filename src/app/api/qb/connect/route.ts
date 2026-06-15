import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.QB_CLIENT_ID!;
  const redirectUri = "https://luckimages-portal.vercel.app/api/qb/callback";
  const scope = "com.intuit.quickbooks.accounting";
  const state = Math.random().toString(36).substring(7);

  const url = new URL("https://appcenter.intuit.com/connect/oauth2");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
