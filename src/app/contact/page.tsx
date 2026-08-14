"use client";

import { useState } from "react";
import Link from "next/link";
import HomeNav from "@/components/HomeNav";
import FadeUp from "@/components/FadeUp";

const SERVICES = [
  "Listing photos", "Twilight photos", "Walk through video",
  "Aerial photos", "Aerial video", "Matterport / 360 tour",
  "Virtual staging", "Floorplans", "Brochures",
];

const LISTING_TYPES = ["Single family", "Condo / townhome", "Luxury", "Land / lot", "Commercial", "New construction"];

export default function ContactPage() {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    address: "", listingType: "", deliverBy: "", details: "",
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function toggleService(s: string) {
    setSelectedServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedServices.length === 0) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, services: selectedServices }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  const inputCls = "bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/60 focus:shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_16px_rgba(255,255,255,0.06)] transition-all duration-200 w-full placeholder:text-[#444]";

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />

      <FadeUp className="pt-32 pb-16 text-center px-6">
        <p className="text-xs tracking-[4px] uppercase text-[#666] mb-4">Get In Touch</p>
        <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-6">Let's Work Together</h1>
        <p className="text-[#666] text-lg whitespace-nowrap">Fill out the form below and a member of our team will reach out shortly.</p>
        <p className="text-[#666] text-sm mt-3">
          Or call <a href="tel:5123751585" className="text-white/70 hover:text-white transition-colors">(512) 375-1585</a>
          {" "}or email <a href="mailto:ryan@luckimages.com" className="text-white/70 hover:text-white transition-colors">ryan@luckimages.com</a>
        </p>
      </FadeUp>

      <FadeUp delay={0.1} className="flex-1 px-6 pb-24 max-w-3xl mx-auto w-full">
        <div className="border-[3px] border-white/50 p-8 md:p-12">
        {status === "sent" ? (
          <div className="bg-[#0c0c0c] border border-white/20 p-12 text-center flex flex-col items-center gap-6">
            <div>
              <p className="text-white text-sm tracking-[2px] uppercase mb-2">Message sent!</p>
              <p className="text-white/60 text-sm">We'll be in touch soon.</p>
            </div>
            <div className="border-t border-white/10 w-full pt-6 flex flex-col items-center gap-3">
              <p className="text-white/50 text-xs tracking-[1px]">In the meantime, create your client account to get ready for your first shoot.</p>
              <Link href="/register" className="text-xs tracking-[3px] uppercase bg-white text-black px-8 py-3 font-semibold hover:bg-white/90 transition-colors">
                Create Account →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs tracking-[2px] uppercase text-[#666]">First Name <span className="text-white/30">*</span></label>
                <input required className={inputCls} placeholder="Jane" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs tracking-[2px] uppercase text-[#666]">Last Name <span className="text-white/30">*</span></label>
                <input required className={inputCls} placeholder="Smith" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs tracking-[2px] uppercase text-[#666]">Email <span className="text-white/30">*</span></label>
                <input required type="email" className={inputCls} placeholder="jane@realty.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs tracking-[2px] uppercase text-[#666]">Phone <span className="text-white/30">*</span></label>
                <input required className={inputCls} placeholder="(512) 000-0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>

            {/* Address */}
            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-[2px] uppercase text-[#666]">Listing Address <span className="text-white/30">*</span></label>
              <input required className={inputCls} placeholder="123 Main St, Austin, TX 78701" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>

            {/* Listing Type */}
            <div className="flex flex-col gap-3">
              <label className="text-xs tracking-[2px] uppercase text-[#666]">Type of Listing</label>
              <div className="flex flex-wrap gap-2">
                {LISTING_TYPES.map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, listingType: f.listingType === t ? "" : t }))}
                    className={`text-xs px-4 py-2 rounded-full border transition-all ${form.listingType === t ? "border-white text-white bg-white/10" : "border-white/20 text-white/40 hover:border-white/40 hover:text-white/60"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Services */}
            <div className="flex flex-col gap-3">
              <label className="text-xs tracking-[2px] uppercase text-[#666]">Services Needed <span className="text-white/30">*</span></label>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => toggleService(s)}
                    className={`text-xs px-4 py-2 rounded-full border transition-all ${selectedServices.includes(s) ? "border-white text-white bg-white/10" : "border-white/20 text-white/40 hover:border-white/40 hover:text-white/60"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {selectedServices.length === 0 && status === "error" && (
                <p className="text-red-400 text-xs">Please select at least one service.</p>
              )}
            </div>

            {/* Date */}
            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-[2px] uppercase text-[#666]">Need Media Delivered By</label>
              <input type="date" className={inputCls + " cursor-pointer"} value={form.deliverBy} onChange={e => setForm(f => ({ ...f, deliverBy: e.target.value }))} />
            </div>

            {/* Details */}
            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-[2px] uppercase text-[#666]">Any Extra Project Details?</label>
              <textarea rows={4} className={inputCls + " resize-none"} placeholder="Square footage, gate codes, special requests..." value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} />
            </div>

            {status === "error" && (
              <p className="text-red-400 text-xs tracking-[1px]">Something went wrong — please email us at ryan@luckimages.com</p>
            )}

            <button type="submit" disabled={status === "sending"} className="text-xs tracking-[3px] uppercase bg-white text-black px-8 py-4 font-semibold hover:bg-white/90 transition-colors disabled:opacity-50">
              {status === "sending" ? "Sending..." : "Submit"}
            </button>
          </form>
        )}
        </div>
      </FadeUp>

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</a>
      </footer>
    </main>
  );
}
