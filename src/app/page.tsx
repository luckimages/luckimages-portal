import Link from "next/link";

const SERVICES = [
  { name: "Listing Photos", icon: "◻", slug: "listing-photos" },
  { name: "Video", icon: "▷", slug: "video" },
  { name: "Twilight", icon: "◑", slug: "twilight" },
  { name: "Drone", icon: "◈", slug: "drone" },
  { name: "Matterport", icon: "◎", slug: "matterport" },
  { name: "Virtual Staging", icon: "⬡", slug: "virtual-staging" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* NAV */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-6">
        <span className="text-xl font-black tracking-tight uppercase">Luck Images</span>
        <div className="flex items-center gap-8">
          <a href="#services" className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">Services</a>
          <a href="#about" className="text-xs tracking-[3px] uppercase text-white/60 hover:text-white transition-colors">About</a>
          <Link href="/login" className="text-xs tracking-[3px] uppercase border border-white/25 px-5 py-2.5 hover:border-white hover:bg-white/5 transition-all">
            Login
          </Link>
        </div>
      </nav>

      {/* HERO — video background */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 py-40 min-h-screen overflow-hidden">

        {/* Hero background — swap to <video> when ready */}
        <img
          src="/hero.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0c]/60 via-transparent to-[#0c0c0c]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="text-xs tracking-[4px] uppercase text-white/50 mb-6">Austin, TX — Real Estate Media</p>
          <h1 className="text-[clamp(48px,8vw,96px)] font-black tracking-tight leading-none uppercase mb-8">
            LUCK IMAGES
          </h1>
          <p className="text-white/50 text-lg max-w-md mb-12 leading-relaxed">
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
      <section id="services" className="px-8 py-20">
        <p className="text-xs tracking-[4px] uppercase text-[#666] text-center mb-14">Services</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-white/5 border border-white/10 max-w-5xl mx-auto overflow-hidden">
          {SERVICES.map((s) => (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#0c0c0c] p-8 flex flex-col items-center gap-4 hover:bg-[#181818] transition-colors group"
            >
              <span className="text-2xl text-[#444] group-hover:text-white transition-colors">{s.icon}</span>
              <span className="text-xs tracking-[2px] uppercase text-[#666] group-hover:text-white transition-colors text-center">{s.name}</span>
              <span className="text-[10px] tracking-[2px] uppercase text-[#333] group-hover:text-[#666] transition-colors">Learn More →</span>
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
