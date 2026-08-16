"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function JoinTeamPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "done" | "error" | "no-team">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get("team_id");
    if (!tid) { setStatus("no-team"); return; }
    setTeamId(tid);

    // Fetch team name
    fetch(`/api/portal/team-name?team_id=${tid}`)
      .then(r => r.json())
      .then(async d => {
        if (!d.name) { setStatus("no-team"); return; }
        setTeamName(d.name);

        // Check if already logged in
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Already authenticated — join immediately
          setStatus("joining");
          const res = await fetch("/api/portal/join-team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId: tid }),
          });
          if (res.ok) {
            setStatus("done");
            setTimeout(() => router.push("/client"), 1800);
          } else {
            const body = await res.json().catch(() => ({}));
            setErrorMsg(body.error || "Something went wrong.");
            setStatus("error");
          }
        } else {
          setStatus("ready");
        }
      });
  }, [router]);

  if (status === "loading" || status === "joining") {
    return (
      <main className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center">
        <p className="text-xs tracking-[3px] uppercase text-[#555]">
          {status === "joining" ? "Joining team..." : "Loading..."}
        </p>
      </main>
    );
  }

  if (status === "done") {
    return (
      <main className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#4ade80] text-xs tracking-[3px] uppercase mb-2">You&apos;re in!</p>
          <p className="text-sm text-[#666]">Redirecting to your portal...</p>
        </div>
      </main>
    );
  }

  if (status === "no-team") {
    return (
      <main className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs tracking-[3px] uppercase text-[#555] mb-2">Invalid Link</p>
          <p className="text-sm text-[#666] mb-6">This team invite link is not valid.</p>
          <Link href="/login" className="text-xs tracking-[2px] uppercase text-white/40 hover:text-white transition-colors">← Sign In</Link>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-xs tracking-[3px] uppercase text-red-400 mb-2">Couldn&apos;t Join</p>
          <p className="text-sm text-[#666] mb-6">{errorMsg}</p>
          <Link href="/client" className="text-xs tracking-[2px] uppercase text-white/40 hover:text-white transition-colors">Go to Portal →</Link>
        </div>
      </main>
    );
  }

  // status === "ready" — not logged in, show options
  const loginUrl = `/login?team_id=${teamId}&redirect=/join-team%3Fteam_id%3D${teamId}`;
  const registerUrl = `/register?team_id=${teamId}`;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <Link href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center flex flex-col gap-8">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-3">Team Invitation</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">{teamName}</h1>
            <p className="text-xs text-[#555] mt-3">You&apos;ve been invited to join this team on the Luck Images client portal.</p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href={loginUrl}
              className="block bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors"
            >
              Sign In to Join →
            </Link>
            <Link
              href={registerUrl}
              className="block border border-white/20 text-white text-xs tracking-[3px] uppercase py-4 hover:bg-white/5 transition-colors"
            >
              Create Account & Join →
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 px-8 py-6 text-center">
        <span className="text-xs tracking-[3px] uppercase text-[#333]">© 2026 Luck Images — Austin, TX</span>
      </footer>
    </main>
  );
}
