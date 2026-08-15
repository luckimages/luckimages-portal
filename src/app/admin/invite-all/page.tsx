"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

type Contact = {
  id: string;
  name: string;
  email: string;
  stage: string;
  total_revenue: number | null;
  user_id: string | null;
};

type InviteStatus = "idle" | "pending" | "done" | "error";

export default function InviteAllPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, InviteStatus>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, email, stage, total_revenue, user_id")
        .not("email", "is", null)
        .is("user_id", null)
        .neq("stage", "deleted")
        .neq("stage", "lead")
        .order("total_revenue", { ascending: false, nullsFirst: false });
      setContacts((data || []).filter(c => c.email));
      setLoading(false);
    }
    load();
  }, []);

  function toggleAll() {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map(c => c.id)));
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function sendInvites() {
    if (selected.size === 0) return;
    setSending(true);
    setSent(0);

    const toInvite = contacts.filter(c => selected.has(c.id));

    for (const contact of toInvite) {
      setStatuses(s => ({ ...s, [contact.id]: "pending" }));
      try {
        const res = await fetch("/api/admin/invite-contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: contact.id }),
        });
        if (!res.ok) throw new Error("Invite failed");
        setStatuses(s => ({ ...s, [contact.id]: "done" }));
        setSent(n => n + 1);
      } catch {
        setStatuses(s => ({ ...s, [contact.id]: "error" }));
      }

      // Small delay to avoid Resend rate limits
      await new Promise(r => setTimeout(r, 400));
    }

    setSending(false);
  }

  const totalSelected = selected.size;
  const doneCount = Object.values(statuses).filter(s => s === "done").length;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <div className="flex items-center gap-6">
          <a href="/admin/contacts" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Contacts</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 py-8 md:py-12 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-1">Client Outreach</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">Mass Portal Invite</h1>
          <p className="text-sm text-[#555] mt-2">
            Send personalized portal invite emails to past clients who don&apos;t have an account yet.
            Each gets a unique magic link valid for 24 hours.
          </p>
        </div>

        {/* Stats + actions */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-2xl font-black">{contacts.length}</p>
              <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Uninvited clients</p>
            </div>
            {doneCount > 0 && (
              <div>
                <p className="text-2xl font-black text-[#4ade80]">{doneCount}</p>
                <p className="text-[10px] tracking-[2px] uppercase text-[#555]">Sent this session</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleAll} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-4 py-2">
              {selected.size === contacts.length ? "Deselect All" : `Select All (${contacts.length})`}
            </button>
            <button
              onClick={sendInvites}
              disabled={sending || selected.size === 0}
              className="text-xs tracking-[1px] uppercase font-semibold px-6 py-2 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40"
            >
              {sending ? `Sending ${sent}/${totalSelected}...` : `Send ${totalSelected > 0 ? totalSelected : ""} Invite${totalSelected !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 border border-white/10">
            <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="border border-white/10 p-16 text-center">
            <p className="text-[#4ade80] font-semibold mb-2">All caught up!</p>
            <p className="text-xs text-[#444]">All contacts with emails already have portal accounts.</p>
          </div>
        ) : (
          <div className="border border-white/10 divide-y divide-white/5">
            {contacts.map(c => {
              const status = statuses[c.id];
              const isSelected = selected.has(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => { if (!sending) toggle(c.id); }}
                  className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors ${isSelected ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"}`}
                >
                  {/* Checkbox */}
                  <div className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${
                    status === "done" ? "border-[#4ade80] bg-[#4ade80]/20" :
                    status === "error" ? "border-red-500 bg-red-500/20" :
                    status === "pending" ? "border-[#fbbf24] bg-[#fbbf24]/10" :
                    isSelected ? "border-white bg-white/10" : "border-white/20"
                  }`}>
                    {status === "done" && <span className="text-[#4ade80] text-[10px]">✓</span>}
                    {status === "error" && <span className="text-red-400 text-[10px]">✕</span>}
                    {status === "pending" && <span className="w-2 h-2 rounded-full bg-[#fbbf24] animate-pulse block" />}
                    {!status && isSelected && <span className="text-white text-[10px]">✓</span>}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-[#555]">{c.email}</p>
                  </div>

                  {/* Stage */}
                  <span className="text-[10px] tracking-wide text-[#444] hidden sm:inline">{c.stage}</span>

                  {/* Revenue */}
                  {(c.total_revenue || 0) > 0 && (
                    <span className="text-xs font-semibold text-[#4ade80] shrink-0">${(c.total_revenue || 0).toLocaleString()}</span>
                  )}

                  {/* Status label */}
                  {status && (
                    <span className={`text-[10px] tracking-wide shrink-0 ${
                      status === "done" ? "text-[#4ade80]" :
                      status === "error" ? "text-red-400" :
                      "text-[#fbbf24]"
                    }`}>
                      {status === "done" ? "Sent" : status === "error" ? "Failed" : "Sending..."}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-[#333] mt-4">Only showing contacts with emails who haven&apos;t signed up yet. Contacts already in the portal are excluded.</p>
      </div>
    </main>
  );
}
