"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import PreviewBanner from "@/components/PreviewBanner";

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
  const [userId, setUserId] = useState("");
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [payStubs, setPayStubs] = useState<PayStub[]>([]);
  const [tab, setTab] = useState<"schedule" | "upload" | "pay">("schedule");
  const [selectedShoot, setSelectedShoot] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const uid = data.user.id;
      setUserId(uid);
      setUserName((data.user.user_metadata?.full_name || data.user.email || "").toUpperCase());
      const [{ data: shootData }, { data: payData }] = await Promise.all([
        supabase.from("shoots").select("*").eq("photographer_id", uid).order("scheduled_at", { ascending: true }),
        supabase.from("pay_stubs").select("*, shoots(address, scheduled_at)").eq("photographer_id", uid).order("created_at", { ascending: false }),
      ]);
      setShoots(shootData || []);
      setPayStubs(payData || []);
    });
  }, [router]);

  async function uploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length || !selectedShoot) return;
    setUploading(true); setUploadStatus("");
    const supabase = createClient();
    const files = Array.from(e.target.files);
    let errors = 0;
    await Promise.all(files.map(async (file) => {
      const path = `${selectedShoot}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("shoot-media").upload(path, file);
      if (uploadError) { errors++; return; }
      await supabase.from("media").insert({
        shoot_id: selectedShoot,
        uploaded_by: userId,
        file_path: path,
        file_name: file.name,
        file_type: file.type,
      });
    }));
    setUploading(false);
    setUploadStatus(errors === 0 ? `success:${files.length}` : `error:${errors}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  const upcoming = shoots.filter(s => s.status !== "completed" && s.status !== "cancelled" && new Date(s.scheduled_at) >= new Date());
  const past = shoots.filter(s => s.status === "completed" || new Date(s.scheduled_at) < new Date());
  const totalPaid = payStubs.filter(p => p.paid).reduce((s, p) => s + p.amount_cents, 0);
  const totalPending = payStubs.filter(p => !p.paid).reduce((s, p) => s + p.amount_cents, 0);

  const tabCls = (t: string) => `text-xs tracking-[2px] uppercase px-4 py-2 transition-colors cursor-pointer ${tab === t ? "text-white border-b border-white" : "text-[#555] hover:text-white"}`;
  const inputCls = "bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 transition-colors w-full";

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      <PreviewBanner role="photographer" />
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <div className="flex items-center gap-6">
          <span className="text-xs tracking-[2px] uppercase text-[#666]">Photographer</span>
          <button onClick={signOut} className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
        </div>
      </header>

      <div className="flex-1 px-8 py-10 max-w-5xl mx-auto w-full">

        <div className="mb-8">
          <p className="text-xs tracking-[4px] uppercase text-[#666] mb-1">Welcome back</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">{userName}</h1>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-[#111] border border-white/10 p-6 border-b-2 border-b-[#60a5fa]">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Upcoming Shoots</p>
            <p className="text-3xl font-bold">{upcoming.length}</p>
          </div>
          <div className="bg-[#111] border border-white/10 p-6 border-b-2 border-b-[#fbbf24]">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Pending Pay</p>
            <p className="text-3xl font-bold">${(totalPending / 100).toLocaleString()}</p>
          </div>
          <div className="bg-[#111] border border-white/10 p-6 border-b-2 border-b-[#4ade80]">
            <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Total Earned YTD</p>
            <p className="text-3xl font-bold">${(totalPaid / 100).toLocaleString()}</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-white/10 mb-8 gap-1">
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
                  {upcoming.map(s => (
                    <div key={s.id} className="bg-[#111] border border-white/10 p-5">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium">{s.address}</p>
                        <span className="text-xs tracking-[1px] uppercase px-2 py-1 bg-[#60a5fa18] text-[#60a5fa]">{s.status}</span>
                      </div>
                      <p className="text-xs text-[#555] mb-1">{new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at {new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                      <p className="text-xs text-[#666]">{s.services?.join(" · ")}</p>
                      {s.notes && <p className="text-xs text-[#444] mt-2 italic">"{s.notes}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {past.length > 0 && (
              <div>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Past Shoots</p>
                <div className="bg-[#111] border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
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
              <div className="bg-[#111] border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
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
