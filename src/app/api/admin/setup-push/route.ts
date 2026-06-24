import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await db.rpc("exec_sql" as never, {
    sql: `
      CREATE TABLE IF NOT EXISTS push_tokens (
        user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        token text NOT NULL,
        platform text,
        updated_at timestamptz DEFAULT now()
      );
      ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Users manage own token" ON push_tokens;
      CREATE POLICY "Users manage own token" ON push_tokens
        FOR ALL USING (auth.uid() = user_id);
      DROP POLICY IF EXISTS "Admins read all tokens" ON push_tokens;
      CREATE POLICY "Admins read all tokens" ON push_tokens
        FOR SELECT USING (auth.jwt() ->> 'email' IN ('ryan@luckimages.com', 'leif@luckimages.com'));
    `
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
