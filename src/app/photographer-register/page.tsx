"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const INVITE_CODE = "LUCKPHOTO2026";

export default function PhotographerRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "", inviteCode: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.inviteCode.trim().toUpperCase() !== INVITE_CODE) {
      setError("Invalid invite code. Contact ryan@luckimages.com to get access.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          role: "photographer",
          phone: form.phone,
          invite_code: form.inviteCode,
        }
      }
    });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/photographer");
  }

  const inputCls = "bg-[#181818] border border-white/10 text-white text-sm px-4 py-3.5 outline-none focus:border-white/40 transition-colors placeholder:text-[#444] w-full";
  const labelCls = "text-xs tracking-[2px] uppercase text-[#666]";

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <Link href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</Link>
        <Link href="/login" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">← Sign In</Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">

          <div className="mb-10 text-center">
            <p className="text-xs tracking-[4px] uppercase text-[#666] mb-3">Team Access</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">Photographer Sign Up</h1>
            <p className="text-xs text-[#444] mt-3 tracking-wide">Requires an invite code from Luck Images</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div className="flex flex-col gap-2">
              <label className={labelCls}>Invite Code</label>
              <input type="text" required placeholder="Enter your invite code" value={form.inviteCode} onChange={e => set("inviteCode", e.target.value)} className={inputCls + " uppercase tracking-widest"} />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelCls}>Full Name</label>
              <input type="text" required placeholder="Jane Smith" value={form.fullName} onChange={e => set("fullName", e.target.value)} className={inputCls} />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelCls}>Phone</label>
              <input type="tel" placeholder="(512) 555-0100" value={form.phone} onChange={e => set("phone", e.target.value)} className={inputCls} />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelCls}>Email</label>
              <input type="email" required placeholder="you@email.com" value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelCls}>Password</label>
              <input type="password" required placeholder="••••••••" value={form.password} onChange={e => set("password", e.target.value)} className={inputCls} />
            </div>

            {error && (
              <p className="text-xs tracking-[1px] text-red-400 border border-red-400/20 bg-red-400/5 px-4 py-3">{error}</p>
            )}

            <button type="submit" disabled={loading} className="mt-2 bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/10 text-center">
            <p className="text-xs text-[#444] tracking-[1px]">
              Need an invite code?{" "}
              <a href="mailto:ryan@luckimages.com" className="text-[#666] hover:text-white transition-colors underline underline-offset-4">Contact Ryan</a>
            </p>
          </div>

        </div>
      </div>

      <footer className="border-t border-white/10 px-8 py-6 text-center">
        <span className="text-xs tracking-[3px] uppercase text-[#333]">© 2026 Luck Images — Austin, TX</span>
      </footer>

    </main>
  );
}
