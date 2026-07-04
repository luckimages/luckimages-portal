import type { Metadata } from "next";
import Link from "next/link";
import HomeNav from "@/components/HomeNav";
import { SERVICES } from "@/lib/services";

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

// Photos available per service slug
const servicePhotos: Record<string, string[]> = {
  "listing-photos": [
    "/portfolio/listing-photos/1005PartidaTrail-19.jpg",
    "/portfolio/listing-photos/1008ConcordiaDr-27.jpg",
    "/portfolio/listing-photos/104WesthavenDrive-33.jpg",
    "/portfolio/listing-photos/2506CarlowDr-10.jpg",
    "/portfolio/listing-photos/2506CarlowDr-11.jpg",
    "/portfolio/listing-photos/315RingtailStreamDr-13.jpg",
    "/portfolio/listing-photos/315RingtailStreamDr-17.jpg",
    "/portfolio/listing-photos/5409Hitcherbend-18.jpg",
    "/portfolio/listing-photos/593CrosswaterLn-31.jpg",
    "/portfolio/listing-photos/6701BackBayLn-10.jpg",
    "/portfolio/listing-photos/6701BackBayLn-15.jpg",
    "/portfolio/listing-photos/6701BackBayLn-17.jpg",
  ],
  "drone": [
    "/portfolio/drone/104WesthavenDrone-5.jpg",
    "/portfolio/drone/1107CountryRoad322Drone-3.jpg",
    "/portfolio/drone/1136CountyRoad484Drone-5.jpg",
    "/portfolio/drone/116MallardDrone-2.jpg",
    "/portfolio/drone/1802MapleDrone-2.jpg",
    "/portfolio/drone/197BristleconeDr-Drone-15.jpg",
    "/portfolio/drone/drone-1.jpg",
  ],
  "twilight": [
    "/portfolio/twilight/WebTwilight-2.jpg",
    "/portfolio/twilight/WebTwilight-3.jpg",
  ],
  "virtual-staging": [
    "/portfolio/virtual-staging/webVS-1.jpg",
    "/portfolio/virtual-staging/webVS-2.jpg",
    "/portfolio/virtual-staging/webVS-5.jpg",
    "/portfolio/virtual-staging/webVS-6.jpg",
    "/portfolio/virtual-staging/webVS-7.jpg",
    "/portfolio/virtual-staging/webVS-8.jpg",
    "/portfolio/virtual-staging/webVS-11.jpg",
    "/portfolio/virtual-staging/webVS-12.jpg",
  ],
};

