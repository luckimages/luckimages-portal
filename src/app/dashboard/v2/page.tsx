"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];
const HERO_SRC = "/hero-1.jpg";

export default function DashboardV2Page() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) {
        router.replace("/dashboard");
        return;
      }
      setUserName(data.user.user_metadata?.full_name?.split(" ")[0] || "");
      setChecked(true);
    });
  }, [router]);

  if (!checked) return null;

  return (
    <main className="relative min-h-screen bg-[#0c0c0c] text-white flex flex-col overflow-hidden">
      {/* Full-page hero background */}
      <div className="absolute inset-0">
        <img src={HERO_SRC} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/85" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 md:px-8 py-4 md:py-6">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <span className="text-[10px] tracking-[3px] uppercase text-[#a78bfa]">V2 Beta</span>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-white/60 hover:text-white transition-colors">Classic Dashboard</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
        <p className="text-xs tracking-[4px] uppercase text-white/50 mb-3">Welcome back, {userName}</p>
        <h1 className="text-[clamp(40px,8vw,96px)] font-black tracking-tight uppercase leading-none mb-4">
          Luck Images
        </h1>
        <p className="text-sm md:text-base text-white/60 max-w-md">
          Fresh canvas — we'll build this out together.
        </p>
      </div>
    </main>
  );
}
