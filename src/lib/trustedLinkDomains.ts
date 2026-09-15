import { SupabaseClient } from "@supabase/supabase-js";

// Backs the /api/track-link open-redirect fix: a domain is only ever added
// here from an admin-authenticated action (send-email, when Quick Send
// actually goes out) — never from the public track-link redirect itself.
// That's what makes this safe: anyone can hit the public redirect, but only
// an admin action can grow the list of destinations it's allowed to honor.

function normalizeDomain(url: string): string | null {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Scans a block of HTML/text for track-link URLs carrying a `url=` override
// and registers each one's domain as trusted. Called from send-email right
// before/after a Quick Send actually goes out — an admin-only action.
export async function registerLinkDomainsFromContent(db: SupabaseClient, content: string): Promise<void> {
  const domains = new Set<string>();
  const re = /\/api\/track-link\?[^"'\s<>]*[?&]url=([^"'&\s<>]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const raw = decodeURIComponent(m[1]);
    const domain = normalizeDomain(raw);
    if (domain) domains.add(domain);
  }
  if (domains.size === 0) return;

  await db.from("trusted_link_domains").upsert(
    [...domains].map(domain => ({ domain })),
    { onConflict: "domain", ignoreDuplicates: true }
  );
}

// Redirecting back to the site's own pages is never a phishing risk —
// always allowed regardless of the registry (e.g. the Instagram DM
// generator links to /register on this domain, never through send-email).
const OWN_DOMAIN = "luckimages.com";

// Public-facing check used by /api/track-link before honoring a ?url=
// override — read-only, never writes.
export async function isDomainTrusted(db: SupabaseClient, url: string): Promise<boolean> {
  const domain = normalizeDomain(url);
  if (!domain) return false;
  if (domain === OWN_DOMAIN) return true;
  const { data } = await db.from("trusted_link_domains").select("domain").eq("domain", domain).maybeSingle();
  return !!data;
}
