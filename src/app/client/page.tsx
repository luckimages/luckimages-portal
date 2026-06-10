"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Shoot = {
  id: string; address: string; scheduled_at: string;
  services: string[]; status: string; notes: string;
};
type Invoice = {
  id: string; amount_cents: number; paid: boolean;
  due_date: string; notes: string; shoot_id: string;
};

export default function ClientPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tab, setTab] = useState<"overview" | "book" | "invoices" | "gallery">("overview");
  const [booking, setBooking] = useState({ address: "", date: "", time: "", services: [] as string[], notes: "" });
  const [bookingStatus, setBookingStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const SERVICES = ["Listing Photos", "Drone", "Matterport", "Video", "Headshots"];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUserName((data.user.user_metadata?.full_name || data.user.email || "").toUpperCase());
      const uid = data.user.id;
      const [{ data: shootData }, { data: invData }] = await Promise.all([
        supabase.from("shoots").select("*").eq("client_id", uid).order("scheduled_at", { ascending: false }),
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
    });
    setLoading(false);
    if (error) { setBookingStatus("Error: " + error.message); return; }
    setBookingStatus("success");
    setBooking({ address: "", date: "", time: "", services: [], notes: "" });
    const { data: shootData } = await supabase.from("shoots").select("*").eq("client_id", user!.id).order("scheduled_at", { ascending: false });
    setShoots(shootData || []);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  const unpaidInvoices = invoices.filter(i => !i.paid);
  const totalOwed = unpaidInvoices.reduce((s, i) => s + i.amount_cents, 0);
  const upcomingShoots = shoots.filter(s => s.status !== "completed" && s.status !== "cancelled");

  const inputCls = "bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 transition-colors placeholder:text-[#444] w-full";
  const labelCls = "text-xs tracking-[2px] uppercase text-[#666]";
  const tabCls = (t: string) => `text-xs tracking-[2px] uppercase px-4 py-2 transition-colors cursor-pointer ${tab === t ? "text-white border-b border-white" : "text-[#555] hover:text-white"}`;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <span className="text-xl font-black tracking-tight uppercase">Luck Images</span>
        <div className="flex items-center gap-6">
          <span className="text-xs tracking-[2px] uppercase text-[#666]">Client Portal</span>
          <button onClick={signOut} className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
        </div>
      </header>

      <div className="flex-1 px-8 py-10 max-w-5xl mx-auto w-full">

        <div className="mb-8">
          <p className="text-xs tracking-[4px] uppercase text-[#666] mb-1">Welcome back</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">{userName}</h1>
        </div>

        {/* TABS */}
        <div className="flex border-b border-white/10 mb-8 gap-1">
          {(["overview", "book", "invoices", "gallery"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={tabCls(t)}>{t === "overview" ? "Overview" : t === "book" ? "Book a Shoot" : t === "invoices" ? "Invoices" : "My Gallery"}</button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#111] border border-white/10 p-6 border-b-2 border-b-[#60a5fa]">
                <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Upcoming Shoots</p>
                <p className="text-3xl font-bold">{upcomingShoots.length}</p>
              </div>
              <div className="bg-[#111] border border-white/10 p-6 border-b-2 border-b-[#fbbf24]">
                <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Invoices Due</p>
                <p className="text-3xl font-bold">{unpaidInvoices.length}</p>
              </div>
              <div className="bg-[#111] border border-white/10 p-6 border-b-2 border-b-[#4ade80]">
                <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">Total Owed</p>
                <p className="text-3xl font-bold">${(totalOwed / 100).toLocaleString()}</p>
              </div>
            </div>

            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Recent Shoots</p>
              {shoots.length === 0 ? (
                <div className="bg-[#111] border border-white/10 p-8 text-center">
                  <p className="text-[#555] text-sm mb-4">No shoots yet</p>
                  <button onClick={() => setTab("book")} className="text-xs tracking-[3px] uppercase text-white border border-white/20 px-6 py-3 hover:bg-white/5 transition-colors">Book Your First Shoot</button>
                </div>
              ) : (
                <div className="bg-[#111] border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/10">{["Address", "Date", "Services", "Status"].map(h => <th key={h} className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">{h}</th>)}</tr></thead>
                    <tbody>
                      {shoots.slice(0, 5).map(s => (
                        <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3">{s.address}</td>
                          <td className="px-5 py-3 text-[#888]">{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString() : "—"}</td>
                          <td className="px-5 py-3 text-[#888] text-xs">{s.services?.join(", ")}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs tracking-[1px] uppercase px-2 py-1 ${s.status === "completed" ? "bg-[#4ade8018] text-[#4ade80]" : s.status === "confirmed" ? "bg-[#60a5fa18] text-[#60a5fa]" : "bg-[#fbbf2418] text-[#fbbf24]"}`}>{s.status}</span>
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
              <div className="bg-[#111] border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
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
            {shoots.filter(s => s.status === "completed").length === 0 ? (
              <div className="bg-[#111] border border-white/10 p-8 text-center">
                <p className="text-[#555] text-sm">Media will appear here once your shoot is completed and photos are uploaded.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {shoots.filter(s => s.status === "completed").map(s => (
                  <Link key={s.id} href={`/client/gallery/${s.id}`} className="bg-[#111] border border-white/10 p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div>
                      <p className="font-medium mb-1">{s.address}</p>
                      <p className="text-xs text-[#555]">{new Date(s.scheduled_at).toLocaleDateString()} · {s.services?.join(", ")}</p>
                    </div>
                    <span className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white">View Photos →</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
