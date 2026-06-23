import HomeNav from "@/components/HomeNav";
import Link from "next/link";

const STATS = [
  { value: "4+", label: "Years in Austin" },
  { value: "500+", label: "Properties Shot" },
  { value: "48hr", label: "Turnaround" },
  { value: "10+", label: "Photographers (Goal)" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />

      {/* Header */}
      <div className="pt-32 pb-20 text-center px-6">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4">Who We Are</p>
        <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-8">
          Luck Images
        </h1>
        <p className="text-[#666] text-lg max-w-2xl mx-auto leading-relaxed">
          Austin's real estate media company. We make properties look exactly as good as they are — and then some.
        </p>
      </div>

      {/* Stats bar */}
      <section className="border-y border-white/10 px-6 py-10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-black mb-2">{s.value}</p>
              <p className="text-xs tracking-[2px] uppercase text-[#555]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="px-6 py-24 max-w-4xl mx-auto w-full text-center">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4">Our Mission</p>
        <h2 className="text-[clamp(28px,4vw,52px)] font-black tracking-tight uppercase mb-8 leading-tight">
          Every Listing Deserves<br />World-Class Media
        </h2>
        <p className="text-[#666] text-lg max-w-2xl mx-auto leading-relaxed">
          We started Luck Images because we saw how much bad photography was costing Austin agents — longer days on market, lower offers, fewer callbacks. Our job is to eliminate that problem with photography, video, and virtual tours that make buyers stop scrolling.
        </p>
      </section>

      {/* Founder section */}
      <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-12 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          The Team
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <img
              src="/ryan-headshot.jpg"
              alt="Ryan Luck"
              className="w-full object-cover"
              style={{ maxHeight: "600px", objectPosition: "top" }}
            />
          </div>
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-3">Founder & Lead Photographer</p>
              <h2 className="text-4xl font-black tracking-tight uppercase mb-6">Ryan Luck</h2>
            </div>
            <p className="text-[#888] leading-relaxed">
              Born and raised in Austin, Ryan has spent over a decade behind the camera and the last four years building Luck Images into the go-to real estate media company for agents across Central Texas.
            </p>
            <p className="text-[#888] leading-relaxed">
              His approach is simple: show up prepared, shoot fast, deliver fast, and make every property look its absolute best. Technical precision meets genuine care for the people he works with — and it shows in the results.
            </p>
            <p className="text-[#888] leading-relaxed">
              As Luck Images grows into a statewide team, Ryan stays hands-on with quality, client relationships, and the work itself.
            </p>
            <p className="text-white/40 text-sm tracking-[2px] mt-2">— Ryan Luck</p>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="border-t border-white/10 px-6 py-24 bg-[#080808]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4">Where We're Headed</p>
          <h2 className="text-[clamp(28px,4vw,52px)] font-black tracking-tight uppercase mb-8">
            Built to Scale Across Texas
          </h2>
          <p className="text-[#666] text-lg max-w-2xl mx-auto leading-relaxed mb-12">
            What started as one photographer with a camera and a vision is growing into something much bigger. Our goal is a 10+ photographer team covering markets across the entire state — bringing the same quality and reliability that Austin agents have come to count on, everywhere in Texas.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/contact" className="text-xs tracking-[3px] uppercase bg-white text-black px-10 py-4 font-semibold hover:bg-white/90 transition-colors">
              Work With Us
            </Link>
            <Link href="/pricing" className="text-xs tracking-[3px] uppercase border border-white/25 px-10 py-4 hover:border-white hover:bg-white/5 transition-all">
              See Pricing
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</a>
      </footer>
    </main>
  );
}
