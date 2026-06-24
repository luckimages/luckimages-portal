import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Get a Google OAuth2 access token from a service account key
async function getGoogleAccessToken(): Promise<string> {
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");

  const key = JSON.parse(keyRaw);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const b64 = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const unsigned = `${b64(header)}.${b64(claim)}`;

  // Sign with RS256 using the private key via Web Crypto
  const pemBody = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const derBuf = Buffer.from(pemBody, "base64");

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    derBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    Buffer.from(unsigned)
  );

  const sig = Buffer.from(sigBuf).toString("base64url");
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const { access_token, error } = await res.json();
  if (error) throw new Error(`Google OAuth error: ${error}`);
  return access_token;
}

export async function POST(req: Request) {
  // Allow both cron calls (with CRON_SECRET) and admin calls
  const authHeader = req.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    // Manual trigger — still require something
    const { trigger } = await req.json().catch(() => ({}));
    if (trigger !== "manual") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return NextResponse.json({ error: "GOOGLE_SHEET_ID not set" }, { status: 500 });

  // 1. Fetch all shoots
  const db = service();
  const { data: shoots, error } = await db
    .from("shoots")
    .select("id, address, scheduled_at, services, notes, square_footage, client_id, status, photographer_ids, price, package_name")
    .order("scheduled_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Resolve client names
  const clientIds = [...new Set((shoots ?? []).map(s => s.client_id).filter(Boolean))];
  const nameMap: Record<string, string> = {};
  const emailMap: Record<string, string> = {};

  if (clientIds.length > 0) {
    const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", clientIds);
    for (const p of profiles ?? []) nameMap[p.id] = p.full_name ?? "";
    const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users?.users ?? []) {
      if (clientIds.includes(u.id)) emailMap[u.id] = u.email ?? "";
    }
  }

  // 3. Resolve photographer names
  const photographerIds = [...new Set((shoots ?? []).flatMap(s => s.photographer_ids ?? []).filter(Boolean))];
  const photographerNames: Record<string, string> = {};
  if (photographerIds.length > 0) {
    const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", photographerIds);
    for (const p of profiles ?? []) photographerNames[p.id] = p.full_name ?? "";
    const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users?.users ?? []) {
      if (photographerIds.includes(u.id)) photographerNames[u.id] = u.email?.split("@")[0] ?? u.id;
    }
  }

  // 4. Build rows
  const header = ["Date", "Address", "Client", "Client Email", "Services", "Package", "Price", "Sq Ft", "Status", "Photographers", "Notes", "Shoot ID"];
  const rows = (shoots ?? []).map(s => [
    s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
    s.address ?? "",
    nameMap[s.client_id] || emailMap[s.client_id] || "",
    emailMap[s.client_id] || "",
    (s.services ?? []).join(", "),
    s.package_name ?? "",
    s.price != null ? `$${s.price}` : "",
    s.square_footage ?? "",
    s.status ?? "",
    (s.photographer_ids ?? []).map((id: string) => photographerNames[id] || id).join(", "),
    s.notes ?? "",
    s.id,
  ]);

  const values = [header, ...rows];
  const syncedAt = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
  // Add sync timestamp at top
  values.unshift([`Last synced: ${syncedAt} CST`, ...Array(header.length - 1).fill("")]);

  // 5. Write to Google Sheets
  try {
    const token = await getGoogleAccessToken();
    const range = "Master Shoot Log!A1";

    // Clear then write
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:clear`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );

    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.text();
      return NextResponse.json({ error: `Sheets write failed: ${err}` }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: rows.length, syncedAt });
}

// Cron entry point (GET for Vercel cron)
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return POST(req);
}
