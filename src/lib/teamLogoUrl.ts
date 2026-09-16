// Same pattern as avatarUrl.ts — team logos live in R2's public bucket
// under a team-logos/ prefix, keyed by team id.
export function teamLogoUrl(teamId: string): string {
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL}/team-logos/${teamId}`;
}
