import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Noah Esterling — Private Chef & Meal Prep | Austin, TX",
  description: "Private chef and meal prep services in Austin, TX. Custom weekly meal plans, private dinner events, and personal nutrition consulting. Book Noah Esterling.",
};

const services = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    name: "Weekly Meal Prep",
    slug: "meal-prep",
    tagline: "Your week. Handled.",
    description:
      "Every Sunday, Noah shops, preps, and delivers a full week of restaurant-quality meals calibrated to your macros, preferences, and schedule. No cooking, no planning, no thinking.",
    details: ["7-day meal plans", "Custom macros & dietary needs", "Portioned + labeled + delivered", "Menu rotates weekly"],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.387Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
      </svg>
    ),
    name: "Private Dinner Events",
    slug: "private-dining",
    tagline: "Fine dining in your home.",
    description:
      "Noah handles everything — the shopping, the mise en place, the cooking, and the cleanup. You show up to your own dinner party and enjoy it. From intimate date nights to 20-person events.",
    details: ["2–20 guests", "Custom multi-course menus", "Wine pairing suggestions", "Full kitchen cleanup"],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      </svg>
    ),
    name: "Nutrition Consulting",
    slug: "consulting",
    tagline: "Eat with intention.",
    description:
      "One-on-one sessions to build a food strategy around your body, goals, and lifestyle. Whether you're training for something or just tired of guessing — Noah translates nutrition science into actual food you'll eat.",
    details: ["Initial 90-min intake call", "Personalized nutrition roadmap", "Weekly check-ins", "Flexible add-on to meal prep"],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
    name: "Group & Corporate",
    slug: "corporate",
    tagline: "Feed your team well.",
    description:
      "Office lunches, team offsites, client dinners, and company celebrations. Noah brings the same care and quality to group settings — without the catering-company rigidity.",
    details: ["10–100+ guests", "Buffet, plated, or family style", "Dietary accommodations handled", "Recurring contracts available"],
  },
];

const faqs = [
  {
    q: "What areas do you serve?",
    a: "Noah is based in Austin and serves the greater Austin metro area — downtown, South Austin, North Austin, Westlake, Cedar Park, and surrounding neighborhoods. Travel fees may apply beyond 25 miles.",
  },
  {
    q: "How does weekly meal prep work?",
    a: "You fill out a quick intake form covering your dietary preferences, allergies, and goals. Noah designs that week's menu, shops for fresh ingredients, preps everything in your kitchen (or his), and delivers labeled, portioned meals — usually on Sunday for the week ahead.",
  },
  {
    q: "Do I need to provide anything for a private dinner event?",
    a: "Just your kitchen and your guests. Noah handles the grocery shopping, prep, cooking, plating, and full cleanup. You don't lift a finger.",
  },
  {
    q: "How far in advance should I book?",
    a: "For weekly meal prep, 3–5 days notice is usually enough. For private dinners and events, 1–2 weeks is ideal. For large group events, 2–4 weeks is recommended.",
  },
  {
    q: "Do you accommodate dietary restrictions?",
    a: "Yes — keto, paleo, vegan, gluten-free, dairy-free, specific allergies, religious dietary requirements. Just note them in your inquiry and Noah will build your menu around them.",
  },
];

