import Link from "next/link";
import HeroParallax from "@/components/HeroParallax";
import HomeNav from "@/components/HomeNav";
import { SERVICES } from "@/lib/services";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* NAV */}
      <HomeNav />

      {/* HERO */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 py-40 min-h-screen overflow-hidden">

        <HeroParallax />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0c]/60 via-transparent to-[#0c0c0c]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="text-xs tracking-[4px] uppercase text-white mb-6" style={{textShadow:"0 2px 12px rgba(0,0,0,0.8)"}}>Austin, TX — Real Estate Media</p>
          <h1 className="text-[clamp(48px,8vw,96px)] font-black tracking-tight leading-none uppercase mb-8" style={{textShadow:"0 4px 24px rgba(0,0,0,0.7)"}}>
            LUCK IMAGES
          </h1>
          <p className="text-white text-lg max-w-md mb-12 leading-relaxed" style={{textShadow:"0 2px 12px rgba(0,0,0,0.8)"}}>
            Photography. Drone. Matterport. Video.
            <br />
            Built for agents who move fast.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login" className="text-xs tracking-[3px] uppercase bg-white text-black px-8 py-4 font-semibold hover:bg-white/90 transition-colors">
              Client Portal
            </Link>
            <a href="#services" className="text-xs tracking-[3px] uppercase border border-white/25 px-8 py-4 hover:border-white hover:bg-white/5 transition-all">
              Our Services
            </a>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="px-8 pb-20 -mt-1">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 max-w-6xl mx-auto border border-white/20 gap-px bg-white/20">
          {SERVICES.map((s) => (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#0c0c0c] p-8 flex flex-col items-center gap-4 hover:bg-white/5 transition-colors group"
            >
              <span className="text-white/50 group-hover:text-white transition-colors">{s.icon}</span>
              <span className="text-xs tracking-[2px] uppercase text-white/60 group-hover:text-white transition-colors text-center">{s.name}</span>
              <span className="text-[10px] tracking-[2px] uppercase text-white/30 group-hover:text-white/60 transition-colors">Learn More →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">
          ryan@luckimages.com
        </a>
      </footer>

    </main>
  );
}
