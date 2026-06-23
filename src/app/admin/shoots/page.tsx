"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const SERVICES = [
  "HDR Photography",
  "Aerial / Drone",
  "Virtual Staging",
  "Video Walkthrough",
  "3D Tour / Matterport",
  "Floor Plan",
  "Twilight Photography",
  "Headshots / Agent Photos",
];

type Shoot = {
  id: string;
  address: string;
  scheduled_at: string | null;
  services: string[];
  notes: string | null;
  square_footage: number | null;
  client_id: string | null;
  client_name?: string;
  client_email?: string;
  photographer_ids: string[];
  status: string;
};

type Photographer = { id: string; name: string; email: string };
type Client = { id: string; name: string; email: string };

export default function ShootsPage() {
  const router = useRouter();
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [sqft, setSqft] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedPhotographers, setSelectedPhotographers] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/shoots?full=1").then(r => r.json()),
      fetch("/api/admin/photographers").then(r => r.json()),
      fetch("/api/admin/realtors").then(r => r.json()),
    ]).then(([shootData, photoData, clientData]) => {
      setShoots(Array.isArray(shootData) ? shootData : []);
      setPhotographers(Array.isArray(photoData) ? photoData : []);
      // realtors API returns full_name; normalize to name
      const normalized = (Array.isArray(clientData) ? clientData : []).map((c: {id: string; full_name?: string; email?: string}) => ({ id: c.id, name: c.full_name || c.email || "", email: c.email || "" }));
      setClients(normalized);
      setLoading(false);
    });
  }, []);

  function toggleService(s: string) {
    setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function togglePhotographer(id: string) {
    setSelectedPhotographers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function searchClients(q: string) {
    setClientSearch(q);
    if (!q.trim()) { setClientResults([]); return; }
    const lower = q.toLowerCase();
    setClientResults(clients.filter(c => c.name.toLowerCase().includes(lower) || c.email.toLowerCase().includes(lower)).slice(0, 5));
  }

  async function createShoot(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/shoots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        scheduled_at: scheduledAt || null,
        services: selectedServices,
        notes: notes || null,
        square_footage: sqft ? parseInt(sqft) : null,
        client_id: selectedClient?.id || null,
        photographer_ids: selectedPhotographers,
      }),
    });
    if (res.ok) {
      const { shoot } = await res.json();
      const newShoot = { ...shoot, client_name: selectedClient?.name, client_email: selectedClient?.email };
      setShoots(prev => [newShoot, ...prev]);
      setAddress(""); setScheduledAt(""); setSelectedServices([]); setNotes(""); setSqft("");
      setSelectedClient(null); setClientSearch(""); setSelectedPhotographers([]);
      setShowForm(false);
    }
    setSaving(false);
  }

  const [statusError, setStatusError] = useState<Record<string, string>>({});

  async function updateStatus(id: string, status: string, photographer_ids?: string[]) {
    setStatusError(e => ({ ...e, [id]: "" }));
    const res = await fetch("/api/admin/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, photographer_ids }),
    });
    if (!res.ok) {
      const d = await res.json();
      setStatusError(e => ({ ...e, [id]: d.error || "Failed" }));
      return;
    }
    setShoots(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }

  const pending = shoots.filter(s => s.status === "pending");
  const scheduled = shoots.filter(s => s.status === "scheduled");
  const completed = shoots.filter(s => s.status === "completed");
  const cancelled = shoots.filter(s => s.status === "cancelled");

  function ShootCard({ shoot }: { shoot: Shoot }) {
    const [expanded, setExpanded] = useState(false);
    const err = statusError[shoot.id];
    return (
      <div className={`bg-[#111] border border-white/10 p-4 hover:border-white/20 transition-colors ${shoot.status === "pending" ? "border-l-2 border-l-[#fbbf24]/50" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{shoot.address}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {shoot.scheduled_at && (
                <span className="text-xs text-[#888]">
                  {new Date(shoot.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {" · "}
                  {new Date(shoot.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
              {shoot.client_name && <span className="text-xs text-[#666]">{shoot.client_name}</span>}
              {shoot.client_email && !shoot.client_name && <span className="text-xs text-[#666]">{shoot.client_email}</span>}
            </div>
            {shoot.services?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {shoot.services.map(svc => (
                  <span key={svc} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-white/5 border border-white/10 text-[#888]">{svc}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] tracking-[2px] uppercase px-2 py-1 ${
              shoot.status === "pending" ? "text-[#fbbf24] bg-[#fbbf2415]" :
              shoot.status === "scheduled" ? "text-[#4ade80] bg-[#4ade8015]" :
              shoot.status === "completed" ? "text-[#888] bg-white/5" :
              "text-red-400 bg-red-500/10"
            }`}>{shoot.status}</span>
            <button onClick={() => setExpanded(e => !e)} className="text-[#555] hover:text-white text-xs transition-colors px-2">{expanded ? "▲" : "▼"}</button>
          </div>
        </div>
        {expanded && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
            {shoot.notes && <p className="text-xs text-[#888]">{shoot.notes}</p>}
            {shoot.square_footage && <p className="text-xs text-[#555]">{shoot.square_footage.toLocaleString()} sq ft</p>}
            {shoot.photographer_ids?.length > 0 && (
              <p className="text-xs text-[#555]">Photographers: {shoot.photographer_ids.length}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {shoot.status === "pending" && (
                <button onClick={() => updateStatus(shoot.id, "scheduled")}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 bg-[#4ade80]/10 border border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/20 transition-colors">
                  Confirm
                </button>
              )}
              {(shoot.status === "pending" || shoot.status === "scheduled") && (
                <>
                  <button onClick={() => updateStatus(shoot.id, "completed")}
                    className="text-xs tracking-[1px] uppercase px-4 py-2 bg-white/5 border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">
                    Mark Complete
                  </button>
                  <button onClick={() => updateStatus(shoot.id, "cancelled")}
                    className="text-xs tracking-[1px] uppercase px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
                    Cancel
                  </button>
                </>
              )}
              {shoot.status === "completed" && (
                <button onClick={() => updateStatus(shoot.id, "scheduled")}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/20 transition-colors">
                  ↩ Undo Complete
                </button>
              )}
              {shoot.status === "cancelled" && (
                <button onClick={() => updateStatus(shoot.id, "scheduled")}
                  className="text-xs tracking-[1px] uppercase px-4 py-2 bg-white/5 border border-white/10 text-[#888] hover:border-white/30 hover:text-white transition-colors">
                  ↩ Reopen
                </button>
              )}
            </div>
            {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="border-b border-white/10 px-8 py-5 flex items-center gap-6">
        <button onClick={() => router.push("/dashboard")} className="text-[#555] text-sm hover:text-white transition-colors">← Dashboard</button>
        <h1 className="text-sm font-bold tracking-[3px] uppercase">Shoots</h1>
        <div className="flex-1" />
        <button onClick={() => setShowForm(f => !f)}
          className="text-xs tracking-[2px] uppercase px-6 py-2.5 bg-white text-black font-semibold hover:bg-[#ddd] transition-colors">
          + New Shoot
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-10">
        {/* New Shoot Form */}
        {showForm && (
          <section>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
              New Shoot
            </p>
            <form onSubmit={createShoot} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Property address *" required
                    className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
                </div>
                <input value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} type="datetime-local"
                  className="bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 [color-scheme:dark]" />
                <input value={sqft} onChange={e => setSqft(e.target.value)} type="number" placeholder="Square footage"
                  className="bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
              </div>

              {/* Services */}
              <div>
                <p className="text-xs text-[#555] tracking-[2px] uppercase mb-2">Services</p>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map(svc => (
                    <button key={svc} type="button" onClick={() => toggleService(svc)}
                      className={`text-xs px-3 py-1.5 border transition-colors ${selectedServices.includes(svc) ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                      {svc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client search */}
              <div className="relative">
                <p className="text-xs text-[#555] tracking-[2px] uppercase mb-2">Assign to Client</p>
                {selectedClient ? (
                  <div className="flex items-center gap-3 bg-[#111] border border-white/20 px-4 py-3">
                    <span className="text-sm flex-1">{selectedClient.name || selectedClient.email}</span>
                    <button type="button" onClick={() => { setSelectedClient(null); setClientSearch(""); }} className="text-[#555] hover:text-white text-xs">✕</button>
                  </div>
                ) : (
                  <>
                    <input value={clientSearch} onChange={e => searchClients(e.target.value)} placeholder="Search by name or email..."
                      className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]" />
                    {clientResults.length > 0 && (
                      <div className="absolute z-10 w-full bg-[#1a1a1a] border border-white/20 mt-1">
                        {clientResults.map(c => (
                          <button key={c.id} type="button" onClick={() => { setSelectedClient(c); setClientSearch(""); setClientResults([]); }}
                            className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors">
                            <p className="text-sm">{c.name || c.email}</p>
                            {c.name && <p className="text-xs text-[#555]">{c.email}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Photographers */}
              {photographers.length > 0 && (
                <div>
                  <p className="text-xs text-[#555] tracking-[2px] uppercase mb-2">Photographer(s)</p>
                  <div className="flex flex-wrap gap-2">
                    {photographers.map(p => (
                      <button key={p.id} type="button" onClick={() => togglePhotographer(p.id)}
                        className={`text-xs px-3 py-1.5 border transition-colors ${selectedPhotographers.includes(p.id) ? "border-white/40 text-white bg-white/10" : "border-white/10 text-[#555] hover:text-white hover:border-white/20"}`}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
                rows={2}
                className="w-full bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333] resize-none" />

              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="px-8 py-3 bg-white text-black text-xs tracking-[2px] uppercase font-semibold hover:bg-[#ddd] transition-colors disabled:opacity-50">
                  {saving ? "Creating..." : "Create Shoot"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-6 py-3 border border-white/10 text-[#888] text-xs tracking-[2px] uppercase hover:text-white hover:border-white/30 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {loading ? <p className="text-xs text-[#555] italic">Loading...</p> : (
          <>
            {pending.length > 0 && (
              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  Pending — {pending.length}
                </p>
                <div className="space-y-2">{pending.map(s => <ShootCard key={s.id} shoot={s} />)}</div>
              </section>
            )}

            {scheduled.length > 0 && (
              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  Scheduled — {scheduled.length}
                </p>
                <div className="space-y-2">{scheduled.map(s => <ShootCard key={s.id} shoot={s} />)}</div>
              </section>
            )}

            {pending.length === 0 && scheduled.length === 0 && (
              <div className="text-center py-16">
                <p className="text-xs text-[#444] tracking-[3px] uppercase">No active shoots</p>
                <button onClick={() => setShowForm(true)} className="mt-4 text-xs tracking-[2px] uppercase px-6 py-3 border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-colors">
                  + New Shoot
                </button>
              </div>
            )}

            {completed.length > 0 && (
              <section>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                  Completed — {completed.length}
                </p>
                <div className="space-y-2">{completed.map(s => <ShootCard key={s.id} shoot={s} />)}</div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
