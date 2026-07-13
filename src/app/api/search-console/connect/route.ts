import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";
import { getSCOAuthUrl } from "@/lib/google-search-console";

// Kicks off re-authorization when the stored refresh token expires/gets
// revoked (Google returns invalid_grant) — there was previously no route to
// reach Google's consent screen at all, only a callback expecting one.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.redirect(getSCOAuthUrl());
}
