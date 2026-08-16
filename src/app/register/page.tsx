"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const CHANNELS: { key: string; label: string }[] = [
  { key: "referral",          label: "Referral from someone I know" },
  { key: "google-seo",        label: "Google Search" },
  { key: "google-business",   label: "Google Business Profile" },
  { key: "yelp",              label: "Yelp" },
  { key: "instagram",         label: "Instagram" },
  { key: "facebook",          label: "Facebook" },
  { key: "linkedin-business", label: "LinkedIn (Luck Images)" },
  { key: "linkedin-personal", label: "LinkedIn (Ryan Luck)" },
  { key: "cold-call",         label: "They called me" },
  { key: "cold-email",        label: "Email outreach" },
  { key: "zillow",            label: "Zillow / Realtor.com" },
  { key: "networking",        label: "Networking event" },
  { key: "partnership",       label: "Partner company" },
  { key: "direct-mail",       label: "Direct mail / postcard" },
  { key: "other",             label: "Other" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "", email: "", password: "", phone: "",
    brokerage: "", areas: "", birthday: "",
    mailingList: false, referralSource: "", agreedToTerms: false,
  });
  // Honeypot — invisible to real users (off-screen, not display:none, since
  // some bots specifically skip that), but form-filling bots grab every
  // input they find. Any value here means it wasn't a human.
  const [honey, setHoney] = useState("");
  const [isInvited, setIsInvited] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const src = params.get("src");
    const by = params.get("by");
    if (ref || by) setReferredBy(ref || by);
    if (ref || by) setForm(f => ({ ...f, referralSource: "referral" }));
    if (src) setForm(f => ({ ...f, referralSource: src }));

    // Pre-fill from portal invite link — name/email/phone passed as params
    const prefillName  = params.get("name");
    const prefillEmail = params.get("email");
    const prefillPhone = params.get("phone");
    const tid = params.get("team_id");
    if (prefillName || prefillEmail || prefillPhone || tid) {
      setIsInvited(true);
      setForm(f => ({
        ...f,
        ...(prefillName  ? { fullName: prefillName }  : {}),
        ...(prefillEmail ? { email: prefillEmail }     : {}),
        ...(prefillPhone ? { phone: prefillPhone }     : {}),
      }));
    }
    if (tid) {
      setTeamId(tid);
      // Fetch team name to show in the UI
      fetch(`/api/portal/team-name?team_id=${tid}`)
        .then(r => r.json())
        .then(d => { if (d.name) setTeamName(d.name); });
    }
  }, []);

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Bot tripped the honeypot — pretend it worked and quietly bail rather
    // than erroring, so scripts don't get a clear signal to adapt to.
    if (honey) { setLoading(true); return; }
    setError(""); setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          role: "realtor",
          has_password: true,
          phone: form.phone,
          brokerage: form.brokerage,
          areas: form.areas,
          birthday: form.birthday,
          mailing_list: form.mailingList,
          referral_source: form.referralSource,
        }
      }
    });
    if (error) { setError(error.message); setLoading(false); return; }

    // Auto-link contact by email (or by contact_id param if present)
    const params = new URLSearchParams(window.location.search);
    const contactId = params.get("contact_id");
    const { data: { user: newUser } } = await supabase.auth.getUser();
    if (newUser) {
      await fetch("/api/auth/link-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contactId || null,
          email: form.email,
          userId: newUser.id,
          leadSource: form.referralSource || null,
          referredByContactId: referredBy || null,
        }),
      });

      // Join team if invited via team link
      if (teamId) {
        await fetch("/api/portal/join-team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId }),
        });
      }
    }

    router.push("/client");
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
        <div className="w-full max-w-lg">

          <div className="mb-10 text-center">
            <p className="text-xs tracking-[4px] uppercase text-[#666] mb-3">Luck Images — Client Portal</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">{isInvited ? "Set Up Your Account" : "Create Account"}</h1>
            <p className="text-xs text-[#444] mt-3 tracking-wide">
              {teamName
                ? `You've been invited to join ${teamName} — just set a password to finish.`
                : isInvited
                  ? "Your info is pre-filled — just choose a password to finish."
                  : "For realtors, property managers & interior designers"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Honeypot — real users never see or reach this field */}
            <div className="absolute left-[-9999px] w-px h-px overflow-hidden" aria-hidden="true">
              <label htmlFor="company">Company</label>
              <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off"
                value={honey} onChange={e => setHoney(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Full Name</label>
                <input type="text" required placeholder="Jane Smith" value={form.fullName} onChange={e => set("fullName", e.target.value)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Phone</label>
                <input type="tel" placeholder="(512) 555-0100" value={form.phone} onChange={e => set("phone", e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelCls}>Email</label>
              <input type="email" required placeholder="you@brokerage.com" value={form.email}
                onChange={e => set("email", e.target.value)}
                readOnly={isInvited}
                className={inputCls + (isInvited ? " opacity-60 cursor-default" : "")} />
              {isInvited && <p className="text-[10px] text-[#444]">This is the email your invite was sent to.</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelCls}>Password</label>
              <input type="password" required placeholder="••••••••" value={form.password} onChange={e => set("password", e.target.value)} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Brokerage / Company</label>
                <input type="text" placeholder="Keller Williams, etc." value={form.brokerage} onChange={e => set("brokerage", e.target.value)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Birthday <span className="text-[#444]">(optional)</span></label>
                <input type="date" value={form.birthday} onChange={e => set("birthday", e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelCls}>Preferred Areas / Zip Codes</label>
              <input type="text" placeholder="78701, 78704, South Austin..." value={form.areas} onChange={e => set("areas", e.target.value)} className={inputCls} />
            </div>

            {!isInvited && (
              <div className="flex flex-col gap-2">
                <label className={labelCls}>How did you hear about us?</label>
                <select value={form.referralSource} onChange={e => set("referralSource", e.target.value)} className={inputCls + " cursor-pointer"}>
                  <option value="">Select one...</option>
                  {CHANNELS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer mt-1">
              <input type="checkbox" checked={form.mailingList} onChange={e => set("mailingList", e.target.checked)} className="accent-white w-4 h-4" />
              <span className="text-xs tracking-[1px] text-[#888]">Sign me up for tips, promotions & market updates</span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" required checked={form.agreedToTerms} onChange={e => set("agreedToTerms", e.target.checked)} className="accent-white w-4 h-4 mt-0.5 shrink-0" />
              <span className="text-xs tracking-[1px] text-[#888]">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="text-white underline underline-offset-4 hover:text-[#4ade80] transition-colors">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" target="_blank" className="text-white underline underline-offset-4 hover:text-[#4ade80] transition-colors">Privacy Policy</Link>
              </span>
            </label>

            {error && (
              <p className="text-xs tracking-[1px] text-red-400 border border-red-400/20 bg-red-400/5 px-4 py-3">{error}</p>
            )}

            <button type="submit" disabled={loading} className="mt-2 bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/10 text-center">
            <p className="text-xs text-[#444] tracking-[1px]">
              Already have an account?{" "}
              <Link href="/login" className="text-[#666] hover:text-white transition-colors underline underline-offset-4">Sign in</Link>
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
