"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import PreviewBanner from "@/components/PreviewBanner";
import ShootGallery from "@/components/ShootGallery";

type Shoot = {
  id: string; address: string; scheduled_at: string;
  services: string[]; status: string; notes: string;
};
type PayStub = {
  id: string; amount_cents: number; paid: boolean;
  paid_at: string; notes: string; shoot_id: string;
  shoots?: { address: string; scheduled_at: string };
};

export default function PhotographerPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [payStubs, setPayStubs] = useState<PayStub[]>([]);
  const [tab, setTab] = useState<"schedule" | "upload" | "pay">("schedule");
  const [selectedShoot, setSelectedShoot] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Inline upload state per tracker card
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);
  const [cardUploading, setCardUploading] = useState(false);
  const [cardUploadCount, setCardUploadCount] = useState<Record<string, number>>({}); // shootId → uploaded count
  const cardFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const uid = data.user.id;
      setUserId(uid);
      setUserEmail(data.user.email || "");
      setUserName((data.user.user_metadata?.full_name || data.user.email || "").toUpperCase());
      const [{ data: shootData }, { data: payData }] = await Promise.all([
        supabase.from("shoots").select("*").contains("photographer_ids", [uid]).order("scheduled_at", { ascending: true }),
        supabase.from("pay_stubs").select("*, shoots(address, scheduled_at)").eq("photographer_id", uid).order("created_at", { ascending: false }),
      ]);
      setShoots(shootData || []);
      setPayStubs(payData || []);
      // Load media counts for editing-stage shoots
      const editingShoots = (shootData || []).filter(s => s.status === "editing");
      if (editingShoots.length > 0) {
        const counts: Record<string, number> = {};
        await Promise.all(editingShoots.map(async s => {
          const { count } = await supabase.from("media").select("id", { count: "exact", head: true }).eq("shoot_id", s.id);
          counts[s.id] = count || 0;
        }));
        setCardUploadCount(counts);
      }
    });
  }, [router]);

  async function uploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length || !selectedShoot) return;
    setUploading(true); setUploadStatus("");
    const files = Array.from(e.target.files);
    let errors = 0;
    // Upload sequentially to avoid overwhelming the server watermarking process
    for (const file of files) {
      const formData = new FormData();
      formData.append("shoot_id", selectedShoot);
      formData.append("file", file);
      const res = await fetch("/api/photographer/upload", { method: "POST", body: formData });
      if (!res.ok) errors++;
    }
    setUploading(false);
    setUploadStatus(errors === 0 ? `success:${files.length}` : `error:${errors}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  const SHOOT_STAGES = [
    { key: "scheduled", label: "Scheduled" },
    { key: "en_route",  label: "En Route" },
    { key: "on_site",   label: "On Site" },
    { key: "wrapping",  label: "Wrapping Up" },
    { key: "editing",   label: "Editing" },
    { key: "delivered", label: "Delivered" },
  ];

  async function advanceStatus(shoot: Shoot) {
    const idx = SHOOT_STAGES.findIndex(s => s.key === shoot.status);
    if (idx === -1 || idx >= SHOOT_STAGES.length - 1) return;
    const nextStatus = SHOOT_STAGES[idx + 1].key;
    setAdvancingId(shoot.id);
    await fetch("/api/photographer/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shoot.id, status: nextStatus }),
    });
    setShoots(prev => prev.map(s => s.id === shoot.id ? { ...s, status: nextStatus } : s));
    setAdvancingId(null);
  }

  async function uploadCardFiles(e: React.ChangeEvent<HTMLInputElement>, shootId: string) {
    if (!e.target.files?.length) return;
    setCardUploading(true);
    const files = Array.from(e.target.files);
    let ok = 0;
    for (const file of files) {
      const fd = new FormData();
      fd.append("shoot_id", shootId);
      fd.append("file", file);
      const res = await fetch("/api/photographer/upload", { method: "POST", body: fd });
      if (res.ok) ok++;
    }
    setCardUploading(false);
    setCardUploadCount(prev => ({ ...prev, [shootId]: (prev[shootId] || 0) + ok }));
    if (cardFileRef.current) cardFileRef.current.value = "";
  }

  function signOut() {
    const form = document.createElement("form");
    form.method = "post"; form.action = "/api/auth/signout";
    document.body.appendChild(form); form.submit();
  }

  const upcoming = shoots.filter(s => s.status !== "delivered" && s.status !== "completed" && s.status !== "cancelled");
  const past = shoots.filter(s => s.status === "delivered" || s.status === "completed" || s.status === "cancelled");
  const totalPending = payStubs.filter(p => !p.paid).reduce((s, p) => s + p.amount_cents, 0);

  // Bi-weekly pay periods anchored to Jun 2 2026
  const PERIOD_START = new Date("2026-06-02");
  const now = new Date();
  const msPerPeriod = 14 * 24 * 60 * 60 * 1000;
  const elapsed = now.getTime() - PERIOD_START.getTime();
  const periodIndex = Math.floor(elapsed / msPerPeriod);
  const periodStart = new Date(PERIOD_START.getTime() + periodIndex * msPerPeriod);
  const periodEnd = new Date(periodStart.getTime() + msPerPeriod - 1);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const payPeriod = `${fmt(periodStart)} – ${fmt(periodEnd)}`;

  const tabCls = (t: string) => `text-xs tracking-[2px] uppercase px-4 py-2 transition-colors cursor-pointer ${tab === t ? "text-white border-b border-white" : "text-[#555] hover:text-white"}`;
  const inputCls = "bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 transition-colors w-full";

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      <PreviewBanner role="photographer" />
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10 gap-4">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <span className="text-xs tracking-[2px] uppercase text-[#666] hidden sm:inline">Photographer</span>
          {["ryan@luckimages.com", "leif@luckimages.com"].includes(userEmail) && (
            <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors hidden sm:inline">Admin</a>
          )}
          <button onClick={signOut} className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 py-8 md:py-10 max-w-5xl mx-auto w-full">

        <div className="mb-8">
          <p className="text-xs tracking-[4px] uppercase text-[#666] mb-1">Welcome back</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">{userName}</h1>
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-3 mb-8">
          <div className="bg-[#111] border border-white/10 p-4 md:p-6 border-b-2 border-b-[#60a5fa]">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Total Shoots</p>
            <p className="text-3xl font-bold">{shoots.length}</p>
          </div>
          <div className="bg-[#111] border border-white/10 p-4 md:p-6 border-b-2 border-b-[#fbbf24]">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Pay Period</p>
            <p className="text-base md:text-xl font-bold">{payPeriod}</p>
          </div>
          <div className="bg-[#111] border border-white/10 p-4 md:p-6 border-b-2 border-b-[#4ade80]">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Pending Pay</p>
            <p className="text-3xl font-bold">${(totalPending / 100).toLocaleString()}</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-white/10 mb-8 gap-1 overflow-x-auto">
          {(["schedule", "upload", "pay"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={tabCls(t)}>
              {t === "schedule" ? "My Schedule" : t === "upload" ? "Upload Media" : "Pay Stubs"}
            </button>
          ))}
        </div>

        {/* SCHEDULE */}
        {tab === "schedule" && (
          <div className="space-y-8">
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Upcoming</p>
              {upcoming.length === 0 ? (
                <div className="bg-[#111] border border-white/10 p-8 text-center"><p className="text-[#555] text-sm">No upcoming shoots assigned yet</p></div>
              ) : (
                <div className="flex flex-col gap-3">
                  {upcoming.map(s => {
                    const stageIdx = SHOOT_STAGES.findIndex(st => st.key === s.status);
                    const isLast = stageIdx === SHOOT_STAGES.length - 1;
                    const nextStage = !isLast && stageIdx !== -1 ? SHOOT_STAGES[stageIdx + 1] : null;
                    const statusColor = s.status === "delivered" ? "#4ade80" : s.status === "editing" ? "#a78bfa" : s.status === "on_site" || s.status === "wrapping" ? "#fbbf24" : "#60a5fa";
                    return (
                      <div key={s.id} className="bg-[#111] border border-white/10 p-5">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium">{s.address}</p>
                          <span className="text-xs tracking-[1px] uppercase px-2 py-1" style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>{s.status.replace("_", " ")}</span>
                        </div>
                        <p className="text-xs text-[#555] mb-1">{new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at {new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                        <p className="text-xs text-[#666] mb-3">{s.services?.join(" · ")}</p>
                        {s.notes && <p className="text-xs text-[#444] mb-3 italic">"{s.notes}"</p>}
                        {/* Stage tracker */}
                        <div className="flex items-center gap-0 mb-4">
                          {SHOOT_STAGES.map((stage, i) => {
                            const done = i < stageIdx || (stageIdx === -1 && false);
                            const active = i === stageIdx;
                            const last = i === SHOOT_STAGES.length - 1;
                            return (
                              <div key={stage.key} className="flex items-center flex-1 min-w-0">
                                <div className="flex flex-col items-center flex-1 min-w-0">
                                  <div className={`w-2 h-2 rounded-full border-2 transition-all mb-1.5 ${done || active ? "border-white bg-white" : "border-white/20 bg-transparent"} ${active ? "ring-2 ring-white/20 ring-offset-1 ring-offset-[#111]" : ""}`} />
                                  <span className={`text-[8px] tracking-[0.5px] uppercase text-center leading-tight ${active ? "text-white" : done ? "text-white/40" : "text-white/15"}`}>{stage.label}</span>
                                </div>
                                {!last && <div className={`h-px flex-1 mx-0.5 mb-4 transition-all ${done ? "bg-white/40" : "bg-white/10"}`} />}
                              </div>
                            );
                          })}
                        </div>
                        {/* For editing stage: gallery with upload + confirm delivery */}
                        {s.status === "editing" ? (
                          <div className="flex flex-col gap-3">
                            <div className="border-t border-white/10 pt-4 mt-1">
                              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-3">Media</p>
                              <ShootGallery
                                shootId={s.id}
                                onMediaChange={count => setCardUploadCount(prev => ({ ...prev, [s.id]: count }))}
                              />
                            </div>
                            {(cardUploadCount[s.id] || 0) > 0 && (
                              <button onClick={() => advanceStatus(s)} disabled={advancingId === s.id}
                                className="w-full text-xs tracking-[2px] uppercase bg-[#4ade80] text-black font-semibold py-2.5 hover:bg-[#4ade80]/90 transition-colors disabled:opacity-40">
                                {advancingId === s.id ? "Confirming..." : "Confirm Delivery ✓"}
                              </button>
                            )}
                          </div>
                        ) : nextStage ? (
                          <button
                            onClick={() => advanceStatus(s)}
                            disabled={advancingId === s.id}
                            className="w-full text-xs tracking-[2px] uppercase bg-white text-black font-semibold py-2.5 hover:bg-white/90 transition-colors disabled:opacity-40"
                          >
                            {advancingId === s.id ? "Updating..." : `Mark as ${nextStage.label} →`}
                          </button>
                        ) : isLast ? (
                          <div className="text-center py-2">
                            <span className="text-xs tracking-[2px] uppercase text-[#4ade80]">✓ Delivered</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {past.length > 0 && (
              <div>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Past Shoots</p>
                <div className="bg-[#111] border border-white/10 overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead><tr className="border-b border-white/10">{["Address", "Date", "Services"].map(h => <th key={h} className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">{h}</th>)}</tr></thead>
                    <tbody>
                      {past.map(s => (
                        <tr key={s.id} className="border-b border-white/5">
                          <td className="px-5 py-3">{s.address}</td>
                          <td className="px-5 py-3 text-[#888]">{new Date(s.scheduled_at).toLocaleDateString()}</td>
                          <td className="px-5 py-3 text-[#888] text-xs">{s.services?.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* UPLOAD MEDIA */}
        {tab === "upload" && (
          <div className="max-w-lg">
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-6 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Upload Media</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs tracking-[2px] uppercase text-[#666]">Select Shoot</label>
                <select value={selectedShoot} onChange={e => { setSelectedShoot(e.target.value); setUploadStatus(""); }} className={inputCls + " cursor-pointer"}>
                  <option value="">Choose a shoot...</option>
                  {shoots.map(s => (
                    <option key={s.id} value={s.id}>{s.address} — {new Date(s.scheduled_at).toLocaleDateString()}</option>
                  ))}
                </select>
              </div>

              {selectedShoot && (
                <div>
                  <label className="text-xs tracking-[2px] uppercase text-[#666] block mb-2">Photos / Videos</label>
                  <label className="flex flex-col items-center justify-center bg-[#111] border border-white/10 border-dashed p-12 cursor-pointer hover:bg-white/[0.02] transition-colors">
                    <span className="text-2xl mb-3">↑</span>
                    <span className="text-sm text-[#666] mb-1">Click to select files</span>
                    <span className="text-xs text-[#444]">JPG, PNG, MP4, DNG — any size</span>
                    <input ref={fileRef} type="file" multiple accept="image/*,video/*" onChange={uploadFiles} className="hidden" disabled={uploading} />
                  </label>
                </div>
              )}

              {uploading && (
                <div className="bg-[#111] border border-white/10 p-4 text-center">
                  <p className="text-xs text-[#666] tracking-[2px] uppercase">Uploading...</p>
                </div>
              )}

              {uploadStatus.startsWith("success") && (
                <div className="bg-[#4ade8018] border border-[#4ade80]/20 p-4 text-center">
                  <p className="text-[#4ade80] text-xs tracking-[1px]">{uploadStatus.split(":")[1]} file(s) uploaded successfully</p>
                </div>
              )}
              {uploadStatus.startsWith("error") && (
                <div className="bg-red-400/5 border border-red-400/20 p-4 text-center">
                  <p className="text-red-400 text-xs tracking-[1px]">{uploadStatus.split(":")[1]} file(s) failed to upload</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAY STUBS */}
        {tab === "pay" && (
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-6 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Pay Stubs</p>
            {payStubs.length === 0 ? (
              <div className="bg-[#111] border border-white/10 p-8 text-center">
                <p className="text-[#555] text-sm">No pay stubs yet</p>
              </div>
            ) : (
              <div className="bg-[#111] border border-white/10 overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead><tr className="border-b border-white/10">{["Shoot", "Date", "Amount", "Status", "Paid On"].map(h => <th key={h} className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">{h}</th>)}</tr></thead>
                  <tbody>
                    {payStubs.map(p => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">{p.shoots?.address || "—"}</td>
                        <td className="px-5 py-3 text-[#888]">{p.shoots?.scheduled_at ? new Date(p.shoots.scheduled_at).toLocaleDateString() : "—"}</td>
                        <td className="px-5 py-3 font-medium">${(p.amount_cents / 100).toLocaleString()}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs tracking-[1px] uppercase px-2 py-1 ${p.paid ? "bg-[#4ade8018] text-[#4ade80]" : "bg-[#fbbf2418] text-[#fbbf24]"}`}>{p.paid ? "Paid" : "Pending"}</span>
                        </td>
                        <td className="px-5 py-3 text-[#888]">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
