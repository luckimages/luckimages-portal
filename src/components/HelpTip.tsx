"use client";

import { useState, useRef, useEffect } from "react";

export default function HelpTip({ content, title }: { content: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative inline-flex shrink-0" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-4 h-4 rounded-full border border-white/20 text-[#555] hover:text-white hover:border-white/50 transition-all flex items-center justify-center text-[9px] font-bold leading-none"
        title="Help"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 w-64 bg-[#1c1c1c] border border-white/15 p-3.5 z-[100] shadow-2xl">
          {title && <p className="text-[10px] tracking-[1.5px] uppercase text-white font-semibold mb-1.5">{title}</p>}
          <p className="text-[11px] text-[#888] leading-relaxed">{content}</p>
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full overflow-hidden w-3 h-1.5">
            <div className="w-2.5 h-2.5 bg-[#1c1c1c] border-r border-b border-white/15 rotate-45 -translate-y-1.5 translate-x-0.5" />
          </div>
        </div>
      )}
    </div>
  );
}
