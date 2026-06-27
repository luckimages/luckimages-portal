"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import InsightsPage from "../InsightsPage";

const supabase = createClient();

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  status: string;
  price: number | null;
  contact_id: string | null;
  services: string[];
};

type Contact = {
  id: string;
  name: string;
  email: string | null;
  type: string;
  created_at: string;
  stage?: string;
};

export default function BetaPage() {
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: sh }, { data: cs }] = await Promise.all([
        supabase
          .from("shoots")
          .select("id, address, scheduled_at, status, price, contact_id, services")
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("contacts")
          .select("id, name, email, type, created_at, stage")
          .neq("stage", "deleted"),
      ]);
      setShoots(sh ?? []);
      setContacts(cs ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10 gap-4">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <a href="/admin/contacts" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors hidden sm:inline">Contacts</a>
          <a href="/admin/cold-calls" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors hidden sm:inline">📞 Calls</a>
          <a href="/choose-portal" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Portals</a>
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors hidden sm:inline">← Dashboard</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto w-full space-y-10 md:space-y-12">
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-[4px] uppercase text-[#a78bfa]">Beta Testing</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase">Insights</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
          </div>
        ) : (
          <InsightsPage shoots={shoots} contacts={contacts} />
        )}
      </div>
    </main>
  );
}
