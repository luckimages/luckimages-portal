import HomeNav from "@/components/HomeNav";
import FadeUp from "@/components/FadeUp";

const STATS = [
  { value: "5", label: "Years in Business" },
  { value: "500+", label: "Properties Shot" },
  { value: "24hr", label: "Turnaround" },
  { value: "10+", label: "Years in Real Estate" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />

      {/* Header */}
      <section className="relative overflow-hidden pt-40 pb-24 px-6 text-center">
        {/* B&W drone backdrop, fading into black — same treatment as the home hero */}
        <img
          src="/hero-1.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center grayscale opacity-40 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0c]/80 via-[#0c0c0c]/40 to-[#0c0c0c]" />
        <FadeUp className="relative z-10">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4">Who We Are</p>
          <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-8">
            Luck Images
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto leading-relaxed">
            Luck Images produces premium Real Estate media for Austin's top agents and developers. Why leave your listing to chance when you can have Luck on your side?
          </p>
        </FadeUp>
      </section>

      {/* Stats bar */}
      <FadeUp>
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
      </FadeUp>

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
            </div>
          </div>
        </section>
      </FadeUp>

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</a>
      </footer>
    </main>
  );
}
