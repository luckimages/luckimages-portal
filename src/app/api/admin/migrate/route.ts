import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

// Schema is managed directly in Supabase SQL editor.
// exec_sql RPC does not exist in this project so programmatic DDL is not available.
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, message: "No pending migrations." });
}