export default function NoahPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10 absolute w-full z-20" style={{ textShadow: "0 2px 12px rgba(0,0,0,1)" }}>
        <Link href="/" className="text-sm font-black tracking-tight uppercase hover:opacity-70 transition-opacity text-white/40">
          ← Luck Images
        </Link>
        <a
          href="mailto:noah@example.com"
          className="text-xs tracking-[3px] uppercase border border-white/20 px-5 py-2.5 hover:border-white/60 hover:bg-white/5 transition-all"
        >
          Book Now
        </a>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[#0c0c0c]">
          {/* Abstract food-inspired background */}
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(ellipse 80% 50% at 20% 40%, #d97706 0%, transparent 60%),
                                radial-gradient(ellipse 60% 40% at 80% 60%, #b45309 0%, transparent 50%),
                                radial-gradient(ellipse 40% 60% at 50% 80%, #78350f 0%, transparent 60%)`,
            }}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0c]/40 via-transparent to-[#0c0c0c]" />

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <p className="text-xs tracking-[6px] uppercase text-amber-400/70 mb-6">Austin, Texas</p>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight uppercase leading-none mb-6">
            Noah<br />
            <span className="text-amber-400">Esterling</span>
          </h1>
          <p className="text-sm tracking-[4px] uppercase text-white/40 mb-8">Private Chef · Meal Prep · Nutrition</p>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-12 leading-relaxed">
            Restaurant-quality food in your home, on your schedule. Weekly meal prep, private dinners, and nutrition consulting — all in Austin, TX.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="mailto:noah@example.com"
              className="px-10 py-4 bg-amber-400 text-black text-xs font-bold tracking-[3px] uppercase hover:bg-amber-300 transition-colors"
            >
              Book a Consult →
            </a>
            <a
              href="tel:+15125550000"
              className="px-10 py-4 border border-white/30 text-xs font-bold tracking-[3px] uppercase hover:border-white hover:bg-white/5 transition-all"
            >
              (512) 555-0000
            </a>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30">
          <span className="text-[10px] tracking-[3px] uppercase">Scroll</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 animate-bounce">
            <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
          </svg>
        </div>
      </section>

      {/* Intro / About */}
      <section className="px-6 md:px-16 py-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-amber-400/70 mb-4">About Noah</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-6">
              Food that actually fits your life.
            </h2>
            <p className="text-white/50 leading-relaxed mb-4">
              Noah Esterling has spent years cooking professionally — from fine dining kitchens to private households in Austin. He left the restaurant world to do one thing: bring that same level of quality directly to people who care about what they eat but don't have time to cook it.
            </p>
            <p className="text-white/50 leading-relaxed">
              Whether you're an athlete dialing in macros, a busy executive who eats terribly on the road, or a couple who wants to host a dinner party without the stress — Noah builds the food around your actual life.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { num: "5+", label: "Years professional cooking" },
              { num: "50+", label: "Weekly meal prep clients served" },
              { num: "200+", label: "Private dinners executed" },
              { num: "100%", label: "Satisfied or re-cooked free" },
            ].map((stat) => (
              <div key={stat.num} className="border border-white/10 p-6 bg-white/[0.02]">
                <p className="text-3xl font-black text-amber-400 mb-1">{stat.num}</p>
                <p className="text-xs text-white/40 leading-snug">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="px-6 md:px-16 py-20 max-w-5xl mx-auto border-t border-white/5">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-16 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          Services
        </p>
        <div className="space-y-16">
          {services.map((s, i) => (
            <div key={s.slug} className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-start ${i % 2 === 1 ? "md:[direction:rtl] [&>*]:[direction:ltr]" : ""}`}>
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-amber-400">{s.icon}</span>
                  <div>
                    <h2 className="text-sm font-bold tracking-[3px] uppercase">{s.name}</h2>
                    <p className="text-xs text-amber-400/60 tracking-[1px] mt-0.5">{s.tagline}</p>
                  </div>
                </div>
                <p className="text-sm text-white/50 leading-relaxed mb-6">{s.description}</p>
                <ul className="space-y-2">
                  {s.details.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-xs text-white/40">
                      <span className="w-1 h-1 rounded-full bg-amber-400/60 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Placeholder visual */}
              <div className="aspect-[4/3] bg-[#111] border border-white/5 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `radial-gradient(ellipse 60% 60% at 50% 50%, #d97706 0%, transparent 70%)`,
                  }}
                />
                <div className="relative text-center">
                  <span className="text-amber-400 opacity-30 block mb-2">{s.icon}</span>
                  <span className="text-[10px] tracking-[2px] uppercase text-white/20">{s.name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 md:px-16 py-20 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-12 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            How It Works
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Intake Call", body: "15-minute call to discuss your goals, preferences, allergies, and schedule." },
              { step: "02", title: "Custom Menu", body: "Noah designs a menu built specifically for you and sends it for approval." },
              { step: "03", title: "He Cooks", body: "Noah handles all shopping, prep, cooking, and cleanup. You don't lift a finger." },
              { step: "04", title: "You Eat", body: "Labeled, portioned, and ready when you are. All week, every week." },
            ].map((item) => (
              <div key={item.step} className="border border-white/10 p-6 relative">
                <p className="text-4xl font-black text-white/5 absolute top-4 right-4">{item.step}</p>
                <p className="text-xs tracking-[3px] uppercase text-amber-400/60 mb-3">{item.step}</p>
                <h3 className="text-sm font-bold uppercase tracking-wide mb-2">{item.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 md:px-16 py-20 max-w-5xl mx-auto border-t border-white/5">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-10 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          FAQ
        </p>
        <div className="space-y-6">
          {faqs.map((faq) => (
            <div key={faq.q} className="border-b border-white/10 pb-6">
              <h3 className="text-sm font-bold mb-2">{faq.q}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-16 py-28 border-t border-white/5">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs tracking-[5px] uppercase text-amber-400/60 mb-4">Ready to eat better?</p>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-6">
            Let&apos;s talk food.
          </h2>
          <p className="text-white/40 text-sm max-w-md mx-auto mb-10">
            Send a quick message and Noah will reach out within 24 hours to set up a free 15-minute intake call.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="mailto:noah@example.com"
              className="px-12 py-5 bg-amber-400 text-black text-xs font-bold tracking-[3px] uppercase hover:bg-amber-300 transition-colors"
            >
              Send a Message →
            </a>
            <a
              href="tel:+15125550000"
              className="px-12 py-5 border border-white/20 text-xs font-bold tracking-[3px] uppercase hover:border-white/60 transition-all"
            >
              (512) 555-0000
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-8 py-8 text-center">
        <p className="text-xs tracking-[3px] uppercase text-white/20 mb-1">
          Noah Esterling — Private Chef · Austin, TX
        </p>
        <p className="text-[10px] text-white/10 tracking-[2px] uppercase">
          Site built by{" "}
          <Link href="/" className="hover:text-white/30 transition-colors">Luck Images</Link>
        </p>
      </footer>

    </main>
  );
}
