import HomeNav from "@/components/HomeNav";
import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />

      {/* Header */}
      <div className="pt-32 pb-16 text-center px-6">
        <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase">About</h1>
      </div>


      {/* Bio section */}
      <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">

          {/* Headshot */}
          <div className="relative">
            <img
              src="/ryan-headshot.jpg"
              alt="Ryan Luck"
              className="w-full object-cover"
              style={{ maxHeight: "600px", objectPosition: "top" }}
            />
          </div>

          {/* Bio text */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-3">Founder</p>
              <h2 className="text-4xl font-black tracking-tight uppercase mb-6">Ryan Luck</h2>
            </div>

            <p className="text-[#888] leading-relaxed">
              I'm Ryan Luck — a 23-year-old Austin native who's been behind the camera for over a decade. Born and raised here, I know this city inside and out, from each neighborhood to what makes every listing unique. Luck Images has been based out of Austin, TX since its founding in 2021.
            </p>
            <p className="text-[#888] leading-relaxed">
              I spent the last four years specializing in real estate photography, helping agents and homeowners showcase properties in a way that's clean, compelling, and built to draw in buyers. My approach blends technical precision with an eye for detail, ensuring every space is presented at its absolute best.
            </p>
            <p className="text-[#888] leading-relaxed">
              I'm grateful to document Austin's quickly changing landscape — and I look forward to the opportunity to work with you.
            </p>

            <p className="text-white/40 text-sm tracking-[2px] mt-2">— Ryan Luck</p>
          </div>
        </div>
      </section>

      {/* Vision section */}
      <section className="border-t border-white/10 px-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-4">Where We're Headed</p>
          <h2 className="text-[clamp(28px,4vw,52px)] font-black tracking-tight uppercase mb-8">
            Built to Scale Across Texas
          </h2>
          <p className="text-[#666] text-lg max-w-2xl mx-auto leading-relaxed mb-12">
            What started as one photographer with a camera and a vision is growing into something much bigger. Our goal is a 10+ photographer team covering markets across the entire state — bringing the same quality and reliability that Austin agents have come to expect, everywhere in Texas.
          </p>
          <Link href="/contact" className="text-xs tracking-[3px] uppercase bg-white text-black px-10 py-4 font-semibold hover:bg-white/90 transition-colors">
            Work With Us
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</a>
      </footer>
    </main>
  );
}
