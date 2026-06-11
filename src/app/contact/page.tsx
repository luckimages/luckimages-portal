"use client";

import { useState } from "react";
import Link from "next/link";
import HomeNav from "@/components/HomeNav";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  const inputCls = "bg-[#111] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/40 transition-colors w-full placeholder:text-[#444]";

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />

      <div className="pt-32 pb-16 text-center px-6">
        <p className="text-xs tracking-[4px] uppercase text-[#666] mb-4">Get In Touch</p>
        <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-6">Contact</h1>
        <p className="text-[#666] text-lg max-w-md mx-auto leading-relaxed">
          Ready to book or have questions? We'll get back to you fast.
        </p>
      </div>

      <div className="flex-1 px-6 pb-24 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">

          {/* Contact info */}
          <div className="flex flex-col gap-10">
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-6 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Info</p>
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1">Email</p>
                  <a href="mailto:ryan@luckimages.com" className="text-white/80 hover:text-white transition-colors">ryan@luckimages.com</a>
                </div>
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1">Location</p>
                  <p className="text-white/80">Austin, TX</p>
                </div>
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1">Turnaround</p>
                  <p className="text-white/80">Photos delivered within 24 hours</p>
                </div>
                <div>
                  <p className="text-xs tracking-[2px] uppercase text-[#555] mb-1">Availability</p>
                  <p className="text-white/80">Mon – Sat, 7am – 7pm</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-6 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Already a client?</p>
              <Link href="/login" className="text-xs tracking-[3px] uppercase border border-white/25 px-6 py-3 hover:border-white hover:bg-white/5 transition-all inline-block">
                Access Client Portal →
              </Link>
            </div>
          </div>

          {/* Form */}
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-6 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">Send a Message</p>

            {status === "sent" ? (
              <div className="bg-[#4ade8018] border border-[#4ade80]/20 p-8 text-center">
                <p className="text-[#4ade80] text-sm tracking-[1px] mb-2">Message sent!</p>
                <p className="text-[#666] text-xs">We'll be in touch shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs tracking-[2px] uppercase text-[#666]">Name</label>
                    <input required className={inputCls} placeholder="Jane Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs tracking-[2px] uppercase text-[#666]">Phone</label>
                    <input className={inputCls} placeholder="(512) 000-0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs tracking-[2px] uppercase text-[#666]">Email</label>
                  <input required type="email" className={inputCls} placeholder="jane@realty.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs tracking-[2px] uppercase text-[#666]">Service Interested In</label>
                  <select className={inputCls + " cursor-pointer"} value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}>
                    <option value="">Select a service...</option>
                    <option>Listing Photos</option>
                    <option>Video</option>
                    <option>Twilight</option>
                    <option>Drone</option>
                    <option>Matterport</option>
                    <option>Virtual Staging</option>
                    <option>Floorplans</option>
                    <option>Brochures</option>
                    <option>Bundle / Multiple Services</option>
                    <option>Not Sure Yet</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs tracking-[2px] uppercase text-[#666]">Message</label>
                  <textarea required rows={5} className={inputCls + " resize-none"} placeholder="Tell us about your listing, timeline, or any questions..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                </div>

                {status === "error" && (
                  <p className="text-red-400 text-xs tracking-[1px]">Something went wrong — please email us directly at ryan@luckimages.com</p>
                )}

                <button type="submit" disabled={status === "sending"} className="text-xs tracking-[3px] uppercase bg-white text-black px-8 py-4 font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 mt-2">
                  {status === "sending" ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</a>
      </footer>
    </main>
  );
}
