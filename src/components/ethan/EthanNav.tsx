"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/ethan", label: "Home" },
  { href: "/ethan/about", label: "About" },
];

export default function EthanNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet on navigation.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled || open
          ? "bg-[#0c0c0c]/92 backdrop-blur-md border-b border-[#C9A44C]/15 py-4"
          : "bg-transparent border-b border-transparent py-7"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <Link href="/ethan" className="group leading-none">
          <span className="font-display block text-[22px] md:text-[26px] tracking-[0.08em] text-[#F2EDE4] transition-colors group-hover:text-[#C9A44C]">
            Ethan Simpson
          </span>
          <span className="font-text block text-[9px] md:text-[10px] tracking-[0.42em] uppercase text-[#A89F93] mt-1.5">
            Private Chef
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-9">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`font-text text-[11px] tracking-[0.3em] uppercase transition-colors ${
                pathname === l.href ? "text-[#C9A44C]" : "text-[#A89F93] hover:text-[#F2EDE4]"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/ethan/book"
            className="font-text text-[11px] tracking-[0.3em] uppercase border border-[#C9A44C]/60 text-[#C9A44C] px-6 py-3 hover:bg-[#C9A44C] hover:text-[#0c0c0c] transition-colors duration-300"
          >
            Book Now
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px]"
        >
          <span className={`block w-5 h-px bg-[#F2EDE4] transition-transform duration-300 ${open ? "translate-y-[3px] rotate-45" : ""}`} />
          <span className={`block w-5 h-px bg-[#F2EDE4] transition-transform duration-300 ${open ? "-translate-y-[3px] -rotate-45" : ""}`} />
        </button>
      </nav>

      {open && (
        <div className="md:hidden px-6 pt-6 pb-4 flex flex-col gap-5 border-t border-[#C9A44C]/10 mt-4">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`font-text text-[12px] tracking-[0.3em] uppercase ${
                pathname === l.href ? "text-[#C9A44C]" : "text-[#A89F93]"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/ethan/book"
            className="font-text text-[12px] tracking-[0.3em] uppercase border border-[#C9A44C]/60 text-[#C9A44C] px-6 py-3 text-center"
          >
            Book Now
          </Link>
        </div>
      )}
    </header>
  );
}
