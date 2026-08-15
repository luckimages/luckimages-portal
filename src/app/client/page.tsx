"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import PreviewBanner from "@/components/PreviewBanner";
import HomeNav from "@/components/HomeNav";
import AddressMapPicker from "@/components/AddressMapPicker";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

type Shoot = {
  id: string; address: string; lat?: number | null; lng?: number | null; scheduled_at: string;
  services: string[]; status: string; notes: string;
  square_footage: number | null;
};
type Invoice = {
  id: string; amount_cents: number; paid: boolean;
  due_date: string; notes: string; shoot_id: string; created_at: string;
};

const PRIMARY_SERVICES = [
  { key: "Listing Photos", label: "Listing Photos", from: 200 },
  { key: "Video Walkthrough", label: "Video Walkthrough", from: 200 },
  { key: "Matterport 3D Tour", label: "Matterport 3D Tour", from: 200 },
  { key: "Twilight", label: "Twilight", from: 250 },
  { key: "Aerial Photos", label: "Aerial Photos", from: 200 },
  { key: "Headshots", label: "Headshots", from: 200 },
];
const ADDON_SERVICES = [
  { key: "Aerial Add-on", label: "+ Aerial Photos", from: 100 },
  { key: "Twilight Add-on", label: "+ Twilight", from: 150 },
  { key: "Floor Plan", label: "+ Floor Plan", from: 50 },
  { key: "Virtual Staging", label: "+ Virtual Staging", from: 25 },
];

function listingPhotosPrice(sqft: number) {
  if (sqft <= 1500) return 200;
  if (sqft <= 2000) return 250;
  if (sqft <= 2500) return 300;
  if (sqft <= 3000) return 350;
  return 400;
}
function matterportPrice(sqft: number) {
  if (sqft <= 2000) return 200;
  if (sqft <= 3000) return 300;
  if (sqft <= 4000) return 400;
  return 500;
}
function floorPlanPrice(sqft: number) { return sqft < 2500 ? 50 : 75; }

function calcQuote(services: string[], sqft: string): { low: number; exact: boolean } {
  const sf = parseInt(sqft) || 0;
  let total = 0;
  for (const s of services) {
    if (s === "Listing Photos") total += sf ? listingPhotosPrice(sf) : 200;
    else if (s === "Matterport 3D Tour") total += sf ? matterportPrice(sf) : 200;
    else if (s === "Floor Plan") total += sf ? floorPlanPrice(sf) : 50;
    else if (s === "Twilight") total += 250;
    else if (s === "Video Walkthrough") total += 200;
    else if (s === "Aerial Photos") total += 200;
    else if (s === "Headshots") total += 200;
    else if (s === "Aerial Add-on") total += 100;
    else if (s === "Twilight Add-on") total += 150;
    else if (s === "Virtual Staging") total += 25;
  }
  return { low: total, exact: !!sf };
}

// Property Access is folded into the notes column with an "ACCESS: " prefix
// (same convention the admin board's shoot editor uses) so it round-trips.
function parseNotes(raw: string | null): { access: string; notes: string } {
  const str = raw || "";
  const m = str.match(/^ACCESS: (.*?)(\n\n[\s\S]*)?$/);
  if (m) return { access: m[1] || "", notes: (m[2] || "").replace(/^\n\n/, "").trim() };
  return { access: "", notes: str };
}

const EDITABLE_STATUSES = ["pending", "scheduled"];

