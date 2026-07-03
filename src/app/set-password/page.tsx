"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"" | "saving" | "error">("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setStatus("saving");
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password, data: { has_password: true } });
    if (err) { setError(err.message); setStatus("error"); return; }
    router.push("/client");
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col items-center justify-center px-6 relative">
      <img src="/hero-1.jpg" alt="" className="fixed inset-0 w-full h-full object-cover z-0 opacity-30" />
      <div className="fixed inset-0 bg-[#0c0c0c]/80 z-0" />

      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 mb-12 hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="Luck Images" width={32} height={32} className="w-8 h-8" />
          <span className="text-base font-black tracking-tight uppercase">Luck Images</span>
        </Link>

        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-2">Welcome</p>
        <h1 className="text-3xl font-black tracking-tight uppercase mb-2">Set Your Password</h1>
        <p className="text-sm text-[#666] mb-8">Create a password so you can log in directly next time.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs tracking-[2px] uppercase text-[#666] block mb-2">Password</label>
            <input
              type="password"
              required
              placeholder="8+ characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 transition-colors placeholder:text-[#444]"
            />
          </div>
          <div>
            <label className="text-xs tracking-[2px] uppercase text-[#666] block mb-2">Confirm Password</label>
            <input
              type="password"
              required
              placeholder="Repeat password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 transition-colors placeholder:text-[#444]"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={status === "saving"}
            className="w-full bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50 mt-2"
          >
            {status === "saving" ? "Saving..." : "Set Password & Enter Portal →"}
          </button>
        </form>
      </div>
    </main>
  );
}
