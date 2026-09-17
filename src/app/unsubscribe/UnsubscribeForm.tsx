"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function UnsubscribeForm() {
  const token = useSearchParams().get("t");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { token } : { email }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-black tracking-tight uppercase mb-4">You&apos;re unsubscribed</h1>
        <p className="text-sm text-[#888] leading-relaxed">
          You won&apos;t get marketing emails from Luck Images anymore. If you book a shoot with us, you&apos;ll still get emails about that booking.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-md w-full text-center">
      <h1 className="text-3xl font-black tracking-tight uppercase mb-4">Unsubscribe</h1>
      <p className="text-sm text-[#888] leading-relaxed mb-8">
        {token
          ? "Stop getting marketing emails from Luck Images?"
          : "Enter your email address to stop getting marketing emails from Luck Images."}
      </p>
      {!token && (
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@brokerage.com"
          className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 placeholder:text-[#444] mb-4"
        />
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full bg-white text-black text-xs font-bold tracking-[3px] uppercase py-3.5 hover:bg-white/90 transition-colors disabled:opacity-50"
      >
        {status === "sending" ? "Unsubscribing..." : "Unsubscribe"}
      </button>
      {status === "error" && <p className="text-xs text-red-400 mt-4">Something went wrong — please try again.</p>}
    </form>
  );
}
