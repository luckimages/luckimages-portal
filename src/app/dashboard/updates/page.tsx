"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type PendingShoot = {
  id: string;
  address: string;
  client_name: string;
  client_email: string;
  scheduled_at: string | null;
  services: string[];
  price: number | null;
  drive_minutes: number | null;
  notes: string | null;
  square_footage: number | null;
  photographer_ids: string[];
};

type Registration = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  registered_at: string;
};

type Photographer = { id: string; name: string; email: string };

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtWhen(iso: string | null) {
  if (!iso) return "No time set";
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Estimated per-line price for the services receipt — same pricing tiers
// used in the client booking form's quote calculator.
function servicePrice(service: string, sqft: number): number {
  switch (service) {
    case "Listing Photos": return sqft ? (sqft <= 1500 ? 200 : sqft <= 2000 ? 250 : sqft <= 2500 ? 300 : sqft <= 3000 ? 350 : 400) : 200;
    case "Matterport 3D Tour": return sqft ? (sqft <= 2000 ? 200 : sqft <= 3000 ? 300 : sqft <= 4000 ? 400 : 500) : 200;
    case "Floor Plan": return sqft ? (sqft < 2500 ? 50 : 75) : 50;
    case "Twilight": return 250;
    case "Video Walkthrough": return 200;
    case "Drone Photos": return 200;
    case "Headshots": return 200;
    case "Drone Add-on": return 100;
    case "Twilight Add-on": return 150;
    case "Virtual Staging": return 25;
    default: return 0;
  }
}

function useAcks(sourceType: string) {
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/notification-acks?source_type=${sourceType}`);
    if (res.ok) {
      const { ackedIds } = await res.json();
      setAcked(new Set(ackedIds));
    }
    setLoaded(true);
  }, [sourceType]);

  useEffect(() => { load(); }, [load]);

  async function ack(sourceId: string) {
    setAcked(prev => new Set(prev).add(sourceId));
    await fetch("/api/admin/notification-acks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType, sourceId }),
    });
  }

  return { acked, ack, loaded };
}

export default function UpdatesPage() {
  const [pendingShoots, setPendingShoots] = useState<PendingShoot[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [loadingShoots, setLoadingShoots] = useState(true);
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [expandedShoot, setExpandedShoot] = useState<string | null>(null);
  const [expandedReg, setExpandedReg] = useState<string | null>(null);
  const [editDatetime, setEditDatetime] = useState<Record<string, string>>({});
  const [editPhotographers, setEditPhotographers] = useState<Record<string, string[]>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [updateInput, setUpdateInput] = useState("");
  const [serviceQuotes, setServiceQuotes] = useState<Record<string, Record<string, string>>>({});
  const [savingQuote, setSavingQuote] = useState<string | null>(null);
  const autoExpandedRef = useRef(false);

  const pendingAcks = useAcks("pending_shoot");
  const regAcks = useAcks("new_registration");

  const loadShoots = useCallback(async () => {
    const res = await fetch("/api/admin/shoots");
    if (res.ok) {
      const raw = await res.json();
      setPendingShoots(Array.isArray(raw) ? raw : []);
    }
    setLoadingShoots(false);
  }, []);

  const loadRegs = useCallback(async () => {
    const res = await fetch("/api/admin/registrations");
    if (res.ok) {
      const { registrations } = await res.json();
      setRegistrations(registrations || []);
    }
    setLoadingRegs(false);
  }, []);

  useEffect(() => {
    loadShoots();
    loadRegs();
    fetch("/api/admin/photographers").then(r => r.ok ? r.json() : []).then(setPhotographers);
  }, [loadShoots, loadRegs]);

  // Deep link from the board's Pending Shoots widget (?shoot=<id>) — expand
  // that specific shoot automatically and scroll it into view, once.
  useEffect(() => {
    if (autoExpandedRef.current || pendingShoots.length === 0) return;
    autoExpandedRef.current = true;
    const shootId = new URLSearchParams(window.location.search).get("shoot");
    const s = shootId ? pendingShoots.find(x => x.id === shootId) : null;
    if (!s) return;
    initShootEdits(s);
    setExpandedShoot(s.id);
    setTimeout(() => {
      document.getElementById(`pending-shoot-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShoots]);

  function initShootEdits(s: PendingShoot) {
    pendingAcks.ack(s.id);
    if (!editDatetime[s.id]) setEditDatetime(d => ({ ...d, [s.id]: s.scheduled_at ? toDatetimeLocal(s.scheduled_at) : "" }));
    if (!editPhotographers[s.id]) setEditPhotographers(p => ({ ...p, [s.id]: s.photographer_ids || [] }));
    if (!serviceQuotes[s.id]) {
      const init: Record<string, string> = {};
      (s.services || []).forEach(svc => { init[svc] = String(servicePrice(svc, s.square_footage || 0)); });
      setServiceQuotes(q => ({ ...q, [s.id]: init }));
    }
  }

  function toggleShootExpand(s: PendingShoot) {
    setExpandedShoot(prev => {
      const next = prev === s.id ? null : s.id;
      if (next) initShootEdits(s);
      return next;
    });
  }

  function togglePhotographer(shootId: string, photogId: string) {
    setEditPhotographers(prev => {
      const cur = prev[shootId] || [];
      const next = cur.includes(photogId) ? cur.filter(id => id !== photogId) : [...cur, photogId];
      return { ...prev, [shootId]: next };
    });
  }

  async function saveQuote(id: string, amount: number) {
    setSavingQuote(id);
    const res = await fetch("/api/admin/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, price: amount }),
    });
    setSavingQuote(null);
    if (res.ok) setPendingShoots(prev => prev.map(x => x.id === id ? { ...x, price: amount } : x));
  }

  async function confirmShoot(s: PendingShoot) {
    setConfirming(s.id);
    const dt = editDatetime[s.id];
    const scheduledAt = dt ? new Date(dt).toISOString() : s.scheduled_at;
    const photographerIds = editPhotographers[s.id] || s.photographer_ids || [];
    const res = await fetch("/api/admin/confirm-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shootId: s.id, scheduledAt, photographerIds }),
    });
    setConfirming(null);
    if (res.ok) {
      await pendingAcks.ack(s.id);
      setExpandedShoot(null);
      setPendingShoots(prev => prev.filter(x => x.id !== s.id));
    }
  }

  function toggleRegExpand(r: Registration) {
    setExpandedReg(prev => {
      const next = prev === r.id ? null : r.id;
      if (next) regAcks.ack(r.id);
      return next;
    });
  }

  async function postUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!updateInput.trim()) return;
    await fetch("/api/admin/company-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: updateInput.trim() }),
    });
    setUpdateInput("");
  }

  const unackedShoots = pendingShoots.filter(s => !pendingAcks.acked.has(s.id)).length;
  const unackedRegs = registrations.filter(r => !regAcks.acked.has(r.id)).length;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <div className="flex-1 px-4 md:px-8 py-8 max-w-4xl mx-auto w-full space-y-8">

        <div>
          <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-1">Command Center</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">Updates</h1>
          <p className="text-xs text-[#444] mt-1">
            Full history now lives on the <a href="/dashboard/calendar" className="text-[#666] underline hover:text-white transition-colors">Calendar</a> — filterable by type.
          </p>
        </div>

        {/* ══ PENDING SHOOTS BOX ══ */}
        <div className="bg-[#111] border border-white/10">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <p className="text-xs tracking-[2px] uppercase text-[#888] font-semibold">📅 Pending Shoots</p>
            {unackedShoots > 0 && <span className="text-[10px] font-bold px-2 py-0.5 bg-[#fbbf24] text-black rounded-full">{unackedShoots} new</span>}
          </div>
          {loadingShoots ? (
            <p className="text-xs text-[#444] italic p-6">Loading...</p>
          ) : pendingShoots.length === 0 ? (
            <p className="text-xs text-[#333] italic p-6">No pending booking requests.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {pendingShoots.map(s => {
                const isUnacked = !pendingAcks.acked.has(s.id);
                const isExpanded = expandedShoot === s.id;
                const quoteTotal = Object.values(serviceQuotes[s.id] || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
                return (
                  <div key={s.id} id={`pending-shoot-${s.id}`} className={isUnacked ? "bg-[#fbbf24]/[0.06] border-l-2 border-l-[#fbbf24]" : ""}>
                    <button onClick={() => toggleShootExpand(s)} className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{s.address}</p>
                          {isUnacked && <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] shrink-0" />}
                        </div>
                        <p className="text-[11px] text-[#666] mt-0.5">
                          {s.client_name || "Unknown client"} · {fmtWhen(s.scheduled_at)}
                          {s.drive_minutes != null && <span className="text-[#60a5fa]"> · 🚗 {s.drive_minutes} min</span>}
                        </p>
                      </div>
                      <span className="text-[10px] text-[#333] shrink-0">{isExpanded ? "▲" : "▼"}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 border-t border-white/5 bg-white/[0.015] space-y-4">
                        <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-xs">
                          <div><p className="text-[#444] mb-0.5">Date &amp; Time</p><p className="text-[#ccc]">{fmtWhen(s.scheduled_at)}</p></div>
                          <div><p className="text-[#444] mb-0.5">Realtor</p><p className="text-[#ccc] truncate">{s.client_email || s.client_name || "—"}</p></div>
                          <div><p className="text-[#444] mb-0.5">Sq Ft</p><p className="text-[#ccc]">{s.square_footage ? `${s.square_footage.toLocaleString()} sq ft` : "—"}</p></div>
                        </div>

                        <div>
                          <p className="text-[10px] tracking-[1px] uppercase text-[#555] mb-2">Services</p>
                          {(s.services || []).length > 0 ? (
                            <div className="border border-white/10">
                              {(s.services || []).map((svc, i) => (
                                <div key={svc} className={`flex items-center justify-between px-3 py-2 text-xs gap-3 ${i > 0 ? "border-t border-white/5" : ""}`}>
                                  <span className="text-white">{svc}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[#666]">$</span>
                                    <input type="number" min="0"
                                      value={serviceQuotes[s.id]?.[svc] ?? ""}
                                      onChange={e => setServiceQuotes(q => ({ ...q, [s.id]: { ...(q[s.id] || {}), [svc]: e.target.value } }))}
                                      className="w-20 bg-[#1a1a1a] border border-white/10 text-[#4ade80] font-semibold text-xs px-2 py-1 outline-none focus:border-white/30 text-right" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[#333] italic">No services selected</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] tracking-[1px] uppercase text-[#555] mb-1">Quote (total)</p>
                            <p className="text-lg font-bold text-[#4ade80]">${quoteTotal.toLocaleString()}</p>
                          </div>
                          <button onClick={() => saveQuote(s.id, quoteTotal)} disabled={savingQuote === s.id}
                            className="text-[10px] tracking-[1px] uppercase text-white border border-white/20 px-4 py-2 hover:bg-white/5 transition-colors disabled:opacity-40">
                            {savingQuote === s.id ? "Saving..." : s.price === quoteTotal ? "Saved ✓" : "Save Quote"}
                          </button>
                        </div>

                        {s.notes && <p className="text-xs text-[#777] italic">&ldquo;{s.notes}&rdquo;</p>}

                        <div>
                          <p className="text-[10px] tracking-[1px] uppercase text-[#555] mb-1">Confirm time</p>
                          <input type="datetime-local" value={editDatetime[s.id] || ""} onChange={e => setEditDatetime(d => ({ ...d, [s.id]: e.target.value }))}
                            className="w-full bg-[#1a1a1a] border border-white/10 text-white text-xs px-3 py-2 outline-none focus:border-white/30 [color-scheme:dark]" />
                        </div>

                        <div>
                          <p className="text-[10px] tracking-[1px] uppercase text-[#555] mb-2">Assign photographer</p>
                          <div className="flex flex-wrap gap-2">
                            {photographers.map(p => {
                              const assigned = (editPhotographers[s.id] || []).includes(p.id);
                              return (
                                <button key={p.id} type="button" onClick={() => togglePhotographer(s.id, p.id)}
                                  className={`text-xs px-3 py-1.5 border transition-all ${assigned ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white"}`}>
                                  {p.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button onClick={() => confirmShoot(s)} disabled={confirming === s.id}
                            className="flex-1 text-xs tracking-[1px] uppercase font-bold py-2.5 bg-[#4ade80] text-black hover:bg-[#34d399] transition-colors disabled:opacity-40">
                            {confirming === s.id ? "Confirming…" : "Confirm & Notify"}
                          </button>
                          <a href={`/dashboard/board`} className="text-xs tracking-[1px] uppercase py-2.5 px-4 border border-white/10 text-[#888] hover:text-white transition-colors">
                            Board →
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ══ NEW REGISTRATIONS BOX ══ */}
        <div className="bg-[#111] border border-white/10">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <p className="text-xs tracking-[2px] uppercase text-[#888] font-semibold">👤 New Portal Registrations</p>
            {unackedRegs > 0 && <span className="text-[10px] font-bold px-2 py-0.5 bg-[#34d399] text-black rounded-full">{unackedRegs} new</span>}
          </div>
          {loadingRegs ? (
            <p className="text-xs text-[#444] italic p-6">Loading...</p>
          ) : registrations.length === 0 ? (
            <p className="text-xs text-[#333] italic p-6">No portal registrations yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {registrations.map(r => {
                const isUnacked = !regAcks.acked.has(r.id);
                const isExpanded = expandedReg === r.id;
                return (
                  <div key={r.id} className={isUnacked ? "bg-[#34d399]/[0.06] border-l-2 border-l-[#34d399]" : ""}>
                    <button onClick={() => toggleRegExpand(r)} className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{r.name}</p>
                          {isUnacked && <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] shrink-0" />}
                        </div>
                        <p className="text-[11px] text-[#666] mt-0.5">
                          {r.email} · {new Date(r.registered_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className="text-[10px] text-[#333] shrink-0">{isExpanded ? "▲" : "▼"}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 border-t border-white/5 bg-white/[0.015] space-y-3">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                          <div><p className="text-[#444] mb-0.5">Phone</p><p className="text-[#ccc]">{r.phone || "—"}</p></div>
                          <div><p className="text-[#444] mb-0.5">Brokerage</p><p className="text-[#ccc]">{r.brokerage || "—"}</p></div>
                        </div>
                        <a href={`/admin/contacts/${r.id}`} className="inline-block text-xs tracking-[1px] uppercase py-2 px-4 border border-white/20 text-white hover:bg-white/5 transition-colors">
                          View Contact →
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Post a manual update — still feeds the Calendar's "Nocturne" filter */}
        <form onSubmit={postUpdate} className="border border-white/10 flex">
          <input
            value={updateInput}
            onChange={e => setUpdateInput(e.target.value)}
            placeholder="Post an update for the team..."
            className="flex-1 bg-[#111] text-sm px-5 py-3 outline-none placeholder:text-[#333] text-white"
          />
          <button type="submit" className="px-5 py-3 text-[#555] hover:text-white transition-colors border-l border-white/10 bg-[#111]">→</button>
        </form>

      </div>
    </main>
  );
}
