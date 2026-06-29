import { createClient } from "@supabase/supabase-js";

/**
 * Post a changelog notification to the command center.
 * headline: shown always
 * details: shown when expanded (bullet points, one per line)
 * category: defaults to "nocturne" (platform updates)
 */
export async function postNotification({
  headline,
  details,
  category = "nocturne",
  createdBy = "ryan",
  link,
}: {
  headline: string;
  details?: string;
  category?: string;
  createdBy?: string;
  link?: string;
}) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const message = details ? `${headline}\n---\n${details}` : headline;

  await db.from("company_updates").insert({
    message,
    created_by: createdBy,
    category,
    ...(link ? { link } : {}),
  });
}
