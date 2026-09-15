"use client";

// Shown when the server rejects a booking/confirm/reschedule because it
// would double-book a photographer (see src/lib/bookingConflict.ts). Distinct
// from the various inline green "saved ✓" messages already in these pages —
// this is a warning, not a confirmation, so it gets its own look and doesn't
// get missed.
export default function ConflictBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] max-w-lg w-[calc(100%-3rem)]">
      <div className="bg-[#2a1a0a] border border-amber-500/40 shadow-lg shadow-black/40 px-5 py-4 flex items-start gap-3">
        <span className="text-amber-400 text-lg leading-none">⚠️</span>
        <p className="text-sm text-amber-200 flex-1">{message}</p>
        <button onClick={onDismiss} className="text-amber-400/60 hover:text-amber-200 transition-colors text-xs tracking-wide uppercase">
          Dismiss
        </button>
      </div>
    </div>
  );
}

// A conflict response from confirm-booking / admin shoots PATCH looks like
// { error: "...", conflict: { id, address, scheduled_at } }. Everything else
// (validation errors, 500s) just uses .error as a plain string — this only
// needs to recognize the double-booking shape to phrase it consistently.
export function conflictMessage(data: { error?: string; conflict?: { address: string; scheduled_at: string } }): string {
  if (data.conflict) {
    const when = new Date(data.conflict.scheduled_at).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
    });
    return `Photographer already booked at ${data.conflict.address} on ${when}.`;
  }
  return data.error || "Something went wrong.";
}
