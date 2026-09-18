// Shared by Mass Invite (admin/invite-all) and the single-contact "Send
// Portal Invite" button (admin/contacts/[id] -> api/admin/invite-contact) so
// both paths send the exact same email — just triggered from different
// places.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

export type PortalInviteContact = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
};

export function buildPortalInviteEmail(contact: PortalInviteContact) {
  const firstName = contact.name.split(" ")[0];

  // Pre-filled register URL — contact_id ensures linking even if they tweak
  // their email; name/email/phone pre-fill the form fields.
  const params = new URLSearchParams({ contact_id: contact.id, name: contact.name, email: contact.email });
  if (contact.phone) params.set("phone", contact.phone);
  const registerUrl = `${SITE_URL}/register?${params.toString()}`;

  // Route through track-link so the click gets recorded — service
  // "portal_invite" keeps these queryable separately from other custom-URL
  // track-link uses (e.g. the Instagram DM generator's service="instagram-dm"
  // links). The redirect appends ?lc=<id>, which PageTracker reports dwell
  // time against once they land.
  const trackedUrl = `${SITE_URL}/api/track-link?url=${encodeURIComponent(registerUrl)}&contact=${contact.id}&service=portal_invite`;

  const subject = `${firstName}, your Luck Images client portal is ready`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" background="${SITE_URL}/hero-1.jpg" style="background-color:#0c0c0c;background-image:linear-gradient(rgba(12,12,12,0.72),rgba(12,12,12,0.72)),url('${SITE_URL}/hero-1.jpg');background-size:cover;background-position:center;">
    <tr><td align="center" style="padding:48px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="border:1px solid rgba(255,255,255,0.15);padding:40px;background:rgba(12,12,12,0.55);">
          <h1 style="margin:0 0 20px;font-size:22px;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase;color:#fff;">
            Luck Images<br />New Realtor Portal
          </h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#888;">
            You're invited, ${firstName}.
          </p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#888;">
            Luck Images is proud to announce the launch of our new Realtor Portal — a hub where you can book shoots, download delivered media, and track invoices all in one place.
          </p>
          <p style="margin:0 0 32px;font-size:14px;line-height:1.6;color:#888;">
            As a past client your info is already in the portal — just click below to set a password and you're in!
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${trackedUrl}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:14px 32px;">
              Create Your Account →
            </a>
          </td></tr></table>
          <p style="margin:28px 0 0;font-size:11px;color:#555;line-height:1.6;">
            Questions? Just reply to this email — I'm happy to help.
          </p>
        </td></tr>
        <tr><td style="padding-top:24px;">
          <p style="margin:0;font-size:11px;color:#fff;letter-spacing:1px;text-shadow:0 1px 3px rgba(0,0,0,0.8);">Ryan Luck &amp; Leif Tilton — Luck Images · Austin, TX · <a href="mailto:ryan@luckimages.com" x-apple-data-detectors="false" style="color:#fff;text-decoration:none;">ryan@luckimages.com</a> · <a href="mailto:leif@luckimages.com" x-apple-data-detectors="false" style="color:#fff;text-decoration:none;">leif@luckimages.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, registerUrl, trackedUrl };
}
