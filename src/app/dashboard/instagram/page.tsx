"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const BASE_URL = "https://www.luckimages.com";

const DEFAULT_MESSAGE = (name: string) =>
  `Hey${name ? ` ${name}` : ""}! I'm Ryan — I shoot real estate photography, video, drone & twilight here in Austin. No pressure at all, just wanted to share our booking portal in case it's ever useful for a listing:`;

type Lead = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  registered_at: string | null;
};

export default function InstagramToolPage() {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [message, setMessage] = useState(DEFAULT_MESSAGE(""));
  const [messageTouched, setMessageTouched] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [clickedIds, setClickedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadLeads = useCallback(async () => {
    const supabase = createClient();
    const [{ data: leadData }, { data: clickData }] = await Promise.all([
      supabase.from("contacts").select("id, name, notes, created_at, registered_at").eq("lead_source", "instagram").order("created_at", { ascending: false }),
      supabase.from("link_clicks").select("contact_id").eq("service", "instagram-dm"),
    ]);
    setLeads(leadData || []);
    setClickedIds(new Set((clickData || []).map(c => c.contact_id).filter(Boolean)));
    setLoading(false);
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Keep the message's name in sync until the user edits it by hand.
  useEffect(() => {
    if (!messageTouched) setMessage(DEFAULT_MESSAGE(name));
  }, [name, messageTouched]);

  async function generateLink(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setGenerating(true);
    const supabase = createClient();
    const { data: contact, error } = await supabase.from("contacts").insert({
      name: name.trim(),
      type: "lead",
      stage: "lead",
      lead_source: "instagram",
      notes: handle.trim() ? `IG: @${handle.trim().replace(/^@/, "")}` : null,
    }).select().single();
    setGenerating(false);
    if (error || !contact) return;

    const destination = `${BASE_URL}/register?src=instagram&contact_id=${contact.id}`;
    const tracked = `${BASE_URL}/api/track-link?url=${encodeURIComponent(destination)}&contact=${contact.id}&service=instagram-dm`;
    setGeneratedLink(tracked);
    await loadLeads();
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function resetForm() {
    setName(""); setHandle(""); setMessage(DEFAULT_MESSAGE(""));
    setMessageTouched(false); setGeneratedLink("");
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <div className="flex-1 px-4 md:px-8 py-8 max-w-3xl mx-auto w-full space-y-8">

        <div>
          <p className="text-xs tracking-[4px] uppercase text-[#f472b6] mb-1">Marketing</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">📸 Instagram DM Tool</h1>
          <p className="text-xs text-[#444] mt-1">Generate a tracked link per realtor — see if they clicked and/or registered.</p>
        </div>

        {/* Generator */}
        <div className="bg-[#111] border border-white/10 p-5 space-y-4">
          <p className="text-xs tracking-[2px] uppercase text-[#888] font-semibold">1. Generate a link</p>
          <form onSubmit={generateLink} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] tracking-[1.5px] uppercase text-[#555]">Realtor Name</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Smith"
                className="bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] tracking-[1.5px] uppercase text-[#555]">Instagram Handle <span className="text-[#333]">(optional)</span></label>
              <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="janesmith_realty"
                className="bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]" />
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={generating || !name.trim()}
                className="w-full text-xs tracking-[2px] uppercase font-bold py-3 bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-40">
                {generating ? "Generating..." : "Generate Tracked Link →"}
              </button>
            </div>
          </form>
        </div>

        {/* Message + Link */}
        {generatedLink && (
          <div className="bg-[#111] border border-[#4ade80]/30 p-5 space-y-4">
            <p className="text-xs tracking-[2px] uppercase text-[#4ade80] font-semibold">2. Copy &amp; paste into the DM</p>

            <div>
              <label className="text-[10px] tracking-[1.5px] uppercase text-[#555] block mb-1.5">Message (edit freely)</label>
              <textarea value={message} onChange={e => { setMessage(e.target.value); setMessageTouched(true); }} rows={3}
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-white/30 resize-none" />
              <button type="button" onClick={() => copy(message, "message")}
                className="mt-2 text-[10px] tracking-[1.5px] uppercase border border-white/20 px-3 py-1.5 text-[#888] hover:text-white hover:border-white/40 transition-all">
                {copied === "message" ? "✓ Copied" : "Copy Message"}
              </button>
            </div>

            <div>
              <label className="text-[10px] tracking-[1.5px] uppercase text-[#555] block mb-1.5">Tracked Link</label>
              <div className="flex items-center gap-2">
                <input readOnly value={generatedLink} className="flex-1 bg-[#181818] border border-white/10 text-[#60a5fa] text-xs px-3 py-2.5 outline-none truncate" />
                <button type="button" onClick={() => copy(generatedLink, "link")}
                  className="text-[10px] tracking-[1.5px] uppercase border border-white/20 px-3 py-2.5 text-[#888] hover:text-white hover:border-white/40 transition-all shrink-0">
                  {copied === "link" ? "✓ Copied" : "Copy Link"}
                </button>
              </div>
            </div>

            <button type="button" onClick={() => copy(`${message}\n${generatedLink}`, "both")}
              className="w-full text-xs tracking-[2px] uppercase font-bold py-3 border border-[#4ade80]/40 text-[#4ade80] hover:bg-[#4ade80]/10 transition-colors">
              {copied === "both" ? "✓ Copied Message + Link" : "Copy Message + Link Together"}
            </button>

            <button type="button" onClick={resetForm} className="text-[10px] tracking-[1px] uppercase text-[#555] hover:text-white transition-colors">
              + Generate another
            </button>
          </div>
        )}

        {/* History */}
        <div className="bg-[#111] border border-white/10">
          <div className="px-5 py-3 border-b border-white/10">
            <p className="text-xs tracking-[2px] uppercase text-[#888] font-semibold">DM History</p>
          </div>
          {loading ? (
            <p className="text-xs text-[#444] italic p-6">Loading...</p>
          ) : leads.length === 0 ? (
            <p className="text-xs text-[#333] italic p-6">No Instagram links generated yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {leads.map(l => {
                const clicked = clickedIds.has(l.id);
                const registered = !!l.registered_at;
                return (
                  <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{l.name}</p>
                      <p className="text-[10px] text-[#555] mt-0.5">
                        {l.notes || "—"} · Sent {new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] tracking-[1px] uppercase px-2 py-1 ${registered ? "bg-[#4ade80]/10 text-[#4ade80]" : clicked ? "bg-[#60a5fa]/10 text-[#60a5fa]" : "bg-white/5 text-[#555]"}`}>
                        {registered ? "Registered" : clicked ? "Clicked" : "Sent"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
