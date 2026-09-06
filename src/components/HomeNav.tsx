"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { SERVICES } from "@/lib/services";
import { createClient } from "@/lib/supabase";
import { avatarUrl as getAvatarUrl } from "@/lib/avatarUrl";

const linkCls = "text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors";

export default function HomeNav() {
  const [servicesOpen, setServicesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const [portalHref, setPortalHref] = useState("/choose-portal");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      setLoggedIn(true);
      const user = data.session.user;
      const name = user.user_metadata?.full_name || user.email || "";
      setInitials(name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase());
      const role = user.user_metadata?.role;
      setPortalHref(role === "admin" ? "/dashboard" : role === "photographer" ? "/photographer" : "/client");
      // Try to load avatar
      const { data: contact } = await supabase.from("contacts").select("id").eq("user_id", user.id).single();
      if (contact?.id) setAvatarUrl(getAvatarUrl(contact.id));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session);
      if (!session) { setAvatarUrl(null); setInitials(""); }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <Image src="/logo.png" alt="Luck Images" width={32} height={32} className="w-8 h-8" />
        <span className="text-base font-black tracking-tight uppercase whitespace-nowrap">Luck Images</span>
      </Link>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-8">
        <Link href="/" className={linkCls}>Home</Link>

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
                {SERVICES.filter((s) => s.slug !== "video").map((s) => (
                  <Link
                    key={s.slug}
                    href={`/services/${s.slug}`}
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

        <Link href="/pricing" className={linkCls}>Pricing</Link>
        <Link href="/about" className={linkCls}>About</Link>
        <Link href="/contact" className={linkCls}>Contact</Link>

        <a href="https://instagram.com/luckimages.atx" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white transition-colors" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
        </a>
        {loggedIn ? (
          <div className="flex items-center gap-3">
            <Link href={portalHref} className="w-8 h-8 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center hover:border-white/60 transition-colors flex-shrink-0">
              {!avatarError && avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
              ) : (
                <span className="text-[11px] font-bold text-white">{initials}</span>
              )}
            </Link>
          </div>
        ) : (
          <Link href="/login" className="text-xs tracking-[3px] uppercase border border-white/25 px-5 py-2.5 hover:border-white hover:bg-white/5 transition-all">
            Portal →
          </Link>
        )}
      </div>

      {/* Mobile: login + hamburger */}
      <div className="flex md:hidden items-center gap-4">
        {loggedIn ? (
          <Link href={portalHref} className="w-8 h-8 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center hover:border-white/60 transition-colors flex-shrink-0">
            {!avatarError && avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
            ) : (
              <span className="text-[11px] font-bold text-white">{initials}</span>
            )}
          </Link>
        ) : (
          <Link href="/login" className="text-xs tracking-[3px] uppercase border border-white/25 px-4 py-2 hover:border-white transition-all">
            Portal →
          </Link>
        )}
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
          <Link href="/" onClick={() => setMenuOpen(false)} className="px-6 py-3 text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">Home</Link>

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
              {SERVICES.filter((s) => s.slug !== "video").map((s) => (
                <Link key={s.slug} href={`/services/${s.slug}`} onClick={() => setMenuOpen(false)}
                  className="px-10 py-2.5 text-xs tracking-[2px] uppercase text-white/40 hover:text-white transition-colors flex items-center gap-3">
                  <span>{s.icon}</span>{s.name}
                </Link>
              ))}
            </div>
          )}
          <Link href="/pricing" onClick={() => setMenuOpen(false)} className="px-6 py-3 text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">Pricing</Link>
          <Link href="/about" onClick={() => setMenuOpen(false)} className="px-6 py-3 text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">About</Link>
          <Link href="/contact" onClick={() => setMenuOpen(false)} className="px-6 py-3 text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">Contact</Link>
          <a href="https://instagram.com/luckimages.atx" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="px-6 py-3 text-xs tracking-[3px] uppercase text-white/40 hover:text-white transition-colors flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
            Instagram
          </a>
        </div>
      )}
    </nav>
  );
}
