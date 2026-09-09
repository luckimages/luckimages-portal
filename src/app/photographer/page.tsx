"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import PreviewBanner from "@/components/PreviewBanner";
import ShootGallery from "@/components/ShootGallery";
import ShootLocationMap from "@/components/ShootLocationMap";
import AddressMapPicker from "@/components/AddressMapPicker";

const r2PublicBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;

type Shoot = {
  id: string; address: string; scheduled_at: string;
  services: string[]; status: string; notes: string;
  lat?: number | null; lng?: number | null;
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
  const [tab, setTab] = useState<"schedule" | "upload" | "pay" | "profile">("schedule");
  const [pForm, setPForm] = useState({ phone: "", home_address: "", home_lat: null as number | null, home_lng: null as number | null, car_year: "", car_make: "", car_model: "", car_mpg: "" });
  const [pSaving, setPSaving] = useState(false);
  const [pSaved, setPSaved] = useState(false);
  const [selectedShoot, setSelectedShoot] = useState<string>("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
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
      const { data: contactRow } = await supabase.from("contacts").select("id").eq("user_id", uid).single();
      if (contactRow?.id) {
        setContactId(contactRow.id);
        setAvatarUrl(`${r2PublicBaseUrl}/avatars/${contactRow.id}?t=${Date.now()}`);
      }
      const [{ data: shootData }, { data: payData }] = await Promise.all([
        supabase.from("shoots").select("*").contains("photographer_ids", [uid]).order("scheduled_at", { ascending: true }),
        supabase.from("pay_stubs").select("*, shoots(address, scheduled_at)").eq("photographer_id", uid).order("created_at", { ascending: false }),
      ]);
      setShoots(shootData || []);
      setPayStubs(payData || []);

      fetch("/api/portal/photographer-profile").then(r => r.ok ? r.json() : { profile: {} }).then(({ profile: p }) => {
        setPForm({
          phone: p.phone || "",
          home_address: p.home_address || "",
          home_lat: p.home_lat ?? null,
          home_lng: p.home_lng ?? null,
          car_year: p.car_year != null ? String(p.car_year) : "",
          car_make: p.car_make || "",
          car_model: p.car_model || "",
          car_mpg: p.car_mpg != null ? String(p.car_mpg) : "",
        });
      }).catch(() => {});
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

  // Straight to R2 from the browser via a presigned URL — real estate/drone
  // originals routinely exceed Vercel's ~4.5MB serverless request-body
  // limit, which used to silently fail every file that size.
  async function uploadOneFile(file: File, shootId: string): Promise<boolean> {
    const urlRes = await fetch("/api/photographer/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shoot_id: shootId, file_name: file.name, file_type: file.type || "application/octet-stream" }),
    });
    if (!urlRes.ok) return false;
    const { uploadUrl, filePath } = await urlRes.json();

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putRes.ok) return false;

    const res = await fetch("/api/photographer/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shoot_id: shootId, file_path: filePath, file_name: file.name, file_type: file.type || "application/octet-stream" }),
    });
    return res.ok;
  }

  async function uploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length || !selectedShoot) return;
    setUploading(true); setUploadStatus("");
    const files = Array.from(e.target.files);
    let errors = 0;
    // Upload sequentially to avoid overwhelming the server watermarking process
    for (const file of files) {
      if (!(await uploadOneFile(file, selectedShoot))) errors++;
    }
    setUploading(false);
    setUploadStatus(errors === 0 ? `success:${files.length}` : `error:${errors}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  const SHOOT_STAGES = [
    { key: "scheduled", label: "Scheduled" },
    { key: "en_route",  label: "En Route" },
    { key: "on_site",   label: "On Site" },
    { key: "wrapping",  label: "Wrapped Up" },
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

  async function confirmDelivery(shootId: string) {
    setAdvancingId(shootId);
    await fetch("/api/photographer/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shootId, status: "delivered" }),
    });
    setShoots(prev => prev.map(s => s.id === shootId ? { ...s, status: "delivered" } : s));
    setAdvancingId(null);
  }

  async function uploadCardFiles(e: React.ChangeEvent<HTMLInputElement>, shootId: string) {
    if (!e.target.files?.length) return;
    setCardUploading(true);
    const files = Array.from(e.target.files);
    let ok = 0;
    for (const file of files) {
      if (await uploadOneFile(file, shootId)) ok++;
    }
    setCardUploading(false);
    setCardUploadCount(prev => ({ ...prev, [shootId]: (prev[shootId] || 0) + ok }));
    if (cardFileRef.current) cardFileRef.current.value = "";
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append("file", e.target.files[0]);
    const res = await fetch("/api/portal/upload-avatar", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setAvatarError(false);
      setAvatarUrl(`${url}?t=${Date.now()}`);
    }
    setUploadingAvatar(false);
    if (avatarFileRef.current) avatarFileRef.current.value = "";
  }

  async function savePhotographerProfile(e: React.FormEvent) {
    e.preventDefault();
    setPSaving(true); setPSaved(false);
    const res = await fetch("/api/portal/photographer-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: pForm.phone,
        home_address: pForm.home_address,
        home_lat: pForm.home_lat,
        home_lng: pForm.home_lng,
        car_year: pForm.car_year,
        car_make: pForm.car_make,
        car_model: pForm.car_model,
        car_mpg: pForm.car_mpg,
      }),
    });
    setPSaving(false);
    if (res.ok) { setPSaved(true); setTimeout(() => setPSaved(false), 2500); }
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

        <div className="mb-8 flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center text-xl font-bold">
              {!avatarError && avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
              ) : (
                <span>{userName.charAt(0)}</span>
              )}
            </div>
            {contactId && (
              <button
                onClick={() => avatarFileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#222] border border-white/20 flex items-center justify-center hover:bg-[#333] transition-colors disabled:opacity-40"
              >
                <span className="text-[10px]">📷</span>
              </button>
            )}
            <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#666] mb-1">Welcome back</p>
            <h1 className="text-3xl font-black tracking-tight uppercase">{userName}</h1>
          </div>
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
          {(["schedule", "upload", "pay", "profile"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={tabCls(t)}>
              {t === "schedule" ? "My Schedule" : t === "upload" ? "Upload Media" : t === "pay" ? "Pay Stubs" : "Profile"}
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
                        <div className="flex items-start justify-between mb-2 gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{s.address}</p>
                            <div className="mt-1"><ShootLocationMap lat={s.lat} lng={s.lng} address={s.address} /></div>
                          </div>
                          <span className="text-xs tracking-[1px] uppercase px-2 py-1 shrink-0" style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>{s.status.replace("_", " ")}</span>
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
                        {/* Wrapped Up / Editing: gallery with upload + confirm delivery */}
                        {(s.status === "wrapping" || s.status === "editing") ? (
                          <div className="flex flex-col gap-3">
                            <div className="border-t border-white/10 pt-4 mt-1">
                              <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-1">Processing Media</p>
                              <p className="text-[10px] text-[#444] mb-3">Upload your files below, then confirm delivery when ready.</p>
                              <ShootGallery
                                shootId={s.id}
                                services={s.services || []}
                                onMediaChange={count => setCardUploadCount(prev => ({ ...prev, [s.id]: count }))}
                                onDeliver={() => confirmDelivery(s.id)}
                              />
                            </div>
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
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-6 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Upload Media</p>
            <div className="flex flex-col gap-2 max-w-sm mb-8">
              <label className="text-xs tracking-[2px] uppercase text-[#666]">Select Shoot</label>
              <select value={selectedShoot} onChange={e => setSelectedShoot(e.target.value)} className={inputCls + " cursor-pointer"}>
                <option value="">Choose a shoot...</option>
                {shoots.map(s => (
                  <option key={s.id} value={s.id}>{s.address} — {new Date(s.scheduled_at).toLocaleDateString()}</option>
                ))}
              </select>
            </div>

            {selectedShoot ? (() => {
              const shoot = shoots.find(s => s.id === selectedShoot);
              const canConfirm = shoot && (shoot.status === "wrapping" || shoot.status === "editing");
              return (
                <div className="flex flex-col gap-3">
                  <ShootGallery
                    key={selectedShoot}
                    shootId={selectedShoot}
                    services={shoot?.services || []}
                    onMediaChange={count => setCardUploadCount(prev => ({ ...prev, [selectedShoot]: count }))}
                    onDeliver={canConfirm ? () => confirmDelivery(selectedShoot) : undefined}
                  />
                  {shoot?.status === "delivered" && (
                    <div className="text-center py-2">
                      <span className="text-xs tracking-[2px] uppercase text-[#4ade80]">✓ Delivered</span>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="bg-[#111] border border-white/10 p-10 text-center">
                <p className="text-[#555] text-sm">Select a shoot above to view and upload media.</p>
              </div>
            )}
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

        {tab === "profile" && (
          <div className="max-w-lg">
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-2 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Profile</p>
            <p className="text-xs text-[#666] mb-6">Your home base and vehicle are used to calculate the miles you drive to each shoot — for your mileage tax records and job costing.</p>
            <form onSubmit={savePhotographerProfile} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs tracking-[2px] uppercase text-[#666]">Phone</label>
                <input value={pForm.phone} onChange={e => setPForm(f => ({ ...f, phone: e.target.value }))} placeholder="(512) 555-0100" className={inputCls} />
              </div>

              <AddressMapPicker
                address={pForm.home_address}
                onAddressChange={a => setPForm(f => ({ ...f, home_address: a }))}
                lat={pForm.home_lat}
                lng={pForm.home_lng}
                onLocationChange={(lat, lng) => setPForm(f => ({ ...f, home_lat: lat, home_lng: lng }))}
                inputCls={inputCls}
                labelCls="text-xs tracking-[2px] uppercase text-[#666]"
              />
              <p className="text-[10px] text-[#555] -mt-2">Drop the pin on your home / where you start your day. Drive distance is measured from here.</p>

              <div>
                <label className="text-xs tracking-[2px] uppercase text-[#666] mb-2 block">Vehicle</label>
                <div className="grid grid-cols-3 gap-2">
                  <input value={pForm.car_year} onChange={e => setPForm(f => ({ ...f, car_year: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) }))} placeholder="Year" inputMode="numeric" className={inputCls} />
                  <input value={pForm.car_make} onChange={e => setPForm(f => ({ ...f, car_make: e.target.value }))} placeholder="Make" className={inputCls} />
                  <input value={pForm.car_model} onChange={e => setPForm(f => ({ ...f, car_model: e.target.value }))} placeholder="Model" className={inputCls} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs tracking-[2px] uppercase text-[#666]">Combined MPG</label>
                <input value={pForm.car_mpg} onChange={e => setPForm(f => ({ ...f, car_mpg: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder="e.g. 28" inputMode="decimal" className={inputCls} />
                <p className="text-[10px] text-[#555]">Your car&apos;s EPA combined mpg (check fueleconomy.gov if unsure). Used with the current gas price to estimate fuel cost per shoot.</p>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <button type="submit" disabled={pSaving} className="text-xs tracking-[3px] uppercase bg-white text-black font-semibold py-3 px-8 hover:bg-white/90 transition-colors disabled:opacity-50">
                  {pSaving ? "Saving..." : "Save"}
                </button>
                {pSaved && <span className="text-xs text-[#4ade80]">Saved ✓</span>}
              </div>
            </form>
          </div>
        )}

      </div>
    </main>
  );
}
