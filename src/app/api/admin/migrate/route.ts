import { NextResponse } from "next/server";

// Schema is managed directly in Supabase SQL editor.
// exec_sql RPC does not exist in this project so programmatic DDL is not available.
export async function POST() {
  return NextResponse.json({ ok: true, message: "No pending migrations." });
}