const serviceDescriptions: Record<string, string> = {
  "listing-photos": "HDR photography processed to magazine quality with professional lighting. Standard 24-hour delivery. Every image sky-replaced and color-corrected.",
  "video": "Cinematic walkthrough videos for listings, developments, and luxury properties. Social-ready cuts for Instagram and YouTube included.",
  "twilight": "Twilight and golden-hour shoots that make a listing unforgettable. Scheduled around optimal light — no extra planning required.",
  "drone": "FAA Part 107 certified aerial photography and video. Show the neighborhood, lot size, and full exterior from angles no ground camera can reach.",
  "matterport": "Interactive 3D virtual tours that let buyers walk through a home online before booking a showing. Proven to increase listing views.",
  "virtual-staging": "AI-powered virtual staging that fills empty rooms with high-end furniture — delivered in 24 hours at a fraction of the cost of physical staging.",
  "floorplans": "Accurate, professionally drawn floorplans that give buyers the spatial context they need. Delivered alongside listing photos.",
  "brochures": "Print-ready listing brochures designed to match your brand. High-resolution PDFs ready for print or digital distribution.",
};

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
      <HomeNav />

      {/* Hero — Austin skyline full bleed */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <img
          src="/hero-1.jpg"
          alt="Austin TX skyline — Luck Images real estate photography"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <p className="text-xs tracking-[5px] uppercase text-white/50 mb-6">Austin, Texas</p>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight uppercase leading-none mb-8">
            Real Estate<br />Photography<br />Austin TX
          </h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-10">
            Professional photography, drone, Matterport 3D tours, and video for Austin&apos;s top agents and developers. 24-hour delivery guaranteed.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="px-10 py-4 bg-white text-black text-xs font-bold tracking-[3px] uppercase hover:bg-white/90 transition-colors"
            >
              Create Portal Account →
            </Link>
            <a
              href="tel:+15123751585"
              className="px-10 py-4 border border-white/30 text-xs font-bold tracking-[3px] uppercase hover:border-white hover:bg-white/5 transition-all"
            >
              (512) 375-1585
            </a>
          </div>
        </div>
        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30">
          <span className="text-[10px] tracking-[3px] uppercase">Scroll</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 animate-bounce">
            <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
          </svg>
        </div>
      </section>

      {/* Client Portal callout */}
      <section className="border-b border-white/10 px-6 md:px-16 py-12 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#a78bfa] mb-2">Luck Images Client Portal</p>
            <h2 className="text-xl font-black uppercase tracking-tight">Your shoots, galleries, and invoices — all in one place.</h2>
            <p className="text-sm text-white/50 mt-2 max-w-xl">
              Book shoots, download your delivered photos, pay invoices, and track your order status from any device. Built for Austin agents who move fast.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/register" className="px-6 py-3 bg-white text-black text-xs font-bold tracking-[2px] uppercase hover:bg-white/90 transition-colors whitespace-nowrap">
              Register Free
            </Link>
            <Link href="/login" className="px-6 py-3 border border-white/20 text-xs font-bold tracking-[2px] uppercase hover:border-white/60 transition-colors whitespace-nowrap">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Services — all 8 with carousels where photos exist */}
      <section className="px-6 md:px-16 py-20 max-w-5xl mx-auto">
        <p className="text-xs tracking-[4px] uppercase text-[#555] mb-16 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
          Services
        </p>
        <div className="space-y-20">
          {SERVICES.map((s) => {
            const photos = servicePhotos[s.slug] ?? [];
            return (
              <div key={s.slug} className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
                {/* Text */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[#a78bfa]">{s.icon}</span>
                    <h2 className="text-sm font-bold tracking-[3px] uppercase">{s.name}</h2>
                  </div>
                  <p className="text-sm text-white/50 leading-relaxed mb-6">
                    {serviceDescriptions[s.slug] ?? "Available in Austin and the greater metro area."}
                  </p>
                  <Link
                    href={`/services/${s.slug}`}
                    className="text-xs tracking-[2px] uppercase text-white/40 hover:text-white border-b border-white/10 hover:border-white/40 pb-0.5 transition-colors"
                  >
                    View gallery →
                  </Link>
                </div>

                {/* Photos or placeholder */}
                {photos.length > 0 ? (
                  <ServiceCarousel photos={photos} alt={s.name} />
                ) : (
                  <div className="aspect-[4/3] bg-[#111] border border-white/5 flex items-center justify-center">
                    <span className="text-xs tracking-[2px] uppercase text-white/20">Photos coming soon</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Why Luck Images */}
      <section className="px-6 md:px-16 py-16 max-w-5xl mx-auto border-t border-white/5">
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

      {/* Areas served */}
      <section className="px-6 md:px-16 py-16 max-w-5xl mx-auto border-t border-white/5">
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
      <section className="px-6 md:px-16 py-16 max-w-5xl mx-auto border-t border-white/5">
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

      {/* Bottom CTA */}
      <section className="px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-2">Ready to book?</h2>
            <p className="text-white/50 text-sm">Create your free portal account and book your first shoot in under 2 minutes.</p>
          </div>
          <div className="flex gap-4 shrink-0">
            <Link
              href="/register"
              className="px-10 py-4 bg-white text-black text-xs font-bold tracking-[3px] uppercase hover:bg-white/90 transition-colors whitespace-nowrap"
            >
              Get Started →
            </Link>
            <Link
              href="/pricing"
              className="px-10 py-4 border border-white/20 text-xs font-bold tracking-[3px] uppercase hover:border-white/60 transition-colors whitespace-nowrap"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

// Client-side carousel component (inline to keep file self-contained)
function ServiceCarousel({ photos, alt }: { photos: string[]; alt: string }) {
  "use client";
  // SSR-safe: render as static grid on server, enhance on client
  return (
    <div className="grid grid-cols-2 gap-2">
      {photos.slice(0, 4).map((src, i) => (
        <div key={i} className="relative overflow-hidden bg-[#111]" style={{ aspectRatio: "3/2" }}>
          <img
            src={src}
            alt={`${alt} — Luck Images Austin TX`}
            className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
        </div>
      ))}
    </div>
  );
}
