import HeroParallax from "@/components/HeroParallax";
import HomeNav from "@/components/HomeNav";
import HeroContent from "@/components/HeroContent";
import ServicesGrid from "@/components/ServicesGrid";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* NAV */}
      <HomeNav />

      {/* HERO */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 py-24 md:py-40 min-h-screen overflow-hidden">

        <HeroParallax />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0c]/60 via-transparent to-[#0c0c0c]" />

        {/* Content */}
        <HeroContent />
      </section>


      {/* SERVICES */}

      <section id="services" className="px-8 pb-16">
        <ServicesGrid />
      </section>

      {/* LOGO MARQUEE */}
      <section className="py-8 border-y border-white/10 overflow-hidden">
        <div className="flex w-max animate-marquee">
          {[...Array(2)].map((_, copy) => (
            <div key={copy} className="flex items-center gap-14 px-14">
              {[
                "Compass", "Keller Williams", "eXp Realty", "RE/MAX",
                "Coldwell Banker", "Century 21", "Sotheby's International Realty",
                "Douglas Elliman", "Berkshire Hathaway HomeServices", "United Real Estate",
                "Better Homes & Gardens", "Moreland Properties",
              ].map((name) => (
                <span key={name + copy} className="text-[11px] tracking-[4px] uppercase font-semibold text-white/30 whitespace-nowrap">
                  {name}
                </span>
              ))}
            </div>
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
