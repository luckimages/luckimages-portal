"use client";

import Link from "next/link";
import { useState } from "react";
import { SERVICES } from "@/lib/services";

const linkCls = "text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors";

export default function HomeNav() {
  const [servicesOpen, setServicesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);

  return (
    <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5">
      <Link href="/" className="text-base font-black tracking-tight uppercase hover:opacity-80 transition-opacity whitespace-nowrap">
        Luck Images
      </Link>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-8">
        <a href="#home" className={linkCls}>Home</a>

        <div
          className="relative"
          onMouseEnter={() => setServicesOpen(true)}
          onMouseLeave={() => setServicesOpen(false)}
        >
          <button className={linkCls + " flex items-center gap-1.5"}>
            Services
            <span className="text-[8px] opacity-60">▾</span>
          </button>

          {servicesOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-48 pt-3">
              <div className="bg-[#111] border border-white/10 py-1">
                {SERVICES.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/services/${s.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 text-xs tracking-[2px] uppercase text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <span className="text-sm">{s.icon}</span>
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <a href="#pricing" className={linkCls}>Pricing</a>
        <a href="#about" className={linkCls}>About</a>
        <a href="#contact" className={linkCls}>Contact</a>

        <Link href="/login" className="text-xs tracking-[3px] uppercase border border-white/25 px-5 py-2.5 hover:border-white hover:bg-white/5 transition-all">
          Login
        </Link>
      </div>

      {/* Mobile: login + hamburger */}
      <div className="flex md:hidden items-center gap-4">
        <Link href="/login" className="text-xs tracking-[3px] uppercase border border-white/25 px-4 py-2 hover:border-white transition-all">
          Login
        </Link>
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-white/70 hover:text-white transition-colors p-1">
          {menuOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#0c0c0c]/95 border-b border-white/10 flex flex-col py-4 md:hidden">
          <a href="#home" onClick={() => setMenuOpen(false)} className="px-6 py-3 text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">Home</a>

          {/* Services accordion */}
          <button
            onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
            className="px-6 py-3 text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors flex items-center justify-between w-full"
          >
            Services
            <span className={`text-[10px] opacity-60 transition-transform duration-200 ${mobileServicesOpen ? "rotate-180" : ""}`}>▾</span>
          </button>
          {mobileServicesOpen && (
            <div className="border-t border-white/5">
              {SERVICES.map((s) => (
                <Link key={s.slug} href={`/services/${s.slug}`} target="_blank" onClick={() => setMenuOpen(false)}
                  className="px-10 py-2.5 text-xs tracking-[2px] uppercase text-white/40 hover:text-white transition-colors flex items-center gap-3">
                  <span>{s.icon}</span>{s.name}
                </Link>
              ))}
            </div>
          )}
          <a href="#pricing" onClick={() => setMenuOpen(false)} className="px-6 py-3 text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">Pricing</a>
          <a href="#about" onClick={() => setMenuOpen(false)} className="px-6 py-3 text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">About</a>
          <a href="#contact" onClick={() => setMenuOpen(false)} className="px-6 py-3 text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">Contact</a>
        </div>
      )}
    </nav>
  );
}
