import Image from "next/image";
import Link from "next/link";
import EthanNav from "@/components/ethan/EthanNav";
import EthanFooter from "@/components/ethan/EthanFooter";
import FadeUp from "@/components/FadeUp";
import { ETHAN_MENUS } from "@/lib/ethanMenus";

const SERVICES = [
  {
    n: "01",
    title: "Private Dinner Parties",
    copy:
      "A multi-course dinner cooked in your kitchen and served at your table. Ethan arrives with everything, cooks through the evening, and leaves the kitchen cleaner than he found it.",
    meta: "2–14 guests · 3 to 6 courses",
    image: "/portfolio/listing-photos/5409Hitcherbend-18.jpg",
    alt: "Dining table set for an intimate dinner",
  },
  {
    n: "02",
    title: "Event Catering",
    copy:
      "Rehearsal dinners, milestone birthdays, holiday parties, company gatherings. Passed bites and stations, or a seated meal for the whole room — built to the headcount and the space.",
    meta: "15–120 guests · Passed, stations, or seated",
    image: "/portfolio/twilight/15101JosephDr-49.jpg",
    alt: "Evening patio set up for an event",
  },
  {
    n: "03",
    title: "Standing Service",
    copy:
      "A weekly or biweekly night where dinner is simply handled. Same chef, rotating menu, cooked fresh in your kitchen — or prepped, labeled, and left ready for the week ahead.",
    meta: "Weekly or biweekly · Ongoing",
    image: "/portfolio/listing-photos/800embassy212-9.jpg",
    alt: "Modern kitchen with natural light",
  },
];

const STEPS = [
  { n: "01", title: "Tell him the night", copy: "Date, time, headcount, and the room you'd like to eat in." },
  { n: "02", title: "Choose a direction", copy: "Classic, Italian, French — or hand him an idea and let him write it." },
  { n: "03", title: "Review the menu", copy: "A written menu comes back within 48 hours, with a flat per-guest price." },
  { n: "04", title: "Sit down to dinner", copy: "He shops, cooks, serves, and cleans. You don't touch a dish." },
];

const GALLERY = [
  { src: "/portfolio/listing-photos/593CrosswaterLn-31.jpg", alt: "Dining room with wood ceiling" },
  { src: "/portfolio/listing-photos/593CrosswaterLn-59.jpg", alt: "Covered outdoor dining space" },
  { src: "/portfolio/listing-photos/2506CarlowDr-10.jpg", alt: "Sitting room ready for guests" },
  { src: "/portfolio/twilight/15101JosephDr-1.jpg", alt: "Home at twilight before a dinner party" },
];

