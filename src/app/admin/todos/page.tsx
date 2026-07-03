"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Todo = { id: string; text: string; title?: string; details?: string; created_by: string; created_at: string; completed_at: string | null; completed_by?: string; is_urgent: boolean };

function userColor(name: string) {
  if (name === "ryan") return "text-[#4ade80]";
  if (name === "leif") return "text-[#60a5fa]";
  return "text-[#888]";
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    + " · " + new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function TodosPage() {
  const router = useRouter();
  const [active, setActive] = useState<Todo[]>([]);
  const [completed, setCompleted] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [detailsInput, setDetailsInput] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDetails, setEditDetails] = useState("");

  useEffect(() => {
    fetch("/api/admin/todos").then(r => r.json()).then(d => {
      setActive(d.active || []);
      setCompleted(d.completed || []);
      setLoading(false);
    });
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const res = await fetch("/api/admin/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", title: input, details: detailsInput, is_urgent: urgent }) });
    if (res.ok) { const { todo } = await res.json(); setActive(t => [...t, todo]); setInput(""); setDetailsInput(""); setUrgent(false); }
  }

  async function complete(id: string) {
    await fetch("/api/admin/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", id }) });
    const item = active.find(t => t.id === id);
    if (item) { setActive(t => t.filter(x => x.id !== id)); setCompleted(t => [{ ...item, completed_at: new Date().toISOString() }, ...t]); }
  }

  async function saveEdit(id: string) {
    await fetch("/api/admin/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", id, title: editTitle, details: editDetails }) });
    setActive(ts => ts.map(t => t.id === id ? { ...t, title: editTitle, text: editTitle, details: editDetails } : t));
    setEditing(null);
  }

  async function del(id: string) {
    await fetch("/api/admin/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    setCompleted(t => t.filter(x => x.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="border-b border-white/10 px-8 py-5 flex items-center gap-6">
        <button onClick={() => router.push("/dashboard?page=apps")} className="text-[#555] text-sm hover:text-white transition-colors">← Dashboard</button>
        <h1 className="text-sm font-bold tracking-[3px] uppercase">✓ To Do</h1>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8 space-y-8">
        {loading ? <p className="text-xs text-[#555] italic">Loading...</p> : (
          <>
            {/* Active */}
            <section>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                Active — {active.length}
              </p>

              {/* Add form */}
              <form onSubmit={add} className="flex flex-col gap-2 mb-6">
                <div className="flex gap-2">
                  <input value={input} onChange={e => setInput(e.target.value)} placeholder="Title"
                    className="flex-1 bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
                  <button type="button" onClick={() => setUrgent(u => !u)}
                    className={`px-4 border text-sm font-bold transition-colors ${urgent ? "border-red-500 text-red-400 bg-red-500/10" : "border-white/10 text-[#555] hover:text-white"}`}
                    title="Mark as urgent">!</button>
                  <button type="submit" className="px-6 bg-white text-black text-xs tracking-[2px] uppercase font-semibold hover:bg-[#ddd] transition-colors">Add</button>
                </div>
                <textarea value={detailsInput} onChange={e => setDetailsInput(e.target.value)} placeholder="Details (optional)"
                  className="bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333] resize-none"
                  rows={2} />
              </form>

              <div className="space-y-1">
                {active.length === 0 && <p className="text-xs text-[#444] italic">Nothing pending — you're all clear.</p>}
                {active.map(t => {
                  const isOpen = expanded === t.id;
                  const isEdit = editing === t.id;
                  const title = t.title || t.text;
                  return (
                    <div key={t.id} className={`bg-[#111] border ${t.is_urgent ? "border-red-500/40" : "border-white/10"}`}>
                      {/* Title row */}
                      <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                        onClick={() => setExpanded(isOpen ? null : t.id)}>
                        <button onClick={e => { e.stopPropagation(); complete(t.id); }}
                          className="w-5 h-5 border border-white/20 rounded flex-shrink-0 hover:border-[#4ade80] hover:bg-[#4ade80]/10 transition-all" />
                        <p className="text-sm flex-1">{title}</p>
                        {t.is_urgent && <span className="text-red-400 text-xs font-bold">!</span>}
                        <span className="text-[#333] text-xs">{isOpen ? "▲" : "▼"}</span>
                      </div>

                      {/* Expanded */}
                      {isOpen && (
                        <div className="px-4 pb-4 border-t border-white/5 bg-white/[0.01]">
                          {isEdit ? (
                            <div className="flex flex-col gap-2 pt-3">
                              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                className="bg-[#1a1a1a] border border-white/10 text-sm px-3 py-2 outline-none text-white w-full"
                                placeholder="Title" />
                              <textarea value={editDetails} onChange={e => setEditDetails(e.target.value)}
                                className="bg-[#1a1a1a] border border-white/10 text-sm px-3 py-2 outline-none text-white w-full resize-none"
                                rows={4} placeholder="Details (optional)" />
                              <div className="flex gap-4">
                                <button onClick={() => saveEdit(t.id)}
                                  className="text-xs tracking-[2px] uppercase text-[#4ade80] hover:text-white transition-colors">Save</button>
                                <button onClick={() => setEditing(null)}
                                  className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="pt-3">
                              {t.details ? (
                                <p className="text-sm text-[#888] leading-relaxed whitespace-pre-wrap mb-3">{t.details}</p>
                              ) : (
                                <p className="text-xs text-[#333] italic mb-3">No details added.</p>
                              )}
                              <div className="flex items-center gap-4">
                                <p className="text-xs flex items-center gap-1.5">
                                  <span className={userColor(t.created_by)}>{t.created_by}</span>
                                  <span className="text-[#333]">· {fmtTime(t.created_at)}</span>
                                </p>
                                <button onClick={() => { setEditing(t.id); setEditTitle(t.title || t.text); setEditDetails(t.details || ""); }}
                                  className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">Edit</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Completed history */}
            <section>
              <button onClick={() => setShowHistory(h => !h)}
                className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 w-full after:flex-1 after:h-px after:bg-white/10 after:content-[''] hover:text-[#888] transition-colors">
                History — {completed.length} {showHistory ? "▲" : "▼"}
              </button>
              {showHistory && (
                <div className="space-y-1">
                  {completed.length === 0 && <p className="text-xs text-[#444] italic">No completed tasks yet.</p>}
                  {completed.map(t => (
                    <div key={t.id} className="bg-[#111] border border-white/5 flex items-center gap-4 px-4 py-3 opacity-50">
                      <div className="w-5 h-5 border border-white/10 rounded flex-shrink-0 bg-[#4ade80]/20 flex items-center justify-center">
                        <span className="text-[#4ade80] text-xs">✓</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm line-through text-[#666]">{t.title || t.text}</p>
                        {t.details && <p className="text-xs text-[#444] mt-0.5 line-through">{t.details}</p>}
                        <p className="text-xs mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className={userColor(t.created_by)}>{t.created_by}</span>
                          <span className="text-[#2a2a2a]">created {fmtTime(t.created_at)}</span>
                          {t.completed_at && (
                            <>
                              <span className="text-[#2a2a2a]">·</span>
                              <span className={userColor(t.completed_by || "")}>done {t.completed_by}</span>
                              <span className="text-[#2a2a2a]">{fmtTime(t.completed_at)}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <button onClick={() => del(t.id)} className="text-[#444] hover:text-red-400 text-xs transition-colors">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
