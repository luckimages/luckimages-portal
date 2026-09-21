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

/**
 * "Last online" style timestamp: minutes/hours ago while recent, an
 * absolute date once it's more than a day old (e.g. "July 10th at 2:04 PM").
 */
export function formatLastOnline(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;

  const d = new Date(iso);
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const year = d.getFullYear() !== new Date().getFullYear() ? `, ${d.getFullYear()}` : "";
  return `${month} ${day}${suffix} at ${time}${year}`;
}

/** Seconds of dwell time as "4m 32s" / "1h 12m" / "8s". */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 1) return "—";
  const totalMin = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (totalMin === 0) return `${secs}s`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins}m ${secs}s`;
  return `${hours}h ${mins}m`;
}
