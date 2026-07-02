export function parseDevice(ua: string | null): "Mobile" | "Tablet" | "Desktop" {
  if (!ua) return "Desktop";
  if (/iPad|Tablet(?!.*Mobile)/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "Mobile";
  return "Desktop";
}

export function parseBrowser(ua: string | null): string {
  if (!ua) return "Other";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/CriOS/i.test(ua)) return "Chrome (iOS)";
  if (/FxiOS/i.test(ua)) return "Firefox (iOS)";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return "Safari";
  return "Other";
}
