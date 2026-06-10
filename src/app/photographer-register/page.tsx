"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

function PhotographerRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!token) { setValidating(false); return; }
    createClient()
      .from("photographer_invites")
      .select("name, used")
      .eq("token", token)
      .single()
      .then(({ data }) => {
        if (data && !data.used) {
          setTokenValid(true);
          setInviteName(data.name || "");
          setForm(f => ({ ...f, fullName: data.name || "" }));
        }
        setValidating(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName, role: "photographer", phone: form.phone }
      }
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    await supabase.from("photographer_invites").update({ used: true }).eq("token", token);
    router.push("/photographer");
  }

  const inputCls = "bg-[#181818] border border-white/10 text-white text-sm px-4 py-3.5 outline-none focus:border-white/40 transition-colors placeholder:text-[#444] w-full";
  const labelCls = "text-xs tracking-[2px] uppercase text-[#666]";

  return (
    <>
      {validating ? (
        <p className="text-center text-xs text-[#555] tracking-[2px] uppercase">Validating invite...</p>
      ) : !token || !tokenValid ? (
        <div className="bg-[#111] border border-white/10 p-8 text-center">
          <p className="text-sm text-[#888] mb-2">Invalid or expired invite link.</p>
          <p className="text-xs text-[#444]">Contact <a href="mailto:ryan@luckimages.com" className="underline underline-offset-4 hover:text-white transition-colors">ryan@luckimages.com</a> for a new one.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {inviteName && <p className="text-xs text-[#4ade80] tracking-[1px] text-center border border-[#4ade80]/20 bg-[#4ade8010] px-4 py-3">Invite confirmed for {inviteName}</p>}

          <div className="flex flex-col gap-2">
            <label className={labelCls}>Full Name</label>
            <input type="text" required value={form.fullName} onChange={e => set("fullName", e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Phone</label>
            <input type="tel" placeholder="(512) 555-0100" value={form.phone} onChange={e => set("phone", e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Email</label>
            <input type="email" required value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Password</label>
            <input type="password" required placeholder="••••••••" value={form.password} onChange={e => set("password", e.target.value)} className={inputCls} />
          </div>

          {error && <p className="text-xs text-red-400 border border-red-400/20 bg-red-400/5 px-4 py-3">{error}</p>}

          <button type="submit" disabled={loading} className="mt-2 bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
      )}
    </>
  );
}

export default function PhotographerRegisterPage() {
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
          </div>

          <Suspense fallback={<p className="text-center text-xs text-[#555] tracking-[2px] uppercase">Loading...</p>}>
            <PhotographerRegisterForm />
          </Suspense>
        </div>
      </div>

      <footer className="border-t border-white/10 px-8 py-6 text-center">
        <span className="text-xs tracking-[3px] uppercase text-[#333]">© 2026 Luck Images — Austin, TX</span>
      </footer>
    </main>
  );
}
