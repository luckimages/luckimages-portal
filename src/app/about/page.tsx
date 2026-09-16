import type { Metadata } from "next";
import HomeNav from "@/components/HomeNav";
import FadeUp from "@/components/FadeUp";

export const metadata: Metadata = {
  title: "About — Luck Images | Austin Real Estate Photography",
  description: "Meet the team behind Luck Images — Austin real estate photography, drone, Matterport, and video for agents who move fast.",
  openGraph: {
    title: "About — Luck Images | Austin Real Estate Photography",
    description: "Meet the team behind Luck Images — Austin real estate photography, drone, Matterport, and video for agents who move fast.",
    url: "https://www.luckimages.com/about",
  },
  twitter: {
    card: "summary",
    title: "About — Luck Images | Austin Real Estate Photography",
    description: "Meet the team behind Luck Images — Austin real estate photography, drone, Matterport, and video.",
  },
};

const STATS = [
  { value: "6", label: "Years in Business" },
  { value: "800+", label: "Properties Shot" },
  { value: "1.4M", label: "SQ FT Captured" },
  { value: "24hr", label: "Turnaround" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />

      {/* Header — title, caption, and stats over a B&W aerial that fades to black */}
      <section className="relative overflow-hidden pt-40 pb-16 px-6 text-center border-b border-white/10">
        <img
          src="/hero-4.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center grayscale opacity-90 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0c]/30 via-[#0c0c0c]/40 to-[#0c0c0c]" />
        <div className="relative z-10">
          <FadeUp className="[&_*]:[text-shadow:0_2px_40px_rgba(0,0,0,0.95),0_1px_12px_rgba(0,0,0,0.9)]">
            <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-8">
              Luck Images
            </h1>
            <p className="text-white text-lg max-w-2xl mx-auto leading-relaxed">
              Luck Images produces premium Real Estate media for Austin's top agents and developers. Why leave your listing to chance when you can have Luck on your side?
            </p>
          </FadeUp>
          <FadeUp delay={0.15} className="mt-16 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(s => (
              <div key={s.label} className="text-center [text-shadow:0_2px_24px_rgba(0,0,0,0.9)]">
                <p className="text-4xl font-black mb-2">{s.value}</p>
                <p className="text-xs tracking-[2px] uppercase text-white/50">{s.label}</p>
              </div>
            ))}
          </FadeUp>
        </div>
      </section>

      {/* Founder section */}
      <FadeUp>
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
                Born and raised in Austin, Ryan Luck has spent more than a decade behind the camera. What started as a passion for photography grew into what is today Luck Images, a team dedicated to serving Real Estate agents throughout the greater Austin area.
              </p>
              <p className="text-[#888] leading-relaxed">
                Over the years Ryan has developed an eye for clear imagery and the details that make a listing stand out. He believes great Real Estate media should feel clean, natural, and inviting.
              </p>
              <p className="text-[#888] leading-relaxed">
                Ryan's focus is on capturing what makes each home unique, while providing clients with a simple and seamless experience.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-white/10 mt-2">
                <a href="tel:5123751585" className="text-sm text-[#888] hover:text-white transition-colors">(512) 375-1585</a>
                <a href="/contact" className="text-sm text-[#888] hover:text-white transition-colors">ryan@luckimages.com</a>
              </div>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* COO section */}
      <FadeUp>
        <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <img
                src="/leif-headshot.jpg"
                alt="Leif Tilton"
                className="w-full object-cover"
                style={{ maxHeight: "600px", objectPosition: "top" }}
              />
            </div>
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-xs tracking-[4px] uppercase text-[#555] mb-3">Chief Operating Officer</p>
                <h2 className="text-4xl font-black tracking-tight uppercase mb-6">Leif Tilton</h2>
              </div>
              <p className="text-[#888] leading-relaxed">
                Leif Tilton serves as Chief Operating Officer at Luck Images, overseeing the business and client experience that supports the company's growing team and its Real Estate clients throughout the greater Austin area.
              </p>
              <p className="text-[#888] leading-relaxed">
                With a background in management and team leadership, Leif brings an organized, relationship-focused approach to the business. His focus is on making every part of the Luck Images experience simple and reliable, from the first point of contact and scheduling to communication, delivery, and ongoing client relationships.
              </p>
              <p className="text-[#888] leading-relaxed">
                Leif works closely with the Luck Images team to strengthen operations, develop client relationships, and build systems that allow the company to continue growing while maintaining the quality and personal service its clients expect.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-white/10 mt-2">
                <a href="tel:5125089424" className="text-sm text-[#888] hover:text-white transition-colors">(512) 508-9424</a>
                <a href="/contact" className="text-sm text-[#888] hover:text-white transition-colors">leif@luckimages.com</a>
              </div>
            </div>
          </div>
        </section>
      </FadeUp>

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <div className="flex items-center gap-4">
          <a href="/contact" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</a>
          <a href="/contact" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">leif@luckimages.com</a>
        </div>
      </footer>
    </main>
  );
}
