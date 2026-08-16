import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";
import { exchangeCode, saveInitialTokens } from "@/lib/qbo";
import { cookies } from "next/headers";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.redirect(`${SITE}/dashboard/revenue?qbo=error`);

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("qbo_oauth_state")?.value;
  cookieStore.delete("qbo_oauth_state");

  if (!code || !realmId || !state || state !== savedState) {
    return NextResponse.redirect(`${SITE}/dashboard/revenue?qbo=error`);
  }

  const tokens = await exchangeCode(code, realmId);
  if (!tokens) return NextResponse.redirect(`${SITE}/dashboard/revenue?qbo=error`);

  await saveInitialTokens(tokens);

  return NextResponse.redirect(`${SITE}/dashboard/revenue?qbo=connected`);
}
