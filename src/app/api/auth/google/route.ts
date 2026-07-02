import { NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAdmin } from "@/lib/supabase-server";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    "https://luckimages-portal.vercel.app/api/auth/google/callback"
  );

  const url = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/gmail.compose",
    ],
  });

  return NextResponse.redirect(url);
}
