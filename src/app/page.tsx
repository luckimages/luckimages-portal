import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* NAV */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <span className="text-xl font-black tracking-tight uppercase">
          Luck Images
        </span>
        <div className="flex items-center gap-8">
          <a href="#services" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">
            Services
          </a>
          <a href="#about" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">
            About
          </a>
          <Link
            href="/login"
            className="text-xs tracking-[3px] uppercase border border-white/25 px-5 py-2.5 hover:border-white hover:bg-white/5 transition-all"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32">
        <p className="text-xs tracking-[4px] uppercase text-[#666] mb-6">
          Austin, TX — Real Estate Media
        </p>
        <h1 className="text-[clamp(48px,8vw,96px)] font-black tracking-tight leading-none uppercase mb-8">
          LUCK IMAGES
        </h1>
        <p className="text-[#666] text-lg max-w-md mb-12 leading-relaxed">
          Photography. Drone. Matterport. Video. Headshots.
          <br />
          Built for agents who move fast.
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="text-xs tracking-[3px] uppercase bg-white text-black px-8 py-4 font-semibold hover:bg-white/90 transition-colors"
          >
            Client Portal
          </Link>
          <a
            href="#services"
            className="text-xs tracking-[3px] uppercase border border-white/25 px-8 py-4 hover:border-white hover:bg-white/5 transition-all"
          >
            Our Work
          </a>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="border-t border-white/10 px-8 py-20">
        <p className="text-xs tracking-[4px] uppercase text-[#666] text-center mb-14">Services</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px border border-white/10 max-w-5xl mx-auto">
          {[
            { name: "Listing Photos", icon: "◻" },
            { name: "Drone", icon: "◈" },
            { name: "Matterport", icon: "◎" },
            { name: "Video", icon: "▷" },
            { name: "Headshots", icon: "◉" },
          ].map((s) => (
            <div
              key={s.name}
              className="bg-[#111] p-8 flex flex-col items-center gap-4 hover:bg-[#181818] transition-colors"
            >
              <span className="text-2xl text-[#444]">{s.icon}</span>
              <span className="text-xs tracking-[2px] uppercase text-[#888] text-center">
                {s.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">
          © 2026 Luck Images
        </span>
        <a
          href="mailto:ryan@luckimages.com"
          className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors"
        >
          ryan@luckimages.com
        </a>
      </footer>

    </main>
  );
}
