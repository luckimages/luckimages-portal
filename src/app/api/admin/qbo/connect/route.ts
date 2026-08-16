import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";
import { getAuthUrl } from "@/lib/qbo";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("qbo_oauth_state", state, { httpOnly: true, secure: true, maxAge: 600, path: "/" });

  return NextResponse.redirect(getAuthUrl(state));
}
