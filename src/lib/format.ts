/** Strip non-digits from a phone string */
export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Format a phone number as (###) ###-####.
 * Accepts any input (raw digits, existing formatting, etc.).
 * Returns the original string if it doesn't contain exactly 10 US digits.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = digitsOnly(phone);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  // Can't format — return as-is
  return phone;
}

/**
 * Normalize a phone number before storing: strips formatting,
 * then stores as (###) ###-####. Returns null if blank or unrecognized.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const formatted = formatPhone(phone);
  return formatted || phone.trim();
}
