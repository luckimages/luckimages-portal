"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import PreviewBanner from "@/components/PreviewBanner";
import HomeNav from "@/components/HomeNav";

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

export default function ClientPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tab, setTab] = useState<"overview" | "book" | "invoices" | "gallery" | "profile" | "review" | "refer">("overview");
  const [referral, setReferral] = useState({ name: "", email: "" });
  const [referralStatus, setReferralStatus] = useState<"" | "sending" | "sent" | "error">("");
  const [profile, setProfile] = useState({ name: "", phone: "", brokerage: "" });
  const [profileStatus, setProfileStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [booking, setBooking] = useState({ address: "", date: "", time: "", services: [] as string[], notes: "", square_footage: "" });
  const [bookingStatus, setBookingStatus] = useState("");
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

  const SERVICES = ["Listing Photos", "Drone", "Matterport", "Video", "Headshots"];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUserName((data.user.user_metadata?.full_name || data.user.email || "").toUpperCase());
      // Detect if user signed in via magic link (no password set yet)
      const identities = data.user.identities ?? [];
      const hasEmailPassword = identities.some(i => i.provider === "email" && i.identity_data?.email_verified);
      const lastSignIn = data.user.last_sign_in_at ?? "";
      // If they have no password, their only identity will be via OTP/magic link
      setHasPassword(data.user.user_metadata?.has_password === true || (!lastSignIn.includes("otp") && hasEmailPassword));
      const uid = data.user.id;
      const { data: contactRow } = await supabase.from("contacts").select("id, name, phone, brokerage").eq("user_id", uid).single();
      if (contactRow?.id) {
        setContactId(contactRow.id);
        setAvatarUrl(`${supabaseUrl}/storage/v1/object/public/avatars/${contactRow.id}?t=${Date.now()}`);
        setProfile({ name: contactRow.name || "", phone: contactRow.phone || "", brokerage: contactRow.brokerage || "" });
      }
      const created = new Date(data.user.created_at);
      const now = new Date();
      const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      setMemberSince(years > 0 ? `${years}y ${remMonths}m` : `${remMonths} month${remMonths !== 1 ? "s" : ""}`);
      // Find contact linked to this user (for shoots booked by admin with contact_id)
      const { data: contact } = await supabase.from("contacts").select("id").eq("user_id", uid).single();
      const contactId = contact?.id;
      const [{ data: shootData }, { data: invData }] = await Promise.all([
        contactId
          ? supabase.from("shoots").select("*").or(`client_id.eq.${uid},contact_id.eq.${contactId}`).order("scheduled_at", { ascending: false })
          : supabase.from("shoots").select("*").eq("client_id", uid).order("scheduled_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("client_id", uid).order("created_at", { ascending: false }),
      ]);
      setShoots(shootData || []);
      setInvoices(invData || []);
    });
  }, [router]);

  function toggleService(s: string) {
    setBooking(b => ({
      ...b,
      services: b.services.includes(s) ? b.services.filter(x => x !== s) : [...b.services, s]
    }));
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setBookingStatus("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const scheduledAt = new Date(`${booking.date}T${booking.time || "09:00"}`).toISOString();
    const { error } = await supabase.from("shoots").insert({
      client_id: user!.id,
      address: booking.address,
      scheduled_at: scheduledAt,
      services: booking.services,
      notes: booking.notes,
      status: "pending",
      square_footage: booking.square_footage ? parseInt(booking.square_footage) : null,
    });
    setLoading(false);
    if (error) { setBookingStatus("Error: " + error.message); return; }
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
    if (error) {
      setPasswordStatus("error");
      setPasswordError(error.message);
    } else {
      setPasswordStatus("success");
      setHasPassword(true);
      setNewPassword("");
      setConfirmPassword("");
    }
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

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) return;
    setProfileStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.from("contacts").update({
      name: profile.name,
      phone: profile.phone || null,
      brokerage: profile.brokerage || null,
    }).eq("id", contactId);
    setProfileStatus(error ? "error" : "saved");
    if (!error) setUserName(profile.name.toUpperCase());
    setTimeout(() => setProfileStatus(""), 3000);
  }

  function signOut() {
    const form = document.createElement("form");
    form.method = "post"; form.action = "/api/auth/signout";
    document.body.appendChild(form); form.submit();
  }

  const unpaidInvoices = invoices.filter(i => !i.paid);
  const totalOwed = unpaidInvoices.reduce((s, i) => s + i.amount_cents, 0);
  const upcomingShoots = shoots.filter(s => s.status !== "cancelled");
  const totalSqFt = shoots.reduce((s, sh) => s + (sh.square_footage || 0), 0);

  const inputCls = "bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 transition-colors placeholder:text-[#444] w-full";
  const labelCls = "text-xs tracking-[2px] uppercase text-[#666]";
  const tabCls = (t: string) => `text-xs tracking-[2px] uppercase px-4 py-2 transition-colors cursor-pointer ${tab === t ? "text-white border-b border-white" : "text-[#555] hover:text-white"}`;

  return (
    <main className="min-h-screen text-white flex flex-col relative">
      <img src="/hero-1.jpg" alt="" className="fixed inset-0 w-full h-full object-cover z-0" />
      <div className="fixed inset-0 bg-[#0c0c0c]/80 z-0" />

      <PreviewBanner role="realtor" />
      <div className="relative z-10 h-20">
        <HomeNav />
      </div>

      <div className="relative z-10 flex-1 px-4 md:px-8 pt-10 pb-10 max-w-5xl mx-auto w-full">

        {/* Set password prompt — shown to magic-link users who haven't set one yet */}
        {!hasPassword && passwordStatus !== "success" && (
          <div className="mb-6 bg-[#fbbf2408] border border-[#fbbf24]/20 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs tracking-[2px] uppercase text-[#fbbf24] mb-1">Set a Password</p>
                <p className="text-xs text-[#666] mb-4">You signed in with a magic link. Set a password so you can log in directly next time.</p>
                <form onSubmit={savePassword} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="password"
                    placeholder="New password (8+ chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/40 transition-colors placeholder:text-[#444] flex-1"
                  />
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-2.5 outline-none focus:border-white/40 transition-colors placeholder:text-[#444] flex-1"
                  />
                  <button
                    type="submit"
                    disabled={passwordStatus === "saving"}
                    className="bg-[#fbbf24] text-black text-xs tracking-[2px] uppercase font-semibold px-6 py-2.5 hover:bg-[#fbbf24]/90 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {passwordStatus === "saving" ? "Saving..." : "Save Password"}
                  </button>
                </form>
                {passwordError && <p className="text-xs text-red-400 mt-2">{passwordError}</p>}
              </div>
              <button onClick={() => setHasPassword(true)} className="text-[#444] hover:text-white transition-colors text-lg leading-none flex-shrink-0">✕</button>
            </div>
          </div>
        )}

        {passwordStatus === "success" && (
          <div className="mb-6 bg-[#4ade8008] border border-[#4ade80]/20 p-4 flex items-center justify-between">
            <p className="text-xs text-[#4ade80] tracking-[1px]">✓ Password set — you can now log in with your email and password.</p>
            <button onClick={() => setPasswordStatus("")} className="text-[#444] hover:text-white transition-colors text-sm">✕</button>
          </div>
        )}

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

        {/* TABS */}
        <div className="flex border-b border-white/10 mb-8 gap-1 overflow-x-auto">
          {(["overview", "book", "invoices", "gallery", "refer", "review", "profile"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={tabCls(t)}>
              {t === "overview" ? "Overview" : t === "book" ? "Book a Shoot" : t === "invoices" ? "Invoices" : t === "gallery" ? "My Gallery" : t === "refer" ? "Refer a Friend" : t === "review" ? "Leave a Review" : "Profile"}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <div className="bg-[#111] border border-white/10 p-4 md:p-6 border-b-2 border-b-[#60a5fa]">
                <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Total Shoots</p>
                <p className="text-3xl font-bold">{shoots.length}</p>
              </div>
              <div className="bg-[#111] border border-white/10 p-4 md:p-6 border-b-2 border-b-[#fbbf24]">
                <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Sq Ft Captured</p>
                <p className="text-2xl md:text-3xl font-bold">{totalSqFt > 0 ? totalSqFt.toLocaleString() : "—"}</p>
              </div>
              <div className="bg-[#111] border border-white/10 p-4 md:p-6 border-b-2 border-b-[#4ade80]">
                <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Client For</p>
                <p className="text-3xl font-bold">{memberSince || "—"}</p>
              </div>
            </div>

            {/* ACTIVE SHOOT TRACKER */}
            {upcomingShoots.length > 0 && (
              <div>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Active Shoots</p>
                <div className="flex flex-col gap-4">
                  {upcomingShoots.map(s => {
                    const STAGES = [
                      { key: "pending",    label: "Confirmed" },
                      { key: "en_route",   label: "En Route" },
                      { key: "on_site",    label: "On Site" },
                      { key: "wrapping",   label: "Processing Media" },
                      { key: "editing",    label: "Processing Media" },
                      { key: "delivered",  label: "Delivered" },
                    ];
                    const currentIdx = STAGES.findIndex(st => st.key === s.status);
                    const activeIdx = currentIdx === -1 ? 0 : currentIdx;
                    const isDelivered = s.status === "delivered";

                    return (
                      <div key={s.id} className="bg-[#111] border border-white/10 p-6">
                        <div className="flex items-start justify-between mb-6">
                          <div>
                            <p className="font-semibold mb-1">{s.address}</p>
                            <p className="text-xs text-[#555]">{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "TBD"} · {s.services?.join(", ")}</p>
                          </div>
                          {isDelivered && (
                            <button onClick={() => setTab("gallery")} className="text-xs tracking-[2px] uppercase text-[#4ade80] border border-[#4ade80]/30 px-4 py-2 hover:bg-[#4ade80]/10 transition-colors">
                              View Media →
                            </button>
                          )}
                        </div>

                        {/* Tracker bar */}
                        <div className="flex items-center gap-0">
                          {STAGES.map((stage, i) => {
                            const done = i < activeIdx;
                            const active = i === activeIdx;
                            const last = i === STAGES.length - 1;
                            return (
                              <div key={stage.key} className="flex items-center flex-1 min-w-0">
                                <div className="flex flex-col items-center flex-1 min-w-0">
                                  <div className={`w-3 h-3 rounded-full border-2 transition-all mb-2 ${done || active ? "border-white bg-white" : "border-white/20 bg-transparent"} ${active ? "ring-2 ring-white/20 ring-offset-2 ring-offset-[#111]" : ""}`} />
                                  <span className={`text-[9px] tracking-[1px] uppercase text-center leading-tight ${active ? "text-white" : done ? "text-white/50" : "text-white/20"}`}>{stage.label}</span>
                                </div>
                                {!last && (
                                  <div className={`h-px flex-1 mx-1 mb-5 transition-all ${done ? "bg-white/50" : "bg-white/10"}`} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PAST SHOOTS */}
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Shoot History</p>
              {shoots.length === 0 ? (
                <div className="bg-[#111] border border-white/10 p-8 text-center">
                  <p className="text-[#555] text-sm mb-4">No shoots yet</p>
                  <button onClick={() => setTab("book")} className="text-xs tracking-[3px] uppercase text-white border border-white/20 px-6 py-3 hover:bg-white/5 transition-colors">Book Your First Shoot</button>
                </div>
              ) : (
                <div className="bg-[#111] border border-white/10 overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead><tr className="border-b border-white/10">{["Address", "Date", "Services", "Status"].map(h => <th key={h} className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">{h}</th>)}</tr></thead>
                    <tbody>
                      {shoots.slice(0, 5).map(s => (
                        <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3">{s.address}</td>
                          <td className="px-5 py-3 text-[#888]">{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString() : "—"}</td>
                          <td className="px-5 py-3 text-[#888] text-xs">{s.services?.join(", ")}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs tracking-[1px] uppercase px-2 py-1 ${s.status === "delivered" ? "bg-[#4ade8018] text-[#4ade80]" : s.status === "editing" ? "bg-[#a78bfa18] text-[#a78bfa]" : s.status === "on_site" || s.status === "en_route" || s.status === "wrapping" ? "bg-[#60a5fa18] text-[#60a5fa]" : "bg-[#fbbf2418] text-[#fbbf24]"}`}>{s.status.replace("_", " ")}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOOK A SHOOT */}
        {tab === "book" && (
          <div className="max-w-lg">
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-6 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Book a Shoot</p>
            {bookingStatus === "success" ? (
              <div className="bg-[#4ade8018] border border-[#4ade80]/20 p-6 text-center">
                <p className="text-[#4ade80] text-sm tracking-wide mb-4">Shoot request submitted! We'll confirm shortly.</p>
                <button onClick={() => { setBookingStatus(""); setTab("overview"); }} className="text-xs tracking-[3px] uppercase text-white border border-white/20 px-6 py-3 hover:bg-white/5 transition-colors">Back to Overview</button>
              </div>
            ) : (
              <form onSubmit={submitBooking} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Property Address</label>
                  <input type="text" required placeholder="123 Main St, Austin, TX 78701" value={booking.address} onChange={e => setBooking(b => ({ ...b, address: e.target.value }))} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Preferred Date</label>
                    <input type="date" required value={booking.date} onChange={e => setBooking(b => ({ ...b, date: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Preferred Time</label>
                    <input type="time" value={booking.time} onChange={e => setBooking(b => ({ ...b, time: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Square Footage <span className="text-[#444]">(optional)</span></label>
                  <input type="number" placeholder="2400" min="0" value={booking.square_footage} onChange={e => setBooking(b => ({ ...b, square_footage: e.target.value }))} className={inputCls} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Services Needed</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SERVICES.map(s => (
                      <label key={s} className="flex items-center gap-3 bg-[#181818] border border-white/10 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors">
                        <input type="checkbox" checked={booking.services.includes(s)} onChange={() => toggleService(s)} className="accent-white w-3 h-3" />
                        <span className="text-xs tracking-[1px] uppercase text-white">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Notes <span className="text-[#444]">(optional)</span></label>
                  <textarea placeholder="Gate code, special instructions, parking info..." value={booking.notes} onChange={e => setBooking(b => ({ ...b, notes: e.target.value }))} className={inputCls + " resize-none h-24"} />
                </div>
                {bookingStatus && <p className="text-xs text-red-400 border border-red-400/20 bg-red-400/5 px-4 py-3">{bookingStatus}</p>}
                <button type="submit" disabled={loading || booking.services.length === 0} className="mt-2 bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "Submitting..." : "Submit Booking Request"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* INVOICES */}
        {tab === "invoices" && (
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-6 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Your Invoices</p>
            {invoices.length === 0 ? (
              <div className="bg-[#111] border border-white/10 p-8 text-center">
                <p className="text-[#555] text-sm">No invoices yet</p>
              </div>
            ) : (
              <div className="bg-[#111] border border-white/10 overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead><tr className="border-b border-white/10">{["Date", "Amount", "Due", "Status", ""].map((h, i) => <th key={i} className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">{h}</th>)}</tr></thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 text-[#888]">{new Date(inv.due_date || "").toLocaleDateString()}</td>
                        <td className="px-5 py-3 font-medium">${(inv.amount_cents / 100).toLocaleString()}</td>
                        <td className="px-5 py-3 text-[#888]">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs tracking-[1px] uppercase px-2 py-1 ${inv.paid ? "bg-[#4ade8018] text-[#4ade80]" : "bg-[#fbbf2418] text-[#fbbf24]"}`}>{inv.paid ? "Paid" : "Due"}</span>
                        </td>
                        <td className="px-5 py-3">
                          {!inv.paid && <button className="text-xs tracking-[2px] uppercase text-[#60a5fa] hover:text-white transition-colors">Pay Now →</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* GALLERY */}
        {tab === "gallery" && (
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-6 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Shoot Media</p>
            {shoots.filter(s => s.status === "delivered" || s.status === "completed").length === 0 ? (
              <div className="bg-[#111] border border-white/10 p-8 text-center">
                <p className="text-[#555] text-sm">Media will appear here once your shoot photos are delivered.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {shoots.filter(s => s.status === "delivered" || s.status === "completed").map(s => (
                  <Link key={s.id} href={`/client/gallery/${s.id}`} className="bg-[#111] border border-white/10 p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div>
                      <p className="font-medium mb-1">{s.address}</p>
                      <p className="text-xs text-[#555]">{new Date(s.scheduled_at).toLocaleDateString()} · {s.services?.join(", ")}</p>
                    </div>
                    <span className="text-xs tracking-[2px] uppercase text-[#4ade80] hover:text-white">View & Download →</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REFER A FRIEND */}
        {tab === "refer" && (
          <div className="max-w-lg">
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-2 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Refer a Friend</p>
            <p className="text-sm text-[#666] mb-8">Know a realtor who could use great media? Send them our way — we&apos;ll take great care of them.</p>
            {referralStatus === "sent" ? (
              <div className="bg-[#4ade8018] border border-[#4ade80]/20 p-6 text-center">
                <p className="text-[#4ade80] text-sm mb-1">Referral sent!</p>
                <p className="text-xs text-[#555]">We&apos;ll reach out to them soon. Thank you!</p>
                <button onClick={() => { setReferralStatus(""); setReferral({ name: "", email: "" }); }} className="mt-4 text-xs tracking-[2px] uppercase text-white/40 hover:text-white transition-colors">Refer Another</button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setReferralStatus("sending");
                const res = await fetch("/api/portal/referral", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ referrerName: userName, referrerEmail: "", friendName: referral.name, friendEmail: referral.email }),
                });
                setReferralStatus(res.ok ? "sent" : "error");
              }} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Their Name</label>
                  <input required value={referral.name} onChange={e => setReferral(r => ({ ...r, name: e.target.value }))} placeholder="Jane Smith" className={inputCls} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Their Email</label>
                  <input required type="email" value={referral.email} onChange={e => setReferral(r => ({ ...r, email: e.target.value }))} placeholder="jane@brokerage.com" className={inputCls} />
                </div>
                {referralStatus === "error" && <p className="text-xs text-red-400">Something went wrong. Try again or email ryan@luckimages.com.</p>}
                <button type="submit" disabled={referralStatus === "sending"} className="bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50">
                  {referralStatus === "sending" ? "Sending..." : "Submit Referral"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* LEAVE A REVIEW */}
        {tab === "review" && (
          <div className="max-w-lg">
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-2 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Leave a Review</p>
            <p className="text-sm text-[#666] mb-10">Enjoyed working with us? A Google review means the world and helps other realtors find us.</p>
            <a
              href="https://g.page/r/CZ9cShOb3iPUEBI/review"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-5 hover:bg-white/90 transition-colors"
            >
              ★ Leave a Google Review
            </a>
          </div>
        )}

        {/* PROFILE */}
        {tab === "profile" && (
          <div className="max-w-lg space-y-8">

            {/* Avatar */}
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Photo</p>
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center text-2xl font-bold">
                    {!avatarError && avatarUrl
                      ? <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
                      : <span>{userName.charAt(0)}</span>}
                  </div>
                  {contactId && (
                    <button onClick={() => avatarFileRef.current?.click()} disabled={uploadingAvatar}
                      className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#222] border border-white/20 flex items-center justify-center hover:bg-[#333] transition-colors disabled:opacity-40">
                      <span className="text-[11px]">📷</span>
                    </button>
                  )}
                  <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
                </div>
                <div>
                  <p className="text-sm font-medium">{userName}</p>
                  <button onClick={() => avatarFileRef.current?.click()} disabled={uploadingAvatar}
                    className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors mt-1">
                    {uploadingAvatar ? "Uploading..." : "Change Photo"}
                  </button>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Personal Info</p>
              <form onSubmit={saveProfile} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Full Name</label>
                  <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" className={inputCls} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Phone</label>
                  <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="(512) 555-0100" className={inputCls} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Brokerage</label>
                  <input value={profile.brokerage} onChange={e => setProfile(p => ({ ...p, brokerage: e.target.value }))} placeholder="Keller Williams" className={inputCls} />
                </div>
                <button type="submit" disabled={profileStatus === "saving"}
                  className="bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50">
                  {profileStatus === "saving" ? "Saving..." : profileStatus === "saved" ? "Saved ✓" : profileStatus === "error" ? "Error — try again" : "Save Changes"}
                </button>
              </form>
            </div>

            {/* Password */}
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
                {hasPassword ? "Change Password" : "Set a Password"}
              </p>
              {passwordStatus === "success" ? (
                <p className="text-xs text-[#4ade80]">Password saved successfully.</p>
              ) : (
                <form onSubmit={savePassword} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>New Password</label>
                    <input type="password" placeholder="8+ characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Confirm Password</label>
                    <input type="password" placeholder="Confirm" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} />
                  </div>
                  {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                  <button type="submit" disabled={passwordStatus === "saving"}
                    className="bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50">
                    {passwordStatus === "saving" ? "Saving..." : "Save Password"}
                  </button>
                </form>
              )}
            </div>

            {/* Sign out */}
            <button onClick={signOut} className="text-xs tracking-[3px] uppercase text-[#555] hover:text-white transition-colors">
              Sign Out →
            </button>

          </div>
        )}

      </div>
    </main>
  );
}
