"use client";

// Contact page row: whether we're allowed to contact this person.
// Do Not Contact is set by hand when someone asks us to stop; the unsubscribe
// state is set when they click Unsubscribe in a marketing email.
export default function ContactPreferences({
  doNotContact, unsubscribedAt, onToggleDoNotContact, onClearUnsubscribe,
}: {
  doNotContact: boolean;
  unsubscribedAt: string | null;
  onToggleDoNotContact: (next: boolean) => Promise<void>;
  onClearUnsubscribe: () => Promise<void>;
}) {
  return (
    <div className="bg-[#111] border border-white/10 px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={doNotContact}
          onClick={() => onToggleDoNotContact(!doNotContact)}
          className={`relative w-9 h-5 rounded-full transition-colors ${doNotContact ? "bg-red-500" : "bg-white/15"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${doNotContact ? "left-[18px]" : "left-0.5"}`} />
        </button>
        <span className={`text-[10px] tracking-[2px] uppercase ${doNotContact ? "text-red-400" : "text-[#555]"}`}>Do Not Contact</span>
      </label>
      {unsubscribedAt ? (
        <p className="text-[11px] text-[#666]">
          Unsubscribed from emails {new Date(unsubscribedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          {" · "}
          <button
            onClick={() => { if (confirm("Only do this if they asked to get emails again. Resubscribe them?")) onClearUnsubscribe(); }}
            className="underline hover:text-white transition-colors"
          >
            Undo
          </button>
        </p>
      ) : (
        <p className="text-[11px] text-[#444]">Subscribed to emails</p>
      )}
    </div>
  );
}