// Compact "6/18" style date — no year, no leading zeros — for the collapsed
// Shoot Log row. The expanded detail view still shows the full date/time.
function shortDate(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const STREET_SUFFIXES = new Set([
  "st", "street", "ave", "avenue", "blvd", "boulevard", "dr", "drive", "ln", "lane",
  "rd", "road", "way", "ct", "court", "pl", "place", "cir", "circle", "ter", "terrace",
  "pkwy", "parkway", "trl", "trail", "bend", "loop", "cv", "cove", "xing", "crossing",
  "pt", "point", "ridge", "holw", "hollow", "grv", "grove", "walk", "row", "sq", "square",
  "hwy", "highway", "path", "pass", "run", "cres", "crescent", "aly", "alley", "byp",
  "bypass", "ext", "extension", "frwy", "freeway", "grn", "green", "hbr", "harbor",
  "is", "island", "jct", "junction", "knl", "knoll", "mnr", "manor", "mdw", "meadow",
  "mt", "mount", "mtn", "mountain", "pike", "plz", "plaza", "rdg", "rte", "route",
  "shr", "shore", "spg", "spring", "sta", "station", "vly", "valley", "vw", "view",
  "vlg", "village", "wynd",
]);

// Nominatim addresses trail off into neighborhood/city/county/state/zip/country
// — for the compact row we only want up through the street itself, e.g.
// "5801, Magee Bend, Village at Western Oaks, Austin, TX..." → "5801 Magee Bend".
function truncateAddressToStreet(address: string): string {
  const segments = address.split(",").map(s => s.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const seg of segments) {
    kept.push(seg);
    const words = seg.split(/\s+/);
    const lastWord = (words[words.length - 1] || "").toLowerCase().replace(/[^a-z]/g, "");
    if (STREET_SUFFIXES.has(lastWord)) return kept.join(" ");
  }
  return address; // no recognized street suffix — leave it as-is
}

// Shared badge/quote coloring — yellow while pending, green once approved
// (status moves to "scheduled"), plus the existing in-progress/edit colors.
function statusVisual(status: string): { bg: string; text: string } {
  if (status === "delivered" || status === "completed" || status === "scheduled") {
    return { bg: "bg-[#4ade8018]", text: "text-[#4ade80]" };
  }
  if (status === "editing") return { bg: "bg-[#a78bfa18]", text: "text-[#a78bfa]" };
  if (status === "on_site" || status === "en_route" || status === "wrapping") {
    return { bg: "bg-[#60a5fa18]", text: "text-[#60a5fa]" };
  }
  return { bg: "bg-[#fbbf2418]", text: "text-[#fbbf24]" }; // pending
}

export default function ClientPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tab, setTab] = useState<"overview" | "book" | "gallery" | "invoices" | "profile">("overview");
  const [referral, setReferral] = useState({ name: "", email: "" });
  const [referralStatus, setReferralStatus] = useState<"" | "sending" | "sent" | "error">("");
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", brokerage: "", areas: "", birthday: "", mailingList: false, referralSource: "" });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileStatus, setProfileStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [booking, setBooking] = useState({ address: "", lat: null as number | null, lng: null as number | null, date: "", time: "", services: [] as string[], notes: "", access_instructions: "", square_footage: "" });
  const [bookingStatus, setBookingStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [expandedShootId, setExpandedShootId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"" | "saving" | "success" | "error">("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUserName((data.user.user_metadata?.full_name || data.user.email || "").toUpperCase());
      setHasPassword(data.user.user_metadata?.has_password === true);
      const uid = data.user.id;
      const { data: contactRow } = await supabase.from("contacts").select("id, name, email, phone, brokerage, lead_source").eq("user_id", uid).single();
      if (contactRow?.id) {
        setContactId(contactRow.id);
        setAvatarUrl(`${supabaseUrl}/storage/v1/object/public/avatars/${contactRow.id}?t=${Date.now()}`);
        const meta = data.user.user_metadata || {};
        setProfile({
          name: contactRow.name || "",
          email: contactRow.email || data.user.email || "",
          phone: contactRow.phone || meta.phone || "",
          brokerage: contactRow.brokerage || meta.brokerage || "",
          areas: meta.areas || "",
          birthday: meta.birthday || "",
          mailingList: meta.mailing_list || false,
          referralSource: contactRow.lead_source || meta.referral_source || "",
        });
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
          ? supabase.from("shoots").select("*").or(`client_id.eq.${uid},contact_id.eq.${contactId}`).neq("status", "cancelled").order("scheduled_at", { ascending: false })
          : supabase.from("shoots").select("*").eq("client_id", uid).neq("status", "cancelled").order("scheduled_at", { ascending: false }),
        contactId
          ? supabase.from("invoices").select("*").or(`client_id.eq.${uid},contact_id.eq.${contactId}`).order("created_at", { ascending: false })
          : supabase.from("invoices").select("*").eq("client_id", uid).order("created_at", { ascending: false }),
      ]);
      setShoots(shootData || []);
      setInvoices(invData || []);
    });
  }, [router]);

  const [justPaid, setJustPaid] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "invoices") setTab("invoices");
    if (params.get("paid") === "1") { setJustPaid(true); setTab("invoices"); }
    if (params.get("paid") || params.get("tab")) {
      window.history.replaceState({}, "", "/client");
    }
  }, []);

  function toggleService(s: string) {
    setBooking(b => ({ ...b, services: b.services.includes(s) ? b.services.filter(x => x !== s) : [...b.services, s] }));
  }

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState("");
  async function payInvoice(invoiceId: string) {
    setPayError(""); setPayingId(invoiceId);
    try {
      const res = await fetch("/api/portal/pay-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) { setPayError(data.error || "Could not start payment"); setPayingId(null); return; }
      window.location.href = data.url; // redirect to Stripe Checkout
    } catch {
      setPayError("Could not start payment"); setPayingId(null);
    }
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setBookingStatus("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const scheduledAt = new Date(`${booking.date}T${booking.time || "09:00"}`).toISOString();
    const res = await fetch("/api/portal/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: booking.address,
        lat: booking.lat,
        lng: booking.lng,
        scheduledAt,
        services: booking.services,
        notes: booking.notes,
        accessInstructions: booking.access_instructions,
        squareFootage: booking.square_footage || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setBookingStatus("Error: " + (data.error || "Could not submit request"));
      return;
    }
    setBookingStatus("success");
    setBooking({ address: "", lat: null, lng: null, date: "", time: "", services: [], notes: "", access_instructions: "", square_footage: "" });
    await reloadShoots();
  }

  async function reloadShoots() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: contact2 } = await supabase.from("contacts").select("id").eq("user_id", user.id).single();
    const cid2 = contact2?.id;
    const { data: shootData } = cid2
      ? await supabase.from("shoots").select("*").or(`client_id.eq.${user.id},contact_id.eq.${cid2}`).neq("status", "cancelled").order("scheduled_at", { ascending: false })
      : await supabase.from("shoots").select("*").eq("client_id", user.id).neq("status", "cancelled").order("scheduled_at", { ascending: false });
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
    const [{ error: contactErr }] = await Promise.all([
      supabase.from("contacts").update({
        name: profile.name,
        phone: profile.phone || null,
        brokerage: profile.brokerage || null,
      }).eq("id", contactId),
      supabase.auth.updateUser({ data: {
        full_name: profile.name,
        phone: profile.phone,
        brokerage: profile.brokerage,
        areas: profile.areas,
        birthday: profile.birthday,
        mailing_list: profile.mailingList,
        referral_source: profile.referralSource,
      }}),
    ]);
    setProfileStatus(contactErr ? "error" : "saved");
    if (!contactErr) { setUserName(profile.name.toUpperCase()); setProfileEditing(false); }
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
  const tabCls = (t: string) => `text-xs tracking-[2px] uppercase px-4 py-1.5 transition-colors cursor-pointer whitespace-nowrap ${tab === t ? "text-white border border-white/60" : "text-[#555] hover:text-white border border-transparent"}`;

  return (
    <main className="min-h-screen text-white flex flex-col relative">
      <img src="/hero-1.jpg" alt="" className="fixed inset-0 w-full h-full object-cover z-0" />
      <div className="fixed inset-0 bg-[#0c0c0c]/80 z-0" />

      <PreviewBanner role="realtor" />
      <div className="relative z-10 h-16">
        <HomeNav />
      </div>

      <div className="relative z-10 flex-1 px-4 md:px-8 pt-4 pb-10 max-w-5xl mx-auto w-full">


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
          {(["overview", "book", "gallery", "invoices", "profile"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={tabCls(t)}>
              {t === "overview" ? "Home" : t === "book" ? "Book a Shoot" : t === "gallery" ? "Shoot Log" : t === "invoices" ? "Invoices" : "Profile"}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-4">

            {/* Photos ready banner */}
            {shoots.some(s => s.status === "delivered" || s.status === "completed") && (
              <button
                onClick={() => setTab("gallery")}
                className="w-full flex items-center justify-between px-6 py-5 bg-[#4ade80]/10 border border-[#4ade80]/30 hover:bg-[#4ade80]/15 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#4ade80]">Your photos are ready</p>
                    <p className="text-xs text-[#4ade80]/60 mt-0.5">
                      {shoots.filter(s => s.status === "delivered" || s.status === "completed").length} shoot{shoots.filter(s => s.status === "delivered" || s.status === "completed").length !== 1 ? "s" : ""} delivered — tap to view & download
                    </p>
                  </div>
                </div>
                <span className="text-[#4ade80]/60 group-hover:text-[#4ade80] transition-colors text-lg">→</span>
              </button>
            )}

            {/* Stat chips */}
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <div className="bg-[#111] border border-white/10 p-3 md:p-6 border-b-2 border-b-[#60a5fa] overflow-hidden">
                <p className="text-[9px] md:text-xs tracking-[1px] md:tracking-[2px] uppercase text-[#666] mb-2 md:mb-3">Shoots</p>
                <p className="text-2xl md:text-3xl font-bold">{shoots.length}</p>
              </div>
              <div className="bg-[#111] border border-white/10 p-3 md:p-6 border-b-2 border-b-[#fbbf24] overflow-hidden">
                <p className="text-[9px] md:text-xs tracking-[1px] md:tracking-[2px] uppercase text-[#666] mb-2 md:mb-3">Sq Ft</p>
                <p className="text-lg md:text-3xl font-bold">{totalSqFt > 0 ? totalSqFt.toLocaleString() : "—"}</p>
              </div>
              <div className="bg-[#111] border border-white/10 p-3 md:p-6 border-b-2 border-b-[#4ade80] overflow-hidden">
                <p className="text-[9px] md:text-xs tracking-[1px] md:tracking-[2px] uppercase text-[#666] mb-2 md:mb-3">Client For</p>
                <p className="text-base md:text-3xl font-bold leading-tight">{memberSince || "—"}</p>
              </div>
            </div>

            {/* Active shoot tracker — show the soonest non-delivered shoot only */}
            {(() => {
              const s = upcomingShoots
                .filter(sh => !["delivered", "completed"].includes(sh.status))
                .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
              if (!s) return null;
              return [s];
            })().map(s => {
              const STAGES = [
                { key: "pending",   label: "Confirmed" },
                { key: "en_route",  label: "En Route" },
                { key: "on_site",   label: "On Site" },
                { key: "wrapping",  label: "Processing" },
                { key: "editing",   label: "Processing" },
                { key: "delivered", label: "Delivered" },
              ];
              const currentIdx = STAGES.findIndex(st => st.key === s.status);
              const activeIdx = currentIdx === -1 ? 0 : currentIdx;
              return (
                <div key={s.id} className="bg-[#111] border border-white/10 p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Active Shoot</p>
                      <p className="font-semibold mb-1">{s.address}</p>
                      <p className="text-xs text-[#555]">{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "TBD"} · {s.services?.join(", ")}</p>
                    </div>
                    {s.status === "delivered" && (
                      <button onClick={() => setTab("gallery")} className="text-xs tracking-[2px] uppercase text-[#4ade80] border border-[#4ade80]/30 px-4 py-2 hover:bg-[#4ade80]/10 transition-colors">
                        View Media →
                      </button>
                    )}
                  </div>
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
                          {!last && <div className={`h-px flex-1 mx-1 mb-5 transition-all ${done ? "bg-white/50" : "bg-white/10"}`} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Action blocks grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Book a Shoot block */}
              <div className="bg-[#111] border border-white/10 p-6 flex flex-col gap-4">
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Book a Shoot</p>
                  {upcomingShoots.length > 0 ? (
                    <p className="text-sm text-[#888]">{upcomingShoots.length} shoot{upcomingShoots.length !== 1 ? "s" : ""} upcoming</p>
                  ) : (
                    <p className="text-sm text-[#888]">No shoots scheduled yet.</p>
                  )}
                </div>
                <button onClick={() => setTab("book")} className="mt-auto text-xs tracking-[3px] uppercase bg-white text-black font-semibold py-3 px-6 hover:bg-white/90 transition-colors">
                  Book Now →
                </button>
              </div>

              {/* Invoices block */}
              <div className="bg-[#111] border border-white/10 p-6 flex flex-col gap-4">
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Invoices</p>
                  {unpaidInvoices.length > 0 ? (
                    <div>
                      <p className="text-2xl font-bold mb-1">${(totalOwed / 100).toLocaleString()}</p>
                      <p className="text-xs text-[#fbbf24]">{unpaidInvoices.length} unpaid invoice{unpaidInvoices.length !== 1 ? "s" : ""}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-[#4ade80]">All invoices paid ✓</p>
                  )}
                </div>
                <button onClick={() => setTab("invoices")} className="mt-auto text-xs tracking-[3px] uppercase border border-white/20 py-3 px-6 hover:bg-white/5 transition-colors">
                  View Invoices →
                </button>
              </div>

              {/* Refer a Friend block */}
              <div className="bg-[#111] border border-white/10 p-6 flex flex-col gap-4">
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Refer a Friend</p>
                  <p className="text-xs text-[#666]">Know a realtor who needs great media? Send them our way.</p>
                </div>
                {referralStatus === "sent" ? (
                  <div className="bg-[#4ade8018] border border-[#4ade80]/20 p-4 text-center">
                    <p className="text-[#4ade80] text-xs mb-2">Referral sent!</p>
                    <button onClick={() => { setReferralStatus(""); setReferral({ name: "", email: "" }); }} className="text-xs tracking-[2px] uppercase text-white/40 hover:text-white transition-colors">Refer Another</button>
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setReferralStatus("sending");
                    const res = await fetch("/api/portal/referral", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ referrerContactId: contactId, referrerName: userName, friendName: referral.name, friendEmail: referral.email }),
                    });
                    setReferralStatus(res.ok ? "sent" : "error");
                  }} className="flex flex-col gap-3">
                    <input required value={referral.name} onChange={e => setReferral(r => ({ ...r, name: e.target.value }))} placeholder="Friend's name" className={inputCls} />
                    <input required type="email" value={referral.email} onChange={e => setReferral(r => ({ ...r, email: e.target.value }))} placeholder="Friend's email" className={inputCls} />
                    {referralStatus === "error" && <p className="text-xs text-red-400">Something went wrong. Try again.</p>}
                    <button type="submit" disabled={referralStatus === "sending"} className="text-xs tracking-[3px] uppercase border border-white/20 py-3 hover:bg-white/5 transition-colors disabled:opacity-50">
                      {referralStatus === "sending" ? "Sending..." : "Send Referral →"}
                    </button>
                  </form>
                )}
              </div>

              {/* Leave a Review block */}
              <div className="bg-[#111] border border-white/10 p-6 flex flex-col gap-4">
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-2">Leave a Review</p>
                  <p className="text-xs text-[#666]">Enjoyed working with us? A Google review helps other realtors find us.</p>
                  <p className="text-2xl mt-3 tracking-widest">★★★★★</p>
                </div>
                <a
                  href="https://g.page/r/CZ9cShOb3iPUEBI/review"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto text-xs tracking-[3px] uppercase border border-white/20 py-3 px-6 text-center hover:bg-white/5 transition-colors"
                >
                  Review on Google →
                </a>
              </div>

            </div>

            {/* Shoot history */}
            <div className="pt-2">
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

        {/* BOOK / SHOOT LOG / INVOICES / PROFILE — shared persistent card */}
        {tab !== "overview" && (
          <div className="w-full bg-[#111] border border-white/10 min-h-[700px] p-6 md:p-8">

        {/* BOOK A SHOOT */}
        {tab === "book" && (
          <div>
            {bookingStatus === "success" ? (
              <div className="bg-[#4ade8018] border border-[#4ade80]/20 p-8 text-center">
                <p className="text-[#4ade80] text-sm tracking-wide mb-4">Shoot request submitted! We'll confirm shortly.</p>
                <button onClick={() => { setBookingStatus(""); setTab("overview"); }} className="text-xs tracking-[3px] uppercase text-white border border-white/20 px-6 py-3 hover:bg-white/5 transition-colors">Back to Overview</button>
              </div>
            ) : (
              <form onSubmit={submitBooking}>
                <div className="flex flex-col gap-6">

                  {/* Address */}
                  <AddressMapPicker
                    address={booking.address}
                    onAddressChange={a => setBooking(b => ({ ...b, address: a }))}
                    lat={booking.lat}
                    lng={booking.lng}
                    onLocationChange={(lat, lng) => setBooking(b => ({ ...b, lat, lng }))}
                    inputCls={inputCls}
                    labelCls={labelCls}
                  />

                  {/* Date + Time */}
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

                  {/* Square footage */}
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Square Footage <span className="text-[#444]">(optional — used for quote)</span></label>
                    <input type="number" placeholder="2400" min="0" value={booking.square_footage} onChange={e => setBooking(b => ({ ...b, square_footage: e.target.value }))} className={inputCls} />
                  </div>

                  {/* Primary services */}
                  <div className="flex flex-col gap-3">
                    <label className={labelCls}>Services</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PRIMARY_SERVICES.map(s => {
                        const checked = booking.services.includes(s.key);
                        return (
                          <label key={s.key} className={`flex items-center justify-between px-4 py-3 cursor-pointer border transition-colors ${checked ? "border-white/40 bg-white/5" : "border-white/10 bg-[#181818] hover:bg-white/[0.03]"}`}>
                            <div className="flex items-center gap-3">
                              <input type="checkbox" checked={checked} onChange={() => toggleService(s.key)} className="accent-white w-3 h-3" />
                              <span className="text-xs tracking-[1px] uppercase text-white">{s.label}</span>
                            </div>
                            <span className="text-[10px] text-[#555] whitespace-nowrap">from ${s.from}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add-ons */}
                  <div className="flex flex-col gap-3">
                    <label className={labelCls + " text-[#444]"}>Add-ons</label>
                    <div className="grid grid-cols-2 gap-2">
                      {ADDON_SERVICES.map(s => {
                        const checked = booking.services.includes(s.key);
                        return (
                          <label key={s.key} className={`flex items-center justify-between px-4 py-3 cursor-pointer border transition-colors ${checked ? "border-white/30 bg-white/5" : "border-white/5 bg-[#141414] hover:bg-white/[0.02]"}`}>
                            <div className="flex items-center gap-3">
                              <input type="checkbox" checked={checked} onChange={() => toggleService(s.key)} className="accent-white w-3 h-3" />
                              <span className="text-xs tracking-[1px] uppercase text-[#aaa]">{s.label}</span>
                            </div>
                            <span className="text-[10px] text-[#444] whitespace-nowrap">from ${s.from}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live quote */}
                  {booking.services.length > 0 && (() => {
                    const { low, exact } = calcQuote(booking.services, booking.square_footage);
                    return (
                      <div className="border-t border-white/10 pt-4 flex items-center justify-between">
                        <p className="text-xs tracking-[2px] uppercase text-[#555]">Estimated Total</p>
                        <p className="text-xl font-bold">
                          {exact ? `$${low.toLocaleString()}` : `From $${low.toLocaleString()}`}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Property access */}
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Property Access <span className="text-[#444]">(optional)</span></label>
                    <textarea placeholder="Lockbox code, Supra key box, gate code, alarm instructions..." value={booking.access_instructions} onChange={e => setBooking(b => ({ ...b, access_instructions: e.target.value }))} className={inputCls + " resize-none h-20"} />
                  </div>

                  {/* Notes */}
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Notes <span className="text-[#444]">(optional)</span></label>
                    <textarea placeholder="Parking info, anything else we should know..." value={booking.notes} onChange={e => setBooking(b => ({ ...b, notes: e.target.value }))} className={inputCls + " resize-none h-24"} />
                  </div>

                  {bookingStatus && <p className="text-xs text-red-400 border border-red-400/20 bg-red-400/5 px-4 py-3">{bookingStatus}</p>}

                  <button type="submit" disabled={loading || booking.services.length === 0} className="bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? "Submitting..." : "Submit Booking Request →"}
                  </button>

                </div>
              </form>
            )}
          </div>
        )}

        {/* INVOICES */}
        {tab === "invoices" && (
          <div>
            {justPaid && (
              <div className="bg-[#4ade8018] border border-[#4ade80]/20 p-4 mb-4 text-center">
                <p className="text-[#4ade80] text-sm">Payment received — thank you! Your invoice will update to Paid shortly.</p>
              </div>
            )}
            {payError && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 mb-4 text-center">
                <p className="text-red-400 text-sm">{payError}</p>
              </div>
            )}
            {invoices.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-[#555] text-sm">No invoices yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead><tr className="border-b border-white/10">{["Date", "Amount", "Due", "Status", ""].map((h, i) => <th key={i} className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">{h}</th>)}</tr></thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 text-[#888]">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}</td>
                        <td className="px-5 py-3 font-medium">${(inv.amount_cents / 100).toLocaleString()}</td>
                        <td className="px-5 py-3 text-[#888]">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs tracking-[1px] uppercase px-2 py-1 ${inv.paid ? "bg-[#4ade8018] text-[#4ade80]" : "bg-[#fbbf2418] text-[#fbbf24]"}`}>{inv.paid ? "Paid" : "Due"}</span>
                        </td>
                        <td className="px-5 py-3">
                          {!inv.paid && (
                            <button onClick={() => payInvoice(inv.id)} disabled={payingId === inv.id}
                              className="text-xs tracking-[2px] uppercase text-[#60a5fa] hover:text-white transition-colors disabled:opacity-40">
                              {payingId === inv.id ? "Loading…" : "Pay Now →"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SHOOT LOG */}
        {tab === "gallery" && (
          <div>
            {shoots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                <p className="text-white text-lg font-semibold">No shoots... Yet!</p>
                <p className="text-[#555] text-sm">Your shoots will appear here once booked.</p>
                <button onClick={() => setTab("book")} className="mt-2 text-xs tracking-[3px] uppercase text-white border border-white/20 px-6 py-3 hover:bg-white/5 transition-colors">Book Your First Shoot</button>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-white/5">
                {shoots.map(s => (
                  <ShootLogRow
                    key={s.id}
                    shoot={s}
                    expanded={expandedShootId === s.id}
                    onToggle={() => setExpandedShootId(expandedShootId === s.id ? null : s.id)}
                    onUpdated={reloadShoots}
                    onCancelled={reloadShoots}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFILE */}
        {tab === "profile" && (() => {
          const CHANNEL_LABELS: Record<string, string> = {
            referral: "Referral", "google-seo": "Google Search", "google-business": "Google Business",
            yelp: "Yelp", instagram: "Instagram", facebook: "Facebook",
            "linkedin-business": "LinkedIn (Luck Images)", "linkedin-personal": "LinkedIn (Ryan Luck)",
            "cold-call": "They called me", "cold-email": "Email outreach",
            zillow: "Zillow / Realtor.com", networking: "Networking event",
            partnership: "Partner company", "direct-mail": "Direct mail", other: "Other",
          };
          const infoRows = [
            { label: "Full Name", value: profile.name },
            { label: "Email", value: profile.email },
            { label: "Phone", value: profile.phone },
            { label: "Brokerage", value: profile.brokerage },
            { label: "Areas", value: profile.areas },
            { label: "Birthday", value: profile.birthday },
            { label: "How you found us", value: CHANNEL_LABELS[profile.referralSource] || profile.referralSource },
            { label: "Mailing List", value: profile.mailingList ? "Subscribed" : "Not subscribed" },
          ];
          return (
          <div className="flex flex-col gap-8">

            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center text-2xl font-bold">
                  {!avatarError && avatarUrl
                    ? <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
                    : <span>{userName.charAt(0)}</span>}
                </div>
                <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              </div>
              <div>
                <p className="text-3xl font-black tracking-tight uppercase">{userName}</p>
                {profile.brokerage && <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1">{profile.brokerage}</p>}
              </div>
            </div>

            {/* Info — view or edit */}
            {!profileEditing ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs tracking-[4px] uppercase text-[#555]">Personal Info</p>
                  <button onClick={() => setProfileEditing(true)} className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-4 py-1.5 hover:border-white/30">
                    Edit
                  </button>
                </div>
                <div className="divide-y divide-white/5">
                  {infoRows.map(row => row.value ? (
                    <div key={row.label} className="flex justify-between py-3 gap-4">
                      <span className="text-xs tracking-[1px] uppercase text-[#555] shrink-0">{row.label}</span>
                      <span className="text-sm text-white/80 text-right">{row.value}</span>
                    </div>
                  ) : null)}
                </div>
              </div>
            ) : (
              <form onSubmit={saveProfile} className="flex flex-col gap-4">
                <div className="flex items-center justify-between mb-0">
                  <p className="text-xs tracking-[4px] uppercase text-[#555]">Personal Info</p>
                  <button type="button" onClick={() => setProfileEditing(false)} className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">Cancel</button>
                </div>
                {contactId && (
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center text-xl font-bold shrink-0">
                      {!avatarError && avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={() => setAvatarError(true)} /> : <span>{userName.charAt(0)}</span>}
                    </div>
                    <button type="button" onClick={() => avatarFileRef.current?.click()} disabled={uploadingAvatar}
                      className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-4 py-2 hover:border-white/30">
                      {uploadingAvatar ? "Uploading..." : "Change Photo"}
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Full Name</label>
                  <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" className={inputCls} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Email</label>
                  <input type="email" value={profile.email} disabled className={inputCls + " opacity-40 cursor-not-allowed"} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Phone</label>
                  <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="(512) 555-0100" className={inputCls} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Brokerage / Company</label>
                  <input value={profile.brokerage} onChange={e => setProfile(p => ({ ...p, brokerage: e.target.value }))} placeholder="Keller Williams" className={inputCls} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Preferred Areas / Zip Codes</label>
                  <input value={profile.areas} onChange={e => setProfile(p => ({ ...p, areas: e.target.value }))} placeholder="78701, 78704, South Austin..." className={inputCls} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Birthday</label>
                  <input type="date" value={profile.birthday} onChange={e => setProfile(p => ({ ...p, birthday: e.target.value }))} className={inputCls} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>How did you hear about us?</label>
                  <select value={profile.referralSource} onChange={e => setProfile(p => ({ ...p, referralSource: e.target.value }))} className={inputCls + " cursor-pointer"}>
                    <option value="">Select one...</option>
                    {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={profile.mailingList} onChange={e => setProfile(p => ({ ...p, mailingList: e.target.checked }))} className="accent-white w-4 h-4" />
                  <span className="text-xs tracking-[1px] text-[#888]">Sign me up for tips, promotions & market updates</span>
                </label>
                <button type="submit" disabled={profileStatus === "saving"}
                  className="bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50">
                  {profileStatus === "saving" ? "Saving..." : profileStatus === "saved" ? "Saved ✓" : profileStatus === "error" ? "Error — try again" : "Save Changes"}
                </button>
              </form>
            )}

            {/* Password */}
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Password</p>
              <Link href="/set-password" className="block text-center border border-white/20 text-white text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/5 transition-colors">
                Change Password →
              </Link>
            </div>

            {/* Sign out */}
            <div>
              <button onClick={signOut} className="w-full text-center bg-white text-black text-xs tracking-[3px] uppercase font-semibold py-4 hover:bg-white/90 transition-colors">
                Log Out →
              </button>
            </div>

          </div>
          );
        })()}

          </div>
        )}

      </div>
    </main>
  );
}

const rowInputCls = "bg-[#181818] border border-white/10 text-white text-sm px-3 py-2 outline-none focus:border-white/40 transition-colors placeholder:text-[#444] w-full";
const rowLabelCls = "text-[10px] tracking-[2px] uppercase text-[#666]";

function ShootLogRow({ shoot, expanded, onToggle, onUpdated, onCancelled }: {
  shoot: Shoot;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: () => Promise<void>;
  onCancelled: () => Promise<void>;
}) {
  const delivered = shoot.status === "delivered" || shoot.status === "completed";
  const editable = EDITABLE_STATUSES.includes(shoot.status);
  const parsed = parseNotes(shoot.notes);

  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const [eAddress, setEAddress] = useState(shoot.address);
  const [eLat, setELat] = useState<number | null>(shoot.lat ?? null);
  const [eLng, setELng] = useState<number | null>(shoot.lng ?? null);
  const [eDate, setEDate] = useState(shoot.scheduled_at ? shoot.scheduled_at.slice(0, 10) : "");
  const [eTime, setETime] = useState(shoot.scheduled_at ? new Date(shoot.scheduled_at).toTimeString().slice(0, 5) : "");
  const [eSqft, setESqft] = useState(shoot.square_footage ? String(shoot.square_footage) : "");
  const [eServices, setEServices] = useState<string[]>(shoot.services || []);
  const [eAccess, setEAccess] = useState(parsed.access);
  const [eNotes, setENotes] = useState(parsed.notes);

  function toggleEService(key: string) {
    setEServices(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  }

  function startEditing() {
    setEAddress(shoot.address);
    setELat(shoot.lat ?? null);
    setELng(shoot.lng ?? null);
    setEDate(shoot.scheduled_at ? shoot.scheduled_at.slice(0, 10) : "");
    setETime(shoot.scheduled_at ? new Date(shoot.scheduled_at).toTimeString().slice(0, 5) : "");
    setESqft(shoot.square_footage ? String(shoot.square_footage) : "");
    setEServices(shoot.services || []);
    setEAccess(parsed.access);
    setENotes(parsed.notes);
    setError("");
    setEditing(true);
  }

  async function save() {
    setSaving(true); setError("");
    const scheduledAt = eDate ? new Date(`${eDate}T${eTime || "09:00"}`).toISOString() : shoot.scheduled_at;
    const res = await fetch("/api/portal/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: shoot.id, address: eAddress, lat: eLat, lng: eLng, scheduledAt,
        services: eServices, notes: eNotes, accessInstructions: eAccess,
        squareFootage: eSqft || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save changes");
      return;
    }
    setEditing(false);
    await onUpdated();
  }

  async function confirmCancel() {
    setCancelling(true); setError("");
    const res = await fetch("/api/portal/shoots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shoot.id, cancel: true }),
    });
    setCancelling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not cancel");
      return;
    }
    await onCancelled();
  }

  const visual = statusVisual(shoot.status);
  const quote = calcQuote(shoot.services || [], shoot.square_footage ? String(shoot.square_footage) : "");

  return (
    <div className="py-4">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">
            {shortDate(shoot.scheduled_at)} - {truncateAddressToStreet(shoot.address)}
            {shoot.square_footage ? <span className="text-[#888] font-normal"> ({shoot.square_footage.toLocaleString()}sf)</span> : null}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {(shoot.services || []).map(s => (
              <span key={s} className="text-[10px] tracking-wide uppercase text-white border border-white px-2 py-0.5">{s}</span>
            ))}
            {quote.low > 0 && (
              <span className={`text-xs font-bold ${visual.text}`}>${quote.low.toLocaleString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs tracking-[1px] uppercase px-2 py-1 whitespace-nowrap ${visual.bg} ${visual.text}`}>{shoot.status.replace("_", " ")}</span>
          <span className={`text-[#555] text-sm transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 bg-white/[0.02] border border-white/10 p-4">
          {!editing ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={rowLabelCls}>Date &amp; Time</p>
                  <p className="text-sm text-white mt-1">{shoot.scheduled_at ? new Date(shoot.scheduled_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "TBD"}</p>
                </div>
                <div>
                  <p className={rowLabelCls}>Square Footage</p>
                  <p className="text-sm text-white mt-1">{shoot.square_footage || "—"}</p>
                </div>
              </div>
              <div>
                <p className={rowLabelCls}>Services</p>
                <p className="text-sm text-white mt-1">{shoot.services?.join(", ") || "—"}</p>
              </div>
              {parsed.access && (
                <div>
                  <p className={rowLabelCls}>Property Access</p>
                  <p className="text-sm text-white mt-1 whitespace-pre-wrap">{parsed.access}</p>
                </div>
              )}
              {parsed.notes && (
                <div>
                  <p className={rowLabelCls}>Notes</p>
                  <p className="text-sm text-white mt-1 whitespace-pre-wrap">{parsed.notes}</p>
                </div>
              )}

              {error && <p className="text-xs text-red-400 border border-red-400/20 bg-red-400/5 px-3 py-2">{error}</p>}

              <div className="flex items-center gap-3 pt-2">
                {delivered && (
                  <Link href={`/client/gallery/${shoot.id}`} className="text-xs tracking-[2px] uppercase text-[#4ade80] hover:text-white transition-colors">View Gallery →</Link>
                )}
                {editable && !confirmingCancel && (
                  <>
                    <button onClick={startEditing} className="text-xs tracking-[2px] uppercase text-white border border-white/20 px-4 py-2 hover:bg-white/5 transition-colors">Edit</button>
                    <button onClick={() => setConfirmingCancel(true)} className="text-xs tracking-[2px] uppercase text-red-400 border border-red-400/20 px-4 py-2 hover:bg-red-400/5 transition-colors">Cancel Shoot</button>
                  </>
                )}
                {confirmingCancel && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#888]">Cancel this shoot request?</span>
                    <button onClick={confirmCancel} disabled={cancelling} className="text-xs tracking-[2px] uppercase text-white bg-red-500/80 px-4 py-2 hover:bg-red-500 transition-colors disabled:opacity-50">
                      {cancelling ? "Cancelling..." : "Yes, Cancel"}
                    </button>
                    <button onClick={() => setConfirmingCancel(false)} className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Keep It</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <AddressMapPicker
                address={eAddress}
                onAddressChange={setEAddress}
                lat={eLat}
                lng={eLng}
                onLocationChange={(lat, lng) => { setELat(lat); setELng(lng); }}
                inputCls={rowInputCls}
                labelCls={rowLabelCls}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={rowLabelCls}>Date</label>
                  <input type="date" value={eDate} onChange={e => setEDate(e.target.value)} className={rowInputCls} />
                </div>
                <div>
                  <label className={rowLabelCls}>Time</label>
                  <input type="time" value={eTime} onChange={e => setETime(e.target.value)} className={rowInputCls} />
                </div>
              </div>
              <div>
                <label className={rowLabelCls}>Square Footage</label>
                <input type="number" min="0" value={eSqft} onChange={e => setESqft(e.target.value)} className={rowInputCls} />
              </div>
              <div>
                <label className={rowLabelCls}>Services</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[...PRIMARY_SERVICES, ...ADDON_SERVICES].map(s => {
                    const checked = eServices.includes(s.key);
                    return (
                      <label key={s.key} className={`flex items-center gap-2 px-3 py-2 cursor-pointer border transition-colors ${checked ? "border-white/40 bg-white/5" : "border-white/10 bg-[#181818] hover:bg-white/[0.03]"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleEService(s.key)} className="accent-white w-3 h-3" />
                        <span className="text-xs text-white">{s.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className={rowLabelCls}>Property Access</label>
                <textarea value={eAccess} onChange={e => setEAccess(e.target.value)} placeholder="Lockbox code, Supra key box, gate code..." className={rowInputCls + " resize-none h-16"} />
              </div>
              <div>
                <label className={rowLabelCls}>Notes</label>
                <textarea value={eNotes} onChange={e => setENotes(e.target.value)} placeholder="Parking info, anything else..." className={rowInputCls + " resize-none h-16"} />
              </div>

              {error && <p className="text-xs text-red-400 border border-red-400/20 bg-red-400/5 px-3 py-2">{error}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button onClick={save} disabled={saving} className="text-xs tracking-[2px] uppercase text-black bg-white font-semibold px-4 py-2 hover:bg-white/90 transition-colors disabled:opacity-50">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => { setEditing(false); setError(""); }} className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">Discard</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
