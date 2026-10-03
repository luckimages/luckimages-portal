"use client";

import { useState } from "react";
import Link from "next/link";
import EthanNav from "@/components/ethan/EthanNav";
import EthanFooter from "@/components/ethan/EthanFooter";
import FadeUp from "@/components/FadeUp";
import { ETHAN_MENUS } from "@/lib/ethanMenus";

const EVENT_TYPES = [
  "Private dinner party",
  "Event catering",
  "Standing / weekly service",
  "Something else",
];

const inputCls =
  "font-text bg-[#141210] border border-[#C9A44C]/20 text-[#F2EDE4] text-sm px-4 py-3.5 w-full outline-none transition-all duration-200 focus:border-[#C9A44C] focus:shadow-[0_0_0_1px_rgba(201,164,76,0.35)]";
const labelCls = "font-text text-[10px] tracking-[0.28em] uppercase text-[#A89F93]";

export default function EthanBook() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    eventDate: "",
    eventTime: "",
    guests: "",
    location: "",
    customMenu: "",
    dietary: "",
    notes: "",
  });
  const [eventType, setEventType] = useState("");
  const [menuStyle, setMenuStyle] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!menuStyle) {
      setError("Please choose a menu style.");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/ethan/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, eventType, menuStyle }),
      });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong. Please email Ethan directly.");
      setStatus("error");
    } catch {
      setError("Something went wrong. Please email Ethan directly.");
      setStatus("error");
    }
  }

  return (
    <main className="bg-[#0c0c0c] text-[#F2EDE4] min-h-screen flex flex-col">
      <EthanNav />

      <section className="pt-40 md:pt-48 pb-14 px-6 text-center">
        <FadeUp>
          <p className="font-text text-[10px] md:text-[11px] tracking-[0.5em] uppercase text-[#C9A44C] mb-6">
            Reserve the Night
          </p>
          <h1 className="font-display text-[clamp(40px,6.5vw,78px)] font-light leading-[1.05] tracking-[0.02em]">
            Book a Dinner
          </h1>
          <p className="font-text text-[#A89F93] text-sm md:text-base max-w-xl mx-auto mt-7 leading-relaxed">
            Tell Ethan about the evening. He&apos;ll come back within 48 hours with a
            written menu and a flat per-guest price — no deposit until you&apos;ve seen both.
          </p>
          <div className="ethan-rule w-40 mx-auto mt-10" />
        </FadeUp>
      </section>

      <FadeUp delay={0.1} className="flex-1 px-6 pb-24 md:pb-32 w-full max-w-3xl mx-auto">
        {status === "sent" ? (
          <div className="border border-[#C9A44C]/35 bg-[#141210] p-10 md:p-16 text-center">
            <p className="font-display text-4xl md:text-5xl font-light text-[#C9A44C] mb-5">Request sent</p>
            <p className="font-text text-[#A89F93] leading-relaxed max-w-md mx-auto">
              Thanks, {form.firstName || "and talk soon"}. Ethan will be in touch within
              48 hours with a written menu and pricing for{" "}
              {form.eventDate ? (
                <span className="text-[#F2EDE4]">
                  {new Date(form.eventDate + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              ) : (
                "your night"
              )}
              .
            </p>
            <div className="ethan-rule w-32 mx-auto my-9" />
            <p className="font-text text-xs text-[#A89F93]/70">
              Need to add something?{" "}
              <a href="mailto:egsimpson03@gmail.com" className="text-[#C9A44C] hover:text-[#F2EDE4] transition-colors">
                egsimpson03@gmail.com
              </a>
            </p>
            <Link
              href="/ethan"
              className="font-text text-[11px] tracking-[0.3em] uppercase border border-[#C9A44C]/50 text-[#C9A44C] px-9 py-3.5 inline-block mt-9 hover:bg-[#C9A44C] hover:text-[#0c0c0c] transition-colors duration-300"
            >
              Back Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="border border-[#C9A44C]/20 bg-[#0c0c0c] p-7 md:p-12 flex flex-col gap-9">
            {/* ------------------------------------------------- Who you are */}
            <fieldset className="flex flex-col gap-5">
              <legend className="font-text text-[10px] tracking-[0.35em] uppercase text-[#C9A44C] mb-4">
                01 — Your Details
              </legend>

              <div className="grid sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2.5">
                  <label className={labelCls} htmlFor="firstName">First Name *</label>
                  <input id="firstName" required className={inputCls} placeholder="Jane"
                    value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className={labelCls} htmlFor="lastName">Last Name *</label>
                  <input id="lastName" required className={inputCls} placeholder="Smith"
                    value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2.5">
                  <label className={labelCls} htmlFor="email">Email *</label>
                  <input id="email" required type="email" className={inputCls} placeholder="jane@email.com"
                    value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className={labelCls} htmlFor="phone">Phone *</label>
                  <input id="phone" required type="tel" className={inputCls} placeholder="(512) 000-0000"
                    value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
              </div>
            </fieldset>

            <div className="ethan-rule" />

            {/* ---------------------------------------------------- The night */}
            <fieldset className="flex flex-col gap-5">
              <legend className="font-text text-[10px] tracking-[0.35em] uppercase text-[#C9A44C] mb-4">
                02 — The Night
              </legend>

              <div className="grid sm:grid-cols-3 gap-5">
                <div className="flex flex-col gap-2.5">
                  <label className={labelCls} htmlFor="eventDate">Date *</label>
                  <input id="eventDate" required type="date" className={inputCls}
                    min={new Date().toISOString().slice(0, 10)}
                    value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className={labelCls} htmlFor="eventTime">Start Time *</label>
                  <input id="eventTime" required type="time" className={inputCls}
                    value={form.eventTime} onChange={(e) => set("eventTime", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className={labelCls} htmlFor="guests">Guests *</label>
                  <input id="guests" required type="number" min={1} max={300} className={inputCls} placeholder="8"
                    value={form.guests} onChange={(e) => set("guests", e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <label className={labelCls} htmlFor="location">Where&apos;s the party? *</label>
                <input id="location" required className={inputCls} placeholder="123 Main St, Austin, TX 78701"
                  value={form.location} onChange={(e) => set("location", e.target.value)} />
              </div>

              <div className="flex flex-col gap-3.5">
                <span className={labelCls}>Occasion</span>
                <div className="flex flex-wrap gap-2.5">
                  {EVENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEventType((cur) => (cur === t ? "" : t))}
                      className={`font-text text-xs px-5 py-2.5 border transition-all duration-200 ${
                        eventType === t
                          ? "border-[#C9A44C] text-[#C9A44C] bg-[#C9A44C]/10"
                          : "border-[#C9A44C]/20 text-[#A89F93] hover:border-[#C9A44C]/50 hover:text-[#F2EDE4]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>

            <div className="ethan-rule" />

            {/* ----------------------------------------------------- The menu */}
            <fieldset className="flex flex-col gap-5">
              <legend className="font-text text-[10px] tracking-[0.35em] uppercase text-[#C9A44C] mb-4">
                03 — The Menu *
              </legend>

              <div className="grid sm:grid-cols-2 gap-4">
                {ETHAN_MENUS.map((m) => {
                  const active = menuStyle === m.name;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMenuStyle(m.name); setError(""); }}
                      aria-pressed={active}
                      className={`text-left p-6 border transition-all duration-300 ${
                        active
                          ? "border-[#C9A44C] bg-[#C9A44C]/10"
                          : "border-[#C9A44C]/20 bg-[#141210] hover:border-[#C9A44C]/50"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={`font-display text-2xl tracking-[0.03em] ${active ? "text-[#C9A44C]" : "text-[#F2EDE4]"}`}>
                          {m.name}
                        </span>
                        <span className={`text-[10px] ${active ? "text-[#C9A44C]" : "text-[#C9A44C]/40"}`}>◆</span>
                      </div>
                      <p className="font-text text-[10px] tracking-[0.22em] uppercase text-[#A89F93] mt-2">
                        {m.tagline}
                      </p>
                      <p className="font-text text-xs text-[#A89F93] leading-relaxed mt-4">
                        {m.id === "classic"
                          ? "Steak and potatoes, with a vegetable that earns its place."
                          : m.id === "custom"
                            ? "Tell him the idea and he'll write the menu around it."
                            : m.description.split(".")[0] + "."}
                      </p>
                    </button>
                  );
                })}
              </div>

              {menuStyle === "Custom" && (
                <div className="flex flex-col gap-2.5">
                  <label className={labelCls} htmlFor="customMenu">What do you have in mind? *</label>
                  <textarea id="customMenu" required rows={4} className={`${inputCls} resize-y`}
                    placeholder="Dishes you love, a cuisine you've been wanting, a family recipe, the dish from that trip…"
                    value={form.customMenu} onChange={(e) => set("customMenu", e.target.value)} />
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <label className={labelCls} htmlFor="dietary">Allergies & Dietary Needs</label>
                <input id="dietary" className={inputCls}
                  placeholder="Shellfish allergy, one vegetarian, gluten free…"
                  value={form.dietary} onChange={(e) => set("dietary", e.target.value)} />
              </div>

              <div className="flex flex-col gap-2.5">
                <label className={labelCls} htmlFor="notes">Notes</label>
                <textarea id="notes" rows={5} className={`${inputCls} resize-y`}
                  placeholder="Anything else that would help — the occasion, the kitchen setup, whether you'd like wine pairings, how late you're hoping to run."
                  value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </fieldset>

            {error && (
              <p className="font-text text-sm text-[#E0796B] border border-[#E0796B]/35 bg-[#E0796B]/5 px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="font-text text-[11px] tracking-[0.3em] uppercase bg-[#C9A44C] text-[#0c0c0c] px-10 py-4 hover:bg-[#F2EDE4] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "sending" ? "Sending…" : "Send Request"}
            </button>

            <p className="font-text text-[11px] text-[#A89F93]/60 text-center leading-relaxed">
              This is a request, not a confirmed booking — nothing is charged here. Ethan
              will confirm availability by email.
            </p>
          </form>
        )}
      </FadeUp>

      <EthanFooter />
    </main>
  );
}
