import crypto from "crypto";

// Email reply logging through Resend Inbound. Off until BOTH env vars are set:
//   REPLY_CAPTURE_DOMAIN   the receiving domain set up in Resend (e.g.
//                          reply.luckimages.com, or the account's
//                          <id>.resend.app address domain)
//   RESEND_WEBHOOK_SECRET  signing secret of the email.received webhook that
//                          points at /api/webhooks/resend-inbound
// While on, outreach emails set Reply-To to
// <ryan|leif>+<contact id>@REPLY_CAPTURE_DOMAIN. Replies hit the webhook, get
// logged on the contact and forwarded to that admin's inbox with Reply-To
// set back to the realtor.

const ADMIN_BY_LOCAL: Record<string, string> = { ryan: "ryan@luckimages.com", leif: "leif@luckimages.com" };

function domain(): string {
  return (process.env.REPLY_CAPTURE_DOMAIN || "").trim().toLowerCase();
}

export function replyCaptureEnabled(): boolean {
  return !!domain() && !!process.env.RESEND_WEBHOOK_SECRET;
}

export function replyToAddress(senderEmail: string | null | undefined, contactId: string | null | undefined): string | null {
  if (!replyCaptureEnabled() || !contactId) return null;
  const local = (senderEmail || "").split("@")[0].toLowerCase();
  const who = ADMIN_BY_LOCAL[local] ? local : "ryan";
  return `${who}+${contactId.replace(/-/g, "").toLowerCase()}@${domain()}`;
}

export function parseReplyAddress(address: string): { adminEmail: string; contactId: string } | null {
  const m = address.trim().toLowerCase().match(/<?([a-z]+)\+([0-9a-f]{32})@([^>\s]+)>?$/);
  if (!m || m[3] !== domain()) return null;
  const h = m[2];
  return {
    adminEmail: ADMIN_BY_LOCAL[m[1]] || ADMIN_BY_LOCAL.ryan,
    contactId: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`,
  };
}

// Resend signs webhooks the Svix way: HMAC-SHA256 over
// "<svix-id>.<svix-timestamp>.<raw body>" with the base64 secret after
// "whsec_", sent as space-separated "v1,<base64 sig>" entries. Rejects
// anything older than 5 minutes (replays).
export function verifyResendWebhook(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = Buffer.from(crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64"));
  return signatures.split(" ").some(entry => {
    const [version, sig] = entry.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}
