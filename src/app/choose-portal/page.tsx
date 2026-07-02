"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

export default function ChoosePortalPage() {
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

  function go(mode: string) {
    if (mode === "admin") { sessionStorage.removeItem("previewRole"); router.push("/dashboard"); return; }
    sessionStorage.setItem("previewRole", mode);
    router.push(mode === "realtor" ? "/client" : "/photographer");
  }

  if (!checked) return null;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col items-center justify-center px-6">
      <p className="text-xs tracking-[4px] uppercase text-[#666] mb-3">Welcome back, {userName}</p>
      <h1 className="text-3xl font-black tracking-tight uppercase mb-2">View As</h1>
      <p className="text-xs text-[#444] tracking-wide mb-12">Choose which portal to enter</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {[
          { role: "admin", label: "Admin", desc: "KPI dashboard & management", accent: "#a78bfa" },
          { role: "realtor", label: "Realtor", desc: "Book shoots, pay invoices, view media", accent: "#60a5fa" },
          { role: "photographer", label: "Photographer", desc: "Schedule, upload media, pay stubs", accent: "#4ade80" },
        ].map(({ role, label, desc, accent }) => (
          <button
            key={role}
            onClick={() => go(role)}
            className="bg-[#111] border border-white/10 p-8 text-left hover:bg-white/[0.04] transition-colors group"
            style={{ borderBottom: `2px solid ${accent}` }}
          >
            <p className="text-lg font-black tracking-tight uppercase mb-2 group-hover:text-white transition-colors">{label}</p>
            <p className="text-xs text-[#555] leading-relaxed">{desc}</p>
            <p className="text-xs tracking-[2px] uppercase mt-6 group-hover:text-white text-[#444] transition-colors">Enter →</p>
          </button>
        ))}
      </div>

      <button
        onClick={() => router.push("/dashboard/v2")}
        className="mt-16 text-[10px] tracking-[3px] uppercase text-white/20 hover:text-white/50 transition-colors"
      >
        Admin V2 Beta
      </button>
    </main>
  );
}
