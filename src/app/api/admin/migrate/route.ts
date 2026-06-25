import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// One-shot migration endpoint — safe to call multiple times (uses IF NOT EXISTS)
export async function POST() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const migrations = [
    `ALTER TABLE shoots ADD COLUMN IF NOT EXISTS media_link text`,
    `ALTER TABLE shoots ADD COLUMN IF NOT EXISTS price numeric`,
    `ALTER TABLE shoots ADD COLUMN IF NOT EXISTS package_name text`,
    `CREATE TABLE IF NOT EXISTS contact_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id_a uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      contact_id_b uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      relationship text NOT NULL DEFAULT 'Related',
      created_at timestamptz DEFAULT now(),
      UNIQUE(contact_id_a, contact_id_b)
    )`,
    `CREATE TABLE IF NOT EXISTS push_tokens (
      user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      token text NOT NULL,
      platform text,
      updated_at timestamptz DEFAULT now()
    )`,
  ];

  const errors: string[] = [];
  for (const sql of migrations) {
    const { error } = await db.from("_migrations_placeholder" as never).select().limit(0).throwOnError().then(() => ({ error: null })).catch(async () => {
      // Use raw REST workaround via storage API headers trick
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY!,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql }),
      });
      if (!res.ok) return { error: await res.text() };
      return { error: null };
    });
    if (error) errors.push(`${sql.slice(0, 40)}: ${error}`);
  }

  return NextResponse.json({ ok: errors.length === 0, errors });
}
