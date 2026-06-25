"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

function LinkContactInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams.get("contact_id");
  const [status, setStatus] = useState<"linking" | "done" | "error">("linking");

  useEffect(() => {
    async function link() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      await fetch("/api/auth/link-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contactId || null, email: user.email, userId: user.id }),
      });

      setStatus("done");
      setTimeout(() => router.replace("/client"), 1200);
    }
    link().catch(() => setStatus("error"));
  }, [contactId, router]);

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
      <div className="text-center space-y-3">
        {status === "linking" && <p className="text-xs tracking-[3px] uppercase text-[#555]">Setting up your account...</p>}
        {status === "done" && (
          <>
            <p className="text-xs tracking-[3px] uppercase text-[#4ade80]">Account linked</p>
            <p className="text-xs text-[#444]">Redirecting to your portal...</p>
          </>
        )}
        {status === "error" && (
          <button onClick={() => router.replace("/client")} className="text-xs text-[#555] hover:text-white">
            Continue to portal →
          </button>
        )}
      </div>
    </div>
  );
}

export default function LinkContactPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
        <p className="text-xs tracking-[3px] uppercase text-[#555]">Loading...</p>
      </div>
    }>
      <LinkContactInner />
    </Suspense>
  );
}
