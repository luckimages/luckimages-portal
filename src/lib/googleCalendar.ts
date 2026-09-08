import { google } from "googleapis";

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    "https://luckimages-portal.vercel.app/api/auth/google/callback"
  );
}

// Geocoders return the street portion in one of two shapes:
//   "123 Main St, City, ST ZIP, Country"   → street number + name in segment 0
//   "123, Main St, Neighborhood, City, ..." → street number split into its own
//                                             segment (Nominatim house numbers)
// The calendar title wants "123 Main St" — the number and street name, but no
// city, neighborhood, county, state, or ZIP.
function streetOnly(address: string): string {
  const segments = address.split(",").map(s => s.trim()).filter(Boolean);
  if (segments.length === 0) return address.trim();
  // Leading bare house number → join it with the next segment (the street name).
  if (/^\d+[a-z]?$/i.test(segments[0]) && segments[1]) {
    return `${segments[0]} ${segments[1]}`;
  }
  return segments[0];
}

export async function createShootEvent({
  address,
  scheduledAt,
  services,
  notes,
  clientEmail,
  clientFullName,
  clientPhone,
  photographerEmails,
}: {
  address: string;
  scheduledAt: string;
  services: string[];
  notes?: string;
  clientEmail?: string;
  clientFullName?: string;
  clientPhone?: string;
  photographerEmails?: string[];
}) {
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN! });

  const calendar = google.calendar({ version: "v3", auth });

  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // default 2hr block

  // Invite Leif, the client, and any assigned photographers.
  const attendees: { email: string; displayName?: string }[] = [
    { email: "leif@luckimages.com", displayName: "Leif" },
  ];
  if (clientEmail) attendees.push({ email: clientEmail, displayName: clientFullName });
  for (const pe of photographerEmails || []) {
    if (pe && !attendees.some(a => a.email === pe)) attendees.push({ email: pe });
  }

  const serviceList = services?.length ? services.join(", ") : "Shoot";
  const description = [
    clientFullName ? `Client: ${clientFullName}` : null,
    clientPhone ? `Phone: ${clientPhone}` : null,
    clientEmail ? `Email: ${clientEmail}` : null,
    services?.length ? `Services: ${serviceList}` : null,
    notes ? `Notes: ${notes}` : null,
    "\nBooked via Luck Images Portal",
  ]
    .filter(Boolean)
    .join("\n");

  const event = await calendar.events.insert({
    calendarId: "ryan@luckimages.com",
    sendUpdates: "all", // email calendar invites to all attendees
    requestBody: {
      summary: `Luck Images - ${streetOnly(address)}`,
      location: address,
      description,
      start: { dateTime: start.toISOString(), timeZone: "America/Chicago" },
      end: { dateTime: end.toISOString(), timeZone: "America/Chicago" },
      attendees,
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "popup", minutes: 60 },       // 1 hr before
        ],
      },
    },
  });

  return event.data;
}

// Remove a shoot's calendar event (e.g. the shoot was cancelled). Emails a
// cancellation notice to every attendee. Safe to call with a stale/unknown
// id — Google returns 404/410 and we swallow it.
export async function deleteShootEvent(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN! });
  const calendar = google.calendar({ version: "v3", auth });
  try {
    await calendar.events.delete({
      calendarId: "ryan@luckimages.com",
      eventId,
      sendUpdates: "all",
    });
    return true;
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code === 404 || code === 410) return false; // already gone
    console.error("deleteShootEvent failed", e);
    return false;
  }
}
