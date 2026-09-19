"use client";

import { useEffect, useRef, useState } from "react";

type ContactHit = { id: string; name: string; email: string | null; brokerage: string | null };

// Admin-only control shown at the top of /client: lets an admin search for
// any contact and view their portal read-only (via /api/admin/preview-portal)
// without needing their password. Bare UI + search — navigation on
// select/clear is left to the caller.
export default function AdminPortalPreviewBar({
  current,
  onSelect,
  onClear,
}: {
  current: { id: string; name: string } | null;
  onSelect: (contact: { id: string; name: string }) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactHit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      if (query.trim().length < 2) { setResults([]); return; }
      fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => setResults(d.contacts || []))
        .catch(() => {});
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative z-30 bg-[#60a5fa]/10 border-b border-[#60a5fa]/30 px-4 md:px-8 py-2 flex items-center gap-3 flex-wrap">
      <p className="text-[10px] tracking-[2px] uppercase text-[#60a5fa] shrink-0">View Realtor Portal As:</p>

      {current ? (
        <div className="flex items-center gap-2 bg-[#60a5fa]/15 border border-[#60a5fa]/30 px-3 py-1">
          <span className="text-xs text-white">{current.name}</span>
          <button onClick={onClear} className="text-[#60a5fa] hover:text-white text-xs" aria-label="Exit preview">✕</button>
        </div>
      ) : (
        <div className="relative" ref={boxRef}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search contacts by name, email, brokerage..."
            className="bg-black/30 border border-white/15 text-xs text-white placeholder:text-[#666] px-3 py-1.5 w-64 focus:outline-none focus:border-[#60a5fa]/50"
          />
          {open && results.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-80 bg-[#0c0c0c] border border-white/15 shadow-xl max-h-72 overflow-y-auto">
              {results.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setOpen(false); setQuery(""); onSelect({ id: c.id, name: c.name }); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-0"
                >
                  <p className="text-xs text-white">{c.name}</p>
                  <p className="text-[10px] text-[#666]">{[c.email, c.brokerage].filter(Boolean).join(" · ")}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
