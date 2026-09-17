"use client";

import { useEffect, useState } from "react";
import { formatPhone } from "@/lib/format";

type ContactHit = { id: string; name: string; email: string | null; phone: string | null; brokerage: string | null; type: string | null; stage: string | null };
type ShootHit = { id: string; address: string | null; scheduled_at: string | null; status: string | null };

export type SearchTarget = { href: string; appLabel: "Contacts" | "Shoot Log" };

type Item = { key: string; group: "Contacts" | "Shoots"; label: string; sub: string; target: SearchTarget };

const EMPTY = { contacts: [] as ContactHit[], shoots: [] as ShootHit[] };

// ⌘K palette for the Command Center: type a name, email, phone, brokerage, or
// shoot address and jump straight there. Mount it only while open so every
// open starts blank.
export default function CommandSearch({ onClose, onSelect }: { onClose: () => void; onSelect: (target: SearchTarget) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(EMPTY);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          setResults(await res.json());
          setActive(0);
        }
      } catch {
        // aborted by a newer keystroke
      }
      setLoading(false);
    }, 180);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);

  const shown = q.trim().length < 2 ? EMPTY : results;
  const items: Item[] = [
    ...shown.contacts.map(c => ({
      key: `c-${c.id}`,
      group: "Contacts" as const,
      label: c.name,
      sub: [c.brokerage, c.phone ? formatPhone(c.phone) : null, c.email].filter(Boolean).join(" · "),
      target: { href: `/admin/contacts/${c.id}`, appLabel: "Contacts" as const },
    })),
    ...shown.shoots.map(s => ({
      key: `s-${s.id}`,
      group: "Shoots" as const,
      label: s.address || "Shoot",
      sub: [s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null, s.status].filter(Boolean).join(" · "),
      target: { href: `/admin/shoots?view=log&shoot=${s.id}`, appLabel: "Shoot Log" as const },
    })),
  ];

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); onSelect(items[active].target); }
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-start justify-center px-4 pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-xl bg-[#111] border border-white/15 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 border-b border-white/10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search contacts, phone numbers, brokerages, shoot addresses..."
            className="flex-1 bg-transparent text-white text-sm py-4 outline-none placeholder:text-[#444]"
          />
          {loading && <span className="text-[10px] text-[#444] uppercase tracking-[1px]">…</span>}
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="text-xs text-[#444] px-4 py-6">Type at least 2 characters.</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-[#444] px-4 py-6">{loading ? "Searching..." : "No matches."}</p>
          ) : (
            items.map((item, i) => (
              <div key={item.key}>
                {(i === 0 || items[i - 1].group !== item.group) && (
                  <p className="text-[10px] tracking-[2px] uppercase text-[#555] px-4 pt-3 pb-1">{item.group}</p>
                )}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onSelect(item.target)}
                  className={`w-full text-left px-4 py-2.5 transition-colors ${i === active ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <p className="text-sm text-white truncate">{item.label}</p>
                  {item.sub && <p className="text-[11px] text-[#666] truncate mt-0.5">{item.sub}</p>}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/10 text-[10px] text-[#444] tracking-[1px]">
          ↑↓ to move · Enter to open · Esc to close
        </div>
      </div>
    </div>
  );
}
