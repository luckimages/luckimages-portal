"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import PreviewBanner from "@/components/PreviewBanner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

type Shoot = {
  id: string; address: string; scheduled_at: string;
  services: string[]; status: string; notes: string;
  square_footage: number | null;
};
type Invoice = {
  id: string; amount_cents: number; paid: boolean;
  due_date: string; notes: string; shoot_id: string;
};

const SERVICES = ["Listing Photos", "Drone", "Matterport", "Video", "Twilight", "Virtual Staging", "Floorplans"];

const STAGES = [
  { key: "pending",   label: "Confirmed" },
  { key: "en_route",  label: "En Route" },
  { key: "on_site",   label: "On Site" },
  { key: "wrapping",  label: "Processing" },
  { key: "editing",   label: "Processing" },
  { key: "delivered", label: "Delivered" },
];

export default function ClientPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tab, setTab] = useState<"book" | "shoots" | "invoices" | "profile">("book");
  const [booking, setBooking] = useState({ address: "", date: "", time: "", services: [] as string[], notes: "", square_footage: "" });
  const [bookingStatus, setBookingStatus] = useState<"" | "success" | "error">("");
  const [loading, setLoading] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"" | "saving" | "success" | "error">("");
  const [passwordError, setPasswordError] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const fullName = data.user.user_metadata?.full_name || "";
      setUserName(fullName || data.user.email?.split("@")[0] || "");
      setUserEmail(data.user.email || "");
      const identities = data.user.identities ?? [];
      const hasEmailPassword = identities.some(i => i.provider === "email" && i.identity_data?.email_verified);
      const lastSignIn = data.user.last_sign_in_at ?? "";
      setHasPassword(data.user.user_metadata?.has_password === true || (!lastSignIn.includes("otp") && hasEmailPassword));
      const uid = data.user.id;
      const { data: contactRow } = await supabase.from("contacts").select("id").eq("user_id", uid).single();
      if (contactRow?.id) {
        setContactId(contactRow.id);
        setAvatarUrl(`${supabaseUrl}/storage/v1/object/public/avatars/${contactRow.id}?t=${Date.now()}`);
      }
      const created = new Date(data.user.created_at);
      const now = new Date();
      const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      setMemberSince(years > 0 ? `${years}y ${remMonths}m` : `${remMonths} month${remMonths !== 1 ? "s" : ""}`);
      const { data: contact } = await supabase.from("contacts").select("id").eq("user_id", uid).single();
      const cid = contact?.id;
      const [{ data: shootData }, { data: invData }] = await Promise.all([
        cid
          ? supabase.from("shoots").select("*").or(`client_id.eq.${uid},contact_id.eq.${cid}`).order("scheduled_at", { ascending: false })
          : supabase.from("shoots").select("*").eq("client_id", uid).order("scheduled_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("client_id", uid).order("created_at", { ascending: false }),
      ]);
      setShoots(shootData || []);
      setInvoices(invData || []);
    });
  }, [router]);

  function toggleService(s: string) {
    setBooking(b => ({ ...b, services: b.services.includes(s) ? b.services.filter(x => x !== s) : [...b.services, s] }));
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setBookingStatus("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const scheduledAt = new Date(`${booking.date}T${booking.time || "09:00"}`).toISOString();
    const { error } = await supabase.from("shoots").insert({
      client_id: user!.id, address: booking.address, scheduled_at: scheduledAt,
      services: booking.services, notes: booking.notes, status: "pending",
      square_footage: booking.square_footage ? parseInt(booking.square_footage) : null,
    });
    setLoading(false);
    if (error) { setBookingStatus("error"); return; }
    setBookingStatus("success");
    setBooking({ address: "", date: "", time: "", services: [], notes: "", square_footage: "" });
    const { data: contact2 } = await supabase.from("contacts").select("id").eq("user_id", user!.id).single();
    const cid2 = contact2?.id;
    const { data: shootData } = cid2
      ? await supabase.from("shoots").select("*").or(`client_id.eq.${user!.id},contact_id.eq.${cid2}`).order("scheduled_at", { ascending: false })
      : await supabase.from("shoots").select("*").eq("client_id", user!.id).order("scheduled_at", { ascending: false });
    setShoots(shootData || []);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords don't match."); return; }
    setPasswordStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPasswordStatus("error"); setPasswordError(error.message); }
    else { setPasswordStatus("success"); setHasPassword(true); setNewPassword(""); setConfirmPassword(""); }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append("file", e.target.files[0]);
    const res = await fetch("/api/portal/upload-avatar", { method: "POST", body: fd });
    if (res.ok && contactId) {
      setAvatarError(false);
      setAvatarUrl(`${supabaseUrl}/storage/v1/object/public/avatars/${contactId}?t=${Date.now()}`);
    }
    setUploadingAvatar(false);
    if (avatarFileRef.current) avatarFileRef.current.value = "";
  }

  function signOut() {
    const form = document.createElement("form");
    form.method = "post"; form.action = "/api/auth/signout";
    document.body.appendChild(form); form.submit();
  }

  const unpaidInvoices = invoices.filter(i => !i.paid);
  const inputCls = "bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm px-4 py-3 outline-none focus:border-white/50 transition-colors placeholder:text-white/30 w-full";
  const labelCls = "text-[10px] tracking-[3px] uppercase text-white/40";
  const tabCls = (t: string) => `text-xs tracking-[3px] uppercase px-6 py-3 transition-all border-b-2 ${tab === t ? "text-white border-white" : "text-white/40 border-transparent hover:text-white/70"}`;
  const cardCls = "bg-white/10 backdrop-blur-md border border-white/15 p-6";

  return (
    <main className="min-h-screen text-white flex flex-col relative">
      <img src="/hero-1.jpg" alt="" className="fixed inset-0 w-full h-full object-cover z-0" />
      <div className="fixed inset-0 bg-[#0c0c0c]/75 z-0" />

      <PreviewBanner role="realtor" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5 border-b border-white/10">
        <a href="/" className="text-sm font-black tracking-[3px] uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <button onClick={signOut} className="text-[10px] tracking-[3px] uppercase text-white/40 hover:text-white transition-colors">Sign Out</button>
      </header>

      <div className="relative z-10 flex-1 flex flex-col max-w-3xl mx-auto w-full px-6 md:px-10 py-16">

        {/* Welcome */}
        <div className="mb-12">
          <p className="text-[10px] tracking-[4px] uppercase text-white/40 mb-2">Welcome back</p>
          <h1 className="text-2xl font-bold tracking-tight">{userName}</h1>
        </div>

        {/* Big Book a Shoot CTA */}
        <button
          onClick={() => setTab("book")}
          className="w-full bg-white text-black text-sm tracking-[4px] uppercase font-bold py-5 hover:bg-white/90 transition-all mb-10"
        >
          + Book a Shoot
        </button>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-8 -mx-1">
          {([["shoots", "Shoot Log"], ["invoices", "Invoices"], ["profile", "Profile"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={tabCls(key)}>
              {label}
              {key === "invoices" && unpaidInvoices.length > 0 && (
                <span className="ml-2 bg-white text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unpaidInvoices.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* BOOK A SHOOT */}
        {tab === "book" && (
          <div>
            {bookingStatus === "success" ? (
              <div className={cardCls + " text-center"}>
                <p className="text-white/60 text-xs tracking-[2px] uppercase mb-2">Request Submitted</p>
                <p className="text-lg font-bold mb-6">We&apos;ll confirm your shoot shortly.</p>
                <button onClick={() => { setBookingStatus(""); setTab("shoots"); }} className="text-xs tracking-[3px] uppercase border border-white/20 px-6 py-3 hover:bg-white/10 transition-colors">
                  View Shoot Log
                </button>
              </div>
            ) : (
              <form onSubmit={submitBooking} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Property Address</label>
                  <input type="text" required placeholder="123 Main St, Austin TX 78701" value={booking.address} onChange={e => setBooking(b => ({ ...b, address: e.target.value }))} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Date</label>
                    <input type="date" required value={booking.date} onChange={e => setBooking(b => ({ ...b, date: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Time</label>
                    <input type="time" value={booking.time} onChange={e => setBooking(b => ({ ...b, time: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Square Footage <span className="text-white/20">(optional)</span></label>
                  <input type="number" placeholder="2400" min="0" value={booking.square_footage} onChange={e => setBooking(b => ({ ...b, square_footage: e.target.value }))} className={inputCls} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Services</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SERVICES.map(s => (
                      <button key={s} type="button" onClick={() => toggleService(s)}
                        className={`px-4 py-3 text-xs tracking-[1px] uppercase text-left border transition-all ${booking.services.includes(s) ? "border-white bg-white/10 text-white" : "border-white/15 text-white/40 hover:border-white/30 hover:text-white/70"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Notes <span className="text-white/20">(optional)</span></label>
                  <textarea placeholder="Gate code, access instructions, parking..." value={booking.notes} onChange={e => setBooking(b => ({ ...b, notes: e.target.value }))} className={inputCls + " resize-none h-24"} />
                </div>
                {bookingStatus === "error" && <p className="text-xs text-red-400">Something went wrong. Email ryan@luckimages.com.</p>}
                <button type="submit" disabled={loading || booking.services.length === 0 || !booking.address || !booking.date}
                  className="mt-2 bg-white text-black text-xs tracking-[3px] uppercase font-bold py-4 hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  {loading ? "Submitting..." : "Submit Request"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* SHOOT LOG */}
        {tab === "shoots" && (
          <div className="flex flex-col gap-4">
            {shoots.length === 0 ? (
              <div className={cardCls + " text-center"}>
                <p className="text-white/40 text-sm mb-4">No shoots yet.</p>
                <button onClick={() => setTab("book")} className="text-xs tracking-[3px] uppercase border border-white/20 px-6 py-3 hover:bg-white/10 transition-colors">Book Your First Shoot</button>
              </div>
            ) : shoots.map(s => {
              const activeIdx = Math.max(0, STAGES.findIndex(st => st.key === s.status));
              return (
                <div key={s.id} className={cardCls}>
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <p className="font-semibold mb-1">{s.address}</p>
                      <p className="text-xs text-white/40">{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "TBD"} · {s.services?.join(", ")}</p>
                    </div>
                    {s.status === "delivered" && (
                      <Link href={`/client/gallery/${s.id}`} className="text-xs tracking-[2px] uppercase text-white border border-white/20 px-4 py-2 hover:bg-white/10 transition-colors whitespace-nowrap">
                        View Media →
                      </Link>
                    )}
                  </div>
                  {/* Progress tracker */}
                  <div className="flex items-center">
                    {STAGES.map((stage, i) => {
                      const done = i < activeIdx;
                      const active = i === activeIdx;
                      const last = i === STAGES.length - 1;
                      return (
                        <div key={stage.key} className="flex items-center flex-1 min-w-0">
                          <div className="flex flex-col items-center flex-1 min-w-0">
                            <div className={`w-2.5 h-2.5 rounded-full border-2 mb-2 transition-all ${done || active ? "border-white bg-white" : "border-white/20"} ${active ? "ring-2 ring-white/20 ring-offset-2 ring-offset-transparent" : ""}`} />
                            <span className={`text-[8px] tracking-[0.5px] uppercase text-center leading-tight hidden sm:block ${active ? "text-white" : done ? "text-white/40" : "text-white/15"}`}>{stage.label}</span>
                          </div>
                          {!last && <div className={`h-px flex-1 mx-1 mb-5 ${done ? "bg-white/40" : "bg-white/10"}`} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* INVOICES */}
        {tab === "invoices" && (
          <div className="flex flex-col gap-4">
            {invoices.length === 0 ? (
              <div className={cardCls + " text-center"}>
                <p className="text-white/40 text-sm">No invoices yet.</p>
              </div>
            ) : invoices.map(inv => (
              <div key={inv.id} className={cardCls + " flex items-center justify-between"}>
                <div>
                  <p className="font-semibold mb-1">${(inv.amount_cents / 100).toLocaleString()}</p>
                  <p className="text-xs text-white/40">{inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString()}` : "No due date"}{inv.notes ? ` · ${inv.notes}` : ""}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-[10px] tracking-[2px] uppercase px-3 py-1 border ${inv.paid ? "border-green-400/30 text-green-400" : "border-yellow-400/30 text-yellow-400"}`}>
                    {inv.paid ? "Paid" : "Due"}
                  </span>
                  {!inv.paid && <button className="text-xs tracking-[2px] uppercase text-white border border-white/20 px-4 py-2 hover:bg-white/10 transition-colors">Pay →</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PROFILE */}
        {tab === "profile" && (
          <div className="flex flex-col gap-6">
            {/* Avatar */}
            <div className={cardCls + " flex items-center gap-5"}>
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center text-xl font-bold">
                  {!avatarError && avatarUrl
                    ? <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
                    : <span>{userName.charAt(0).toUpperCase()}</span>}
                </div>
                {contactId && (
                  <button onClick={() => avatarFileRef.current?.click()} disabled={uploadingAvatar}
                    className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-white/20 border border-white/30 flex items-center justify-center hover:bg-white/30 transition-colors disabled:opacity-40">
                    <span className="text-[10px]">📷</span>
                  </button>
                )}
                <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              </div>
              <div>
                <p className="font-semibold">{userName}</p>
                <p className="text-xs text-white/40">{userEmail}</p>
                <p className="text-xs text-white/30 mt-1">Client for {memberSince}</p>
              </div>
            </div>

            {/* Set / change password */}
            {(!hasPassword || passwordStatus !== "success") && (
              <div className={cardCls}>
                <p className="text-[10px] tracking-[3px] uppercase text-white/40 mb-4">{hasPassword ? "Change Password" : "Set a Password"}</p>
                {passwordStatus === "success" ? (
                  <p className="text-sm text-green-400">Password saved.</p>
                ) : (
                  <form onSubmit={savePassword} className="flex flex-col gap-3">
                    <input type="password" placeholder="New password (8+ chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} />
                    <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} />
                    {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                    <button type="submit" disabled={passwordStatus === "saving"} className="bg-white text-black text-xs tracking-[3px] uppercase font-bold py-3 hover:bg-white/90 transition-all disabled:opacity-40">
                      {passwordStatus === "saving" ? "Saving..." : "Save Password"}
                    </button>
                  </form>
                )}
              </div>
            )}

            <button onClick={signOut} className="text-xs tracking-[3px] uppercase text-white/30 hover:text-white transition-colors text-left">
              Sign Out →
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
