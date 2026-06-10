"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

export default function InvitePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
    });
  }, [router]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    const token = crypto.randomUUID();
    const supabase = createClient();
    await supabase.from("photographer_invites").insert({ token, name, email, used: false });
    const url = `${window.location.origin}/photographer-register?token=${token}`;
    setLink(url);
  }

  function copy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputCls = "bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 transition-colors placeholder:text-[#444] w-full";

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <span className="text-xl font-black tracking-tight uppercase">Luck Images</span>
        <button onClick={() => router.push("/dashboard")} className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">← Dashboard</button>
      </header>

      <div className="flex-1 px-8 py-12 max-w-lg mx-auto w-full">
        <div className="mb-10">
          <p className="text-xs tracking-[4px] uppercase text-[#666] mb-2">Team Management</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">Invite Photographer</h1>
        </div>

        <form onSubmit={generate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs tracking-[2px] uppercase text-[#666]">Photographer Name</label>
            <input type="text" required placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs tracking-[2px] uppercase text-[#666]">Their Email <span className="text-[#444]">(optional — for your records)</span></label>
            <input type="email" placeholder="jane@email.com" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" className="mt-2 bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors">
            Generate Invite Link
          </button>
        </form>

        {link && (
          <div className="mt-8 bg-[#111] border border-white/10 p-6">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Invite Link for {name}</p>
            <p className="text-xs text-[#888] break-all mb-4 font-mono">{link}</p>
            <div className="flex gap-3">
              <button onClick={copy} className="flex-1 bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-3 hover:bg-white/90 transition-colors">
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <a href={`mailto:${email}?subject=Your Luck Images Photographer Account&body=Hi ${name},%0A%0AHere's your invite link to create your Luck Images photographer account:%0A%0A${encodeURIComponent(link)}%0A%0AThis link is unique to you. See you on the next shoot!%0A%0ARyan`} className="flex-1 bg-transparent border border-white/20 text-white text-xs tracking-[3px] uppercase font-semibold py-3 hover:bg-white/5 transition-colors text-center">
                Email Directly
              </a>
            </div>
            <button onClick={() => { setLink(""); setName(""); setEmail(""); }} className="w-full mt-3 text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors py-2">
              Generate Another
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
