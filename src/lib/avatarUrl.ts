// Client-safe (no server credentials) — avatars live in R2's public bucket
// under an avatars/ prefix. Centralized so the URL shape only needs to
// change in one place if the public base URL ever moves (e.g. to a custom
// domain).
export function avatarUrl(contactId: string): string {
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL}/avatars/${contactId}`;
}
