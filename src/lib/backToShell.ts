// The dashboard shell (/dashboard/v2) only knows which sidebar app to show
// via a URL param — it has no idea which app a standalone tool page (Cold
// Calls, the Board, a quote, etc.) was opened from. Tool "Back" buttons used
// to hardcode a fresh jump to the apps grid, which always dropped that param
// and landed on whichever app is first in the sidebar. Real browser history
// already remembers where the user actually came from, so prefer that; only
// fall back to a fresh jump to the shell when there's nothing to go back to
// (opened in a new tab, no referring page).
export function backToShell(fallback = "/dashboard/v2?page=apps") {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = fallback;
  }
}
