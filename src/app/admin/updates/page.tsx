"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

type Update = { id: string; type: string; message: string; created_at: string; by?: string };

export default function UpdatesHistoryPage() {
  const router = useRouter();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) {
        router.replace("/dashboard");
        return;
      }
      fetch("/api/admin/company-updates?history=1")
        .then(r => r.json())
        .then(json => {
          const posts = (json.posts || []).map((p: { id: string; message: string; created_at: string; created_by?: string }) => ({
            id: p.id, type: "post", message: p.message, created_at: p.created_at, by: p.created_by,
          }));
          const all: Update[] = [...posts, ...(json.auto || [])].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setUpdates(all);
          setLoading(false);
        });
    });
  }, [router]);

  // Group by date label
  const grouped: { label: string; items: Update[] }[] = [];
  for (const u of updates) {
    const label = new Date(u.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const last = grouped[grouped.length - 1];
    if (last && last.label === label) last.items.push(u);
    else grouped.push({ label, items: [u] });
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white">
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Dashboard</a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-black tracking-tight uppercase mb-1">Update History</h1>
        <p className="text-xs text-[#444] tracking-wide mb-10">All activity — calls, contacts, shoots, and manual posts</p>

        {loading && <p className="text-xs text-[#444] italic">Loading...</p>}

        {!loading && updates.length === 0 && (
          <p className="text-xs text-[#333] italic">No activity recorded yet.</p>
        )}

        {grouped.map(group => (
          <div key={group.label} className="mb-8">
            <p className="text-[10px] tracking-[3px] uppercase text-[#444] mb-3 pb-2 border-b border-white/5">{group.label}</p>
            <div className="space-y-0">
              {group.items.map(u => {
                const icon = u.type === "call" ? "📞" : u.type === "contact" ? "👤" : u.type === "shoot" ? "📷" : "💬";
                return (
                  <div key={u.id} className="flex gap-3 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] px-1">
                    <span className="text-sm mt-0.5 flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed">{u.message}</p>
                      <p className="text-[10px] text-[#444] mt-0.5">
                        {new Date(u.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        {u.by ? ` · ${u.by}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