export default function EthanHome() {
  return (
    <main className="bg-[#0c0c0c] text-[#F2EDE4] min-h-screen">
      <EthanNav />

      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative h-[100svh] min-h-[620px] flex items-center justify-center overflow-hidden">
        <Image
          src="/portfolio/listing-photos/104WesthavenDrive-11.jpg"
          alt="Chef's kitchen with a professional range"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0c]/85 via-[#0c0c0c]/70 to-[#0c0c0c]" />

        <div className="relative z-10 px-6 text-center max-w-4xl">
          <FadeUp>
            <p className="font-text text-[10px] md:text-[11px] tracking-[0.5em] uppercase text-[#C9A44C] mb-7">
              Private Chef · Austin, Texas
            </p>
          </FadeUp>

          <FadeUp delay={0.1}>
            <h1 className="font-display text-[clamp(44px,8vw,96px)] leading-[1.02] tracking-[0.02em] font-light">
              Dinner, cooked in
              <span className="block italic text-[#C9A44C]">your kitchen.</span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.2}>
            <p className="font-text text-[#A89F93] text-base md:text-lg leading-relaxed max-w-xl mx-auto mt-8">
              Restaurant cooking without the reservation, the drive, or the table they
              need back by nine. Private dinner parties and catering across Austin.
            </p>
          </FadeUp>

          <FadeUp delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-11">
              <Link
                href="/ethan/book"
                className="font-text text-[11px] tracking-[0.3em] uppercase bg-[#C9A44C] text-[#0c0c0c] px-10 py-4 hover:bg-[#F2EDE4] transition-colors duration-300"
              >
                Book a Dinner
              </Link>
              <Link
                href="#menus"
                className="font-text text-[11px] tracking-[0.3em] uppercase border border-[#F2EDE4]/25 text-[#F2EDE4] px-10 py-4 hover:border-[#C9A44C] hover:text-[#C9A44C] transition-colors duration-300"
              >
                See the Menus
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ----------------------------------------------------------- Statement */}
      <section className="px-6 py-24 md:py-32 max-w-4xl mx-auto text-center">
        <FadeUp>
          <div className="ethan-rule w-40 mx-auto mb-12" />
          <p className="font-display text-[clamp(24px,3.4vw,38px)] leading-[1.45] font-light text-[#F2EDE4]">
            Ethan cooks on the line at one of Austin&apos;s best restaurants. On his
            nights off, he brings that kitchen to{" "}
            <span className="italic text-[#C9A44C]">your table</span> — for eight people
            or eighty.
          </p>
        </FadeUp>

        <FadeUp delay={0.15}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 mt-16 pt-14 border-t border-[#C9A44C]/15">
            {[
              ["Fine Dining Trained", "Years on a professional line, every night of service"],
              ["Your Kitchen, His Setup", "Shopping, prep, service, and cleanup all included"],
              ["Austin & Hill Country", "Travel beyond the metro arranged on request"],
            ].map(([title, copy]) => (
              <div key={title}>
                <p className="font-text text-[10px] tracking-[0.3em] uppercase text-[#C9A44C] mb-3">{title}</p>
                <p className="font-text text-sm text-[#A89F93] leading-relaxed">{copy}</p>
              </div>
            ))}
          </div>
        </FadeUp>
      </section>

      {/* ------------------------------------------------------------ Services */}
      <section id="services" className="px-6 pb-24 md:pb-32 max-w-6xl mx-auto">
        <FadeUp className="text-center mb-16">
          <p className="font-text text-[10px] tracking-[0.5em] uppercase text-[#C9A44C] mb-5">What He Does</p>
          <h2 className="font-display text-[clamp(32px,5vw,56px)] font-light tracking-[0.02em]">Three Ways to Eat Well</h2>
        </FadeUp>

        <div className="grid gap-10 md:grid-cols-3">
          {SERVICES.map((s, i) => (
            <FadeUp key={s.title} delay={i * 0.1}>
              <article className="group h-full flex flex-col border border-[#C9A44C]/15 hover:border-[#C9A44C]/45 transition-colors duration-500 bg-[#141210]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={s.image}
                    alt={s.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover grayscale-[35%] group-hover:grayscale-0 group-hover:scale-[1.04] transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141210] via-transparent to-transparent" />
                  <span className="font-display absolute top-4 left-5 text-3xl text-[#C9A44C]/70">{s.n}</span>
                </div>

                <div className="p-7 flex flex-col flex-1">
                  <h3 className="font-display text-2xl tracking-[0.03em] mb-4">{s.title}</h3>
                  <p className="font-text text-sm text-[#A89F93] leading-relaxed flex-1">{s.copy}</p>
                  <p className="font-text text-[10px] tracking-[0.22em] uppercase text-[#C9A44C]/80 mt-6 pt-5 border-t border-[#C9A44C]/15">
                    {s.meta}
                  </p>
                </div>
              </article>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------- Menus */}
      <section id="menus" className="border-y border-[#C9A44C]/15 bg-[#141210]">
        <div className="px-6 py-24 md:py-32 max-w-6xl mx-auto">
          <FadeUp className="text-center mb-16">
            <p className="font-text text-[10px] tracking-[0.5em] uppercase text-[#C9A44C] mb-5">The Menus</p>
            <h2 className="font-display text-[clamp(32px,5vw,56px)] font-light tracking-[0.02em]">
              Pick a Direction
            </h2>
            <p className="font-text text-[#A89F93] text-sm md:text-base max-w-xl mx-auto mt-6 leading-relaxed">
              Every menu is written fresh for your night — these are starting points, not
              a fixed list. Courses move, dishes get swapped, and allergies are designed
              around rather than worked around.
            </p>
          </FadeUp>

          <div className="grid gap-8 md:grid-cols-2">
            {ETHAN_MENUS.map((m, i) => (
              <FadeUp key={m.id} delay={(i % 2) * 0.1}>
                <article className="group h-full flex flex-col bg-[#0c0c0c] border border-[#C9A44C]/15 hover:border-[#C9A44C]/45 transition-colors duration-500">
                  <div className="relative aspect-[21/9] overflow-hidden">
                    <Image
                      src={m.image}
                      alt={m.imageAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover grayscale-[40%] group-hover:grayscale-0 transition-all duration-700"
                    />
                    <div className="absolute inset-0 bg-[#0c0c0c]/45 group-hover:bg-[#0c0c0c]/25 transition-colors duration-500" />
                  </div>

                  <div className="p-8 flex flex-col flex-1">
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <h3 className="font-display text-3xl tracking-[0.03em]">{m.name}</h3>
                      <span className="font-text text-[10px] tracking-[0.22em] uppercase text-[#C9A44C] text-right">
                        {m.tagline}
                      </span>
                    </div>

                    <div className="ethan-rule my-6" />

                    <p className="font-text text-sm text-[#A89F93] leading-relaxed mb-7">{m.description}</p>

                    <ul className="font-text text-sm text-[#F2EDE4]/80 flex flex-col gap-3 mt-auto">
                      {m.courses.map((c) => (
                        <li key={c} className="flex gap-3 leading-snug">
                          <span className="text-[#C9A44C] text-[10px] mt-[6px]">◆</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.1} className="text-center mt-14">
            <Link
              href="/ethan/book"
              className="font-text text-[11px] tracking-[0.3em] uppercase border border-[#C9A44C]/60 text-[#C9A44C] px-10 py-4 inline-block hover:bg-[#C9A44C] hover:text-[#0c0c0c] transition-colors duration-300"
            >
              Request a Date
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ------------------------------------------------------------ How it works */}
      <section className="px-6 py-24 md:py-32 max-w-6xl mx-auto">
        <FadeUp className="text-center mb-16">
          <p className="font-text text-[10px] tracking-[0.5em] uppercase text-[#C9A44C] mb-5">How It Works</p>
          <h2 className="font-display text-[clamp(32px,5vw,56px)] font-light tracking-[0.02em]">
            Four Steps to the Table
          </h2>
        </FadeUp>

        <div className="grid gap-px bg-[#C9A44C]/15 sm:grid-cols-2 lg:grid-cols-4 border border-[#C9A44C]/15">
          {STEPS.map((s, i) => (
            <FadeUp key={s.n} delay={i * 0.08} className="bg-[#0c0c0c]">
              <div className="p-8 h-full">
                <p className="font-display text-4xl text-[#C9A44C]/50 mb-5">{s.n}</p>
                <h3 className="font-display text-xl tracking-[0.03em] mb-3">{s.title}</h3>
                <p className="font-text text-sm text-[#A89F93] leading-relaxed">{s.copy}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- Gallery */}
      <section className="px-6 pb-24 md:pb-32 max-w-6xl mx-auto">
        <FadeUp className="text-center mb-12">
          <p className="font-text text-[10px] tracking-[0.5em] uppercase text-[#C9A44C] mb-5">Recent Nights</p>
          <h2 className="font-display text-[clamp(28px,4vw,44px)] font-light tracking-[0.02em]">From the Table</h2>
        </FadeUp>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {GALLERY.map((g, i) => (
            <FadeUp key={g.src} delay={i * 0.07}>
              <div className="relative aspect-[3/4] overflow-hidden border border-[#C9A44C]/10">
                <Image
                  src={g.src}
                  alt={g.alt}
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-cover grayscale-[45%] hover:grayscale-0 hover:scale-[1.04] transition-all duration-700"
                />
              </div>
            </FadeUp>
          ))}
        </div>

        <FadeUp delay={0.1}>
          <p className="font-text text-[11px] text-[#A89F93]/60 text-center mt-6 italic">
            Placeholder imagery — food and event photography by Luck Images coming soon.
          </p>
        </FadeUp>
      </section>

      {/* ----------------------------------------------------------------- CTA */}
      <section className="relative overflow-hidden border-t border-[#C9A44C]/15">
        <Image
          src="/portfolio/listing-photos/6701BackBayLn-10.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#0c0c0c]/88" />

        <FadeUp className="relative z-10 px-6 py-24 md:py-32 max-w-3xl mx-auto text-center">
          <p className="font-text text-[10px] tracking-[0.5em] uppercase text-[#C9A44C] mb-6">Reserve the Night</p>
          <h2 className="font-display text-[clamp(32px,5.5vw,62px)] font-light leading-[1.1] tracking-[0.02em]">
            Set the table.
            <span className="block italic text-[#C9A44C]">He&apos;ll handle the rest.</span>
          </h2>
          <p className="font-text text-[#A89F93] mt-7 leading-relaxed">
            Send over the date and a rough headcount. You&apos;ll have a written menu and a
            flat per-guest price back within 48 hours.
          </p>
          <Link
            href="/ethan/book"
            className="font-text text-[11px] tracking-[0.3em] uppercase bg-[#C9A44C] text-[#0c0c0c] px-12 py-4 inline-block mt-10 hover:bg-[#F2EDE4] transition-colors duration-300"
          >
            Book Now
          </Link>
        </FadeUp>
      </section>

      <EthanFooter />
    </main>
  );
}
