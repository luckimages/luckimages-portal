import Twilio from "twilio";
import { digitsOnly } from "./format";
import { createAdminClient } from "./supabase-server";

// Central Twilio config check — every route/UI gates on this instead of
// crashing when the subscription/number isn't set up yet.
export function isTwilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

export function isTwilioVoiceConfigured(): boolean {
  return isTwilioConfigured() && !!(process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET && process.env.TWILIO_TWIML_APP_SID);
}

export function getTwilioClient() {
  if (!isTwilioConfigured()) return null;
  return Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

// Contacts store phone as "(###) ###-####" (see lib/format.ts) — Twilio's
// API requires E.164 (+1##########).
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = digitsOnly(phone);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return null;
}

// Matches an inbound Twilio call/text's raw From number back to a contact
// by comparing the last 10 digits — contacts store US numbers formatted,
// Twilio sends E.164, so exact string matching never works.
export async function findContactIdByPhone(rawFrom: string | null): Promise<string | null> {
  if (!rawFrom) return null;
  const digits = digitsOnly(rawFrom).slice(-10);
  if (digits.length !== 10) return null;
  const db = createAdminClient();
  const { data } = await db.from("contacts").select("id, phone").not("phone", "is", null);
  return (data || []).find((c) => digitsOnly(c.phone || "").slice(-10) === digits)?.id || null;
}
