import { google } from "googleapis";

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    "https://luckimages-portal.vercel.app/api/auth/google/callback"
  );
}

export async function createShootEvent({
  address,
  scheduledAt,
  services,
  notes,
  clientEmail,
  clientName,
}: {
  address: string;
  scheduledAt: string;
  services: string[];
  notes?: string;
  clientEmail?: string;
  clientName?: string;
}) {
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN! });

  const calendar = google.calendar({ version: "v3", auth });

  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // default 2hr block

  // Internal only — no client invites until portal goes live
  const attendees: { email: string; displayName?: string }[] = [
    { email: "leif@luckimages.com", displayName: "Leif" },
  ];

  const serviceList = services?.length ? services.join(", ") : "Shoot";
  const description = [
    clientName ? `Client: ${clientName}` : null,
    clientEmail ? `Email: ${clientEmail}` : null,
    services?.length ? `Services: ${serviceList}` : null,
    notes ? `Notes: ${notes}` : null,
    "\nBooked via Luck Images Portal",
  ]
    .filter(Boolean)
    .join("\n");

  const event = await calendar.events.insert({
    calendarId: "ryan@luckimages.com",
    sendUpdates: "none", // no email invites until portal goes live
    requestBody: {
      summary: `📸 ${serviceList} — ${address}`,
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
