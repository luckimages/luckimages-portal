import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Real Estate Photography Austin TX | Luck Images",
  description: "Professional real estate photography, drone, Matterport 3D tours, and video in Austin TX. 24-hour turnaround. Serving Austin, Round Rock, Cedar Park, Georgetown & surrounding areas.",
  keywords: ["real estate photography Austin TX", "real estate photographer Austin", "drone photography Austin real estate", "Matterport Austin", "listing photos Austin Texas", "real estate video Austin"],
  alternates: { canonical: "https://www.luckimages.com/austin-real-estate-photography" },
  openGraph: {
    title: "Real Estate Photography Austin TX | Luck Images",
    description: "Professional real estate photography, drone, Matterport 3D tours, and video in Austin TX. 24-hour turnaround.",
    url: "https://www.luckimages.com/austin-real-estate-photography",
  },
};

const services = [
  {
    name: "Listing Photography",
    icon: "📸",
    description: "HDR photography that makes every room look its best. We shoot with professional lighting and process every image to magazine quality. Standard turnaround is 24 hours.",
  },
  {
    name: "Drone Photography & Video",
    icon: "🚁",
    description: "FAA Part 107 certified aerial photography and video. Show the neighborhood, lot size, proximity to amenities, and the full exterior from angles no ground camera can reach.",
  },
  {
    name: "Matterport 3D Tours",
    icon: "🏠",
    description: "Interactive 3D virtual tours that let buyers walk through a home online before booking a showing. Proven to increase listing views and reduce days on market.",
  },
  {
    name: "Real Estate Video",
    icon: "🎬",
    description: "Cinematic walkthrough videos for listings, developments, and luxury properties. Social-ready cuts included for Instagram and YouTube.",
  },
  {
    name: "Headshots",
    icon: "🤝",
    description: "Professional headshots for real estate agents who want to look sharp on business cards, social media, and the MLS.",
  },
];

const areas = [
  "Austin", "Round Rock", "Cedar Park", "Georgetown", "Pflugerville",
  "Leander", "Kyle", "Buda", "Lakeway", "Bee Cave", "Dripping Springs", "Manor",
];

const faqs = [
  {
    q: "How fast do I get my photos back?",
    a: "Standard real estate shoots are delivered within 24 hours. Rush same-day delivery is available for an additional fee.",
  },
  {
    q: "Do you need to be there during the shoot?",
    a: "No. Many of our agent clients simply unlock the door and we handle the rest. We send a confirmation when we arrive and when photos are delivered.",
  },
  {
    q: "What's included in a standard listing shoot?",
    a: "Every shoot includes full HDR processing, sky replacement when needed, and delivery via an online gallery. The number of photos depends on the package — starting at 25 edited images.",
  },
  {
    q: "Are you FAA certified for drone work?",
    a: "Yes. Ryan holds an FAA Part 107 Remote Pilot Certificate, which is required for commercial drone photography. We are fully insured.",
  },
  {
    q: "What areas do you cover?",
    a: "We cover the entire greater Austin metro area — from Georgetown and Round Rock in the north to Kyle and Buda in the south, and Lakeway and Dripping Springs in the west.",
  },
];

export default function AustinRealEstatePhotographyPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white">

      {/* Hero */}
      <section className="px-6 md:px-16 py-24 max-w-5xl mx-auto">
        <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-4">Austin, Texas</p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight uppercase leading-none mb-6">
          Real Estate<br />Photography<br />Austin TX
        </h1>
        <p className="text-lg text-white/60 max-w-2xl mb-10">
          Luck Images provides professional real estate photography, drone, Matterport 3D tours, and video for Austin&apos;s top agents and developers. We guarantee 24-hour photo delivery on every shoot.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/quote"
            className="px-8 py-3 bg-white text-black text-sm font-bold tracking-[2px] uppercase hover:bg-white/90 transition-colors"
          >
            Book a Shoot
          </Link>
          <a
            href="tel:+15123751585"
            className="px-8 py-3 border border-white/20 text-sm font-bold tracking-[2px] uppercase hover:border-white/50 transition-colors"
          >
            (512) 375-1585
          </a>
        </div>
      </section>

      {/* Services */}
      <section className="px-6 md:px-16 py-16 max-w-5xl mx-auto">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-10 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          Services
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((s) => (
            <div key={s.name} className="border border-white/10 p-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <h2 className="text-base font-bold tracking-wide uppercase">{s.name}</h2>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Luck Images */}
      <section className="px-6 md:px-16 py-16 max-w-5xl mx-auto">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-10 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          Why Luck Images
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { stat: "24hr", label: "Photo turnaround", detail: "Every shoot, guaranteed — no exceptions." },
            { stat: "5.0★", label: "Google rating", detail: "Consistent 5-star reviews from Austin agents." },
            { stat: "FAA", label: "Certified drone pilot", detail: "Part 107 certified and fully insured for commercial work." },
          ].map((item) => (
            <div key={item.stat} className="border border-white/10 p-6">
              <p className="text-4xl font-black text-[#a78bfa] mb-2">{item.stat}</p>
              <p className="text-sm font-bold tracking-wide uppercase mb-1">{item.label}</p>
              <p className="text-xs text-white/40">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Service areas */}
      <section className="px-6 md:px-16 py-16 max-w-5xl mx-auto">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-8 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          Areas Served
        </p>
        <p className="text-white/50 text-sm mb-6">We cover the entire greater Austin metro area, including:</p>
        <div className="flex flex-wrap gap-3">
          {areas.map((area) => (
            <span key={area} className="border border-white/15 px-4 py-2 text-xs tracking-[2px] uppercase text-white/60">
              {area}
            </span>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 md:px-16 py-16 max-w-5xl mx-auto">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-10 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          FAQ
        </p>
        <div className="space-y-6">
          {faqs.map((faq) => (
            <div key={faq.q} className="border-b border-white/10 pb-6">
              <h3 className="text-sm font-bold mb-2">{faq.q}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-16 py-20 max-w-5xl mx-auto text-center">
        <h2 className="text-2xl md:text-4xl font-black uppercase mb-4">Ready to book?</h2>
        <p className="text-white/50 mb-8 text-sm">Get a quote in under 2 minutes. 24-hour turnaround guaranteed.</p>
        <Link
          href="/quote"
          className="inline-block px-10 py-4 bg-white text-black text-sm font-bold tracking-[2px] uppercase hover:bg-white/90 transition-colors"
        >
          Get a Quote
        </Link>
      </section>

    </main>
  );
}
