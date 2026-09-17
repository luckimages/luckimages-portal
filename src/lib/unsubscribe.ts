import type { SupabaseClient } from "@supabase/supabase-js";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

// CAN-SPAM requires a valid physical postal address (street address or PO
// box) in every marketing email. Replace this with the real one.
export const MAILING_ADDRESS = "Luck Images · Austin, TX";

export type EmailBlockReason = "unsubscribed" | "do_not_contact";

// With a token the page unsubscribes that exact contact in one click; without
// one (group sends, or recipients who aren't contacts) it asks for an email.
export function unsubscribePageUrl(token?: string | null): string {
  return token ? `${SITE_URL}/unsubscribe?t=${token}` : `${SITE_URL}/unsubscribe`;
}

// RFC 8058 one-click unsubscribe — Gmail/Yahoo show their own "Unsubscribe"
// button for these and POST straight to it (no page visit).
export function listUnsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${SITE_URL}/api/unsubscribe?t=${token}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function addUnsubscribeFooterHtml(html: string, url: string): string {
  const footer = `<div style="text-align:center;padding:28px 16px 12px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#888;">${MAILING_ADDRESS}<br>Don't want emails like this? <a href="${url}" style="color:#888;text-decoration:underline;">Unsubscribe</a></div>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footer}</body>`) : `${html}${footer}`;
}

export function addUnsubscribeFooterText(text: string, url: string): string {
  return `${text}\n\n—\n${MAILING_ADDRESS}\nUnsubscribe: ${url}`;
}

type FlagRow = { id: string; email: string | null; do_not_contact: boolean | null; email_unsubscribed_at: string | null; unsubscribe_token: string | null };

function reasonFor(row: FlagRow): EmailBlockReason | null {
  if (row.do_not_contact) return "do_not_contact";
  if (row.email_unsubscribed_at) return "unsubscribed";
  return null;
}

// Whether a marketing email to this recipient should be skipped, plus their
// unsubscribe token. Fails open (not blocked, no token) if the lookup errors —
// e.g. before supabase-crm-phase1.sql has been run — so outreach keeps working.
export async function marketingEmailStatus(
  db: SupabaseClient,
  recipient: { contactId?: string | null; email?: string | null },
): Promise<{ blocked: EmailBlockReason | null; token: string | null }> {
  const cols = "id, email, do_not_contact, email_unsubscribed_at, unsubscribe_token";
  if (recipient.contactId) {
    const { data, error } = await db.from("contacts").select(cols).eq("id", recipient.contactId).maybeSingle();
    if (error) { console.error("marketingEmailStatus lookup failed", error); return { blocked: null, token: null }; }
    if (data) return { blocked: reasonFor(data as FlagRow), token: (data as FlagRow).unsubscribe_token };
  }
  const email = recipient.email?.trim();
  if (!email) return { blocked: null, token: null };
  const { data, error } = await db.from("contacts").select(cols).ilike("email", email.replace(/[\\%_]/g, c => `\\${c}`));
  if (error) { console.error("marketingEmailStatus lookup failed", error); return { blocked: null, token: null }; }
  const rows = (data || []) as FlagRow[];
  const blocked = rows.map(reasonFor).find(Boolean) ?? null;
  return { blocked, token: rows.length === 1 ? rows[0].unsubscribe_token : null };
}

// Of these contact ids, which must not get marketing email.
export async function blockedContactIds(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await db
    .from("contacts")
    .select("id, email, do_not_contact, email_unsubscribed_at, unsubscribe_token")
    .in("id", ids);
  if (error) { console.error("blockedContactIds lookup failed", error); return new Set(); }
  return new Set(((data || []) as FlagRow[]).filter(r => reasonFor(r)).map(r => r.id));
}
