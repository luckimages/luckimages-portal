"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const role = data.user?.user_metadata?.role || "realtor";
      if (ADMIN_EMAILS.includes(data.user?.email || "")) {
        router.push("/choose-portal");
      } else if (role === "photographer") {
        router.push("/photographer");
      } else {
        router.push("/client");
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src="/hero-4.jpg" alt="" className="w-full h-full object-cover opacity-65" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0c]/60 via-transparent to-[#0c0c0c]" />
      </div>
      <div className="relative z-10 flex flex-col min-h-screen">

      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10" style={{textShadow:"0 2px 12px rgba(0,0,0,1)"}}>
        <Link href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">
          Luck Images
        </Link>
        <Link href="/" className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">
          ← Back
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md bg-[#0c0c0c]/90 border border-white/10 p-8 md:p-10">

          <div className="mb-10 text-center">
            <p className="text-sm tracking-[6px] uppercase text-white/40 mb-3">Portal Access</p>
            <h1 className="text-5xl font-black tracking-tight uppercase text-white">Sign In</h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-[2px] uppercase text-[#666]">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="bg-[#181818] border border-white/20 text-white text-sm px-4 py-4 outline-none focus:border-white/60 transition-colors placeholder:text-[#444]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-[2px] uppercase text-[#666]">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="bg-[#181818] border border-white/20 text-white text-sm px-4 py-4 outline-none focus:border-white/60 transition-colors placeholder:text-[#444]"
              />
            </div>

            {error && (
              <p className="text-xs tracking-[1px] text-red-400 border border-red-400/20 bg-red-400/5 px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/register"
              className="block text-center border-2 border-white/30 text-white text-sm tracking-[3px] uppercase font-bold py-4 hover:border-white hover:bg-white/5 transition-all"
            >
              New? Create a Free Account →
            </Link>
            <p className="text-center text-xs text-[#444] tracking-[1px] pt-2">
              Luck Images photographer?{" "}
              <Link href="/photographer-register" className="text-[#666] hover:text-white transition-colors underline underline-offset-4">
                Join the team
              </Link>
            </p>
          </div>

        </div>
      </div>

      <footer className="border-t border-white/10 px-8 py-6 text-center">
        <span className="text-xs tracking-[3px] uppercase text-white/30">
          © 2026 Luck Images — Austin, TX
        </span>
      </footer>

      </div>
    </main>
  );
}
