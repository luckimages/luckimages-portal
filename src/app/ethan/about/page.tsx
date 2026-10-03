import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import EthanNav from "@/components/ethan/EthanNav";
import EthanFooter from "@/components/ethan/EthanFooter";
import FadeUp from "@/components/FadeUp";

export const metadata: Metadata = {
  title: "About — Ethan Simpson, Private Chef | Austin, TX",
  description:
    "Fine dining trained, Austin based. Meet the chef behind the private dinner parties and event catering.",
  robots: { index: false, follow: false },
};

const PRINCIPLES = [
  {
    title: "Seasonal, Not Scripted",
    copy:
      "Menus are written the week of your dinner, around what's actually good — not pulled from a laminated list printed last spring.",
  },
  {
    title: "Technique Over Theater",
    copy:
      "No foams for the sake of foams. Stocks reduced properly, proteins rested properly, sauces finished by hand. The work goes into the plate, not the presentation.",
  },
  {
    title: "Your House, Respected",
    copy:
      "He arrives with his own kit, works clean, and the kitchen is put back the way he found it. Guests should never see the mechanics of the evening.",
  },
  {
    title: "Allergies Designed Around",
    copy:
      "Dietary restrictions aren't an inconvenience to work around — they're a constraint to design within. Nobody at the table gets the lesser plate.",
  },
];

export default function EthanAbout() {
  return (
    <main className="bg-[#0c0c0c] text-[#F2EDE4] min-h-screen">
      <EthanNav />

      {/* ----------------------------------------------------------- Page head */}
      <section className="pt-40 md:pt-48 pb-16 px-6 text-center">
        <FadeUp>
          <p className="font-text text-[10px] md:text-[11px] tracking-[0.5em] uppercase text-[#C9A44C] mb-6">
            The Chef
          </p>
          <h1 className="font-display text-[clamp(42px,7vw,86px)] font-light leading-[1.05] tracking-[0.02em]">
            Ethan Simpson
          </h1>
          <div className="ethan-rule w-40 mx-auto mt-10" />
        </FadeUp>
      </section>

      {/* -------------------------------------------------------------- Story */}
      <section className="px-6 pb-24 md:pb-32 max-w-6xl mx-auto">
        <div className="grid gap-12 md:gap-16 md:grid-cols-[5fr_6fr] items-start">
          <FadeUp>
            <div className="relative aspect-[4/5] border border-[#C9A44C]/20 overflow-hidden md:sticky md:top-32">
              <Image
                src="/ethan/dumplings-skillet.jpg"
                alt="Dumplings finishing in a skillet on the stove"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 45vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c]/70 via-transparent to-transparent" />
              <p className="font-text absolute bottom-5 left-6 right-6 text-[10px] tracking-[0.25em] uppercase text-[#A89F93]">
                Portrait to come
              </p>
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <div className="font-text text-[#A89F93] leading-[1.9] flex flex-col gap-6">
              <p className="font-display text-[clamp(22px,2.6vw,30px)] leading-[1.5] text-[#F2EDE4] font-light">
                Ethan cooks for a living, six nights a week, on the line at one of
                Austin&apos;s most demanding kitchens. This is what he does on the seventh.
              </p>

              <p>
                He came up the way most serious cooks do — classically, and slowly.
                Years of prep lists, stations, and service, learning that the
                difference between good food and the kind people remember is almost
                never an ingredient. It&apos;s patience, repetition, and caring about
                a sauce at eleven at night when nobody is watching.
              </p>

              <p>
                Private work started the way it usually does, too: a friend&apos;s
                birthday, a kitchen that wasn&apos;t his, and a dinner that went late
                because nobody wanted to leave the table. What he found he liked about
                it was the part restaurants can&apos;t give you — cooking for the same
                twelve people all night, hearing the room react, and sending out a
                second helping because someone asked for one.
              </p>

              <p>
                Today he cooks private dinners and caters events across Austin and the
                surrounding Hill Country. Four people at a kitchen island or ninety in
                a backyard — the standard is the same one he works to every night of
                the week.
              </p>

              <div className="ethan-rule my-4" />

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="font-text text-[10px] tracking-[0.3em] uppercase text-[#C9A44C] mb-3">Based In</p>
                  <p className="text-sm">Austin, Texas</p>
                </div>
                <div>
                  <p className="font-text text-[10px] tracking-[0.3em] uppercase text-[#C9A44C] mb-3">Cooks</p>
                  <p className="text-sm">Classic · Italian · French · Custom</p>
                </div>
                <div>
                  <p className="font-text text-[10px] tracking-[0.3em] uppercase text-[#C9A44C] mb-3">Serves</p>
                  <p className="text-sm">Private dinners · Events · Standing service</p>
                </div>
                <div>
                  <p className="font-text text-[10px] tracking-[0.3em] uppercase text-[#C9A44C] mb-3">Reach Him</p>
                  <a href="mailto:egsimpson03@gmail.com" className="text-sm hover:text-[#F2EDE4] transition-colors break-all">
                    egsimpson03@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* --------------------------------------------------------- Principles */}
      <section className="border-y border-[#C9A44C]/15 bg-[#141210]">
        <div className="px-6 py-24 md:py-32 max-w-5xl mx-auto">
          <FadeUp className="text-center mb-16">
            <p className="font-text text-[10px] tracking-[0.5em] uppercase text-[#C9A44C] mb-5">How He Cooks</p>
            <h2 className="font-display text-[clamp(30px,4.5vw,50px)] font-light tracking-[0.02em]">
              Four Things He Won&apos;t Compromise On
            </h2>
          </FadeUp>

          <div className="grid gap-px bg-[#C9A44C]/15 sm:grid-cols-2 border border-[#C9A44C]/15">
            {PRINCIPLES.map((p, i) => (
              <FadeUp key={p.title} delay={(i % 2) * 0.1} className="bg-[#141210]">
                <div className="p-8 md:p-10 h-full">
                  <h3 className="font-display text-2xl tracking-[0.03em] mb-4">{p.title}</h3>
                  <p className="font-text text-sm text-[#A89F93] leading-relaxed">{p.copy}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- CTA */}
      <section className="px-6 py-24 md:py-32 max-w-3xl mx-auto text-center">
        <FadeUp>
          <h2 className="font-display text-[clamp(30px,5vw,56px)] font-light leading-[1.12] tracking-[0.02em]">
            Have a night in mind?
          </h2>
          <p className="font-text text-[#A89F93] mt-6 leading-relaxed">
            Send the date, the headcount, and a direction. A written menu and a flat
            per-guest price come back within 48 hours.
          </p>
          <Link
            href="/ethan/book"
            className="font-text text-[11px] tracking-[0.3em] uppercase bg-[#C9A44C] text-[#0c0c0c] px-12 py-4 inline-block mt-10 hover:bg-[#F2EDE4] transition-colors duration-300"
          >
            Book a Dinner
          </Link>
        </FadeUp>
      </section>

      <EthanFooter />
    </main>
  );
}
