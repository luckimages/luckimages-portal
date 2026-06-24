import { createClient } from "@supabase/supabase-js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: row } = await db
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId)
    .single();

  if (!row?.token) return;

  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ to: row.token, title, body, data: data || {}, sound: "default", priority: "high" }),
  });
}

export async function sendPushToAdmins(title: string, body: string, data?: Record<string, string>) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { users } } = await db.auth.admin.listUsers();
  const admins = (users || []).filter(u =>
    ["ryan@luckimages.com", "leif@luckimages.com"].includes(u.email || "")
  );

  await Promise.all(admins.map(u => sendPushToUser(u.id, title, body, data)));
}
