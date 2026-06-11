"use client";

import Link from "next/link";
import { useState } from "react";
import { SERVICES } from "@/lib/services";

const linkCls = "text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors";

export default function HomeNav() {
  const [servicesOpen, setServicesOpen] = useState(false);

  return (
    <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-6">
      <Link href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-80 transition-opacity">
        Luck Images
      </Link>

      <div className="flex items-center gap-8">
        <a href="#home" className={linkCls}>Home</a>

        {/* Services dropdown */}
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
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 bg-[#111] border border-white/10 py-1">
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
          )}
        </div>

        <a href="#pricing" className={linkCls}>Pricing</a>
        <a href="#about" className={linkCls}>About</a>
        <a href="#contact" className={linkCls}>Contact</a>

        <Link
          href="/login"
          className="text-xs tracking-[3px] uppercase border border-white/25 px-5 py-2.5 hover:border-white hover:bg-white/5 transition-all"
        >
          Login
        </Link>
      </div>
    </nav>
  );
}
