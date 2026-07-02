import Link from "next/link";
import { SERVICES } from "@/lib/services";
import { notFound } from "next/navigation";
import PhotoCarousel from "@/components/PhotoCarousel";
import VirtualStagingCarousel from "@/components/VirtualStagingCarousel";
import FadeUp from "@/components/FadeUp";
import HomeNav from "@/components/HomeNav";

// Real before/after virtual-staging pairs (same room, same angle).
const VIRTUAL_STAGING_PAIRS = [
  { before: "webVS-1.jpg", after: "webVS-2.jpg" },
  { before: "webVS-5.jpg", after: "webVS-6.jpg" },
  { before: "webVS-7.jpg", after: "webVS-8.jpg" },
  { before: "webVS-11.jpg", after: "webVS-12.jpg" },
];

const DESCRIPTIONS: Record<string, string> = {
  "listing-photos": "Professional photography that makes every listing stand out. Sharp, well-lit images that move properties faster.",
  "video": "Cinematic walkthrough videos that bring listings to life and reach buyers anywhere.",
  "twilight": "Dramatic twilight photography that captures the warm glow of a property at golden hour.",
  "drone": "FAA-certified aerial photography and video that showcases the property and its surroundings.",
  "matterport": "Immersive 3D virtual tours that let buyers explore every room from anywhere in the world.",
  "virtual-staging": "Transform empty spaces into beautifully furnished rooms — digitally, fast, and affordably.",
  "floorplans": "Accurate, clean floorplan diagrams that give buyers a clear picture of every space.",
  "brochures": "Print-ready and digital property brochures that make a lasting impression at open houses.",
};

// Real photos pulled from the original luckimages.com service pages,
// matched back to their source files on disk.
const GALLERY_PHOTOS: Record<string, string[]> = {
  "listing-photos": [
    "315RingtailStreamDr-13.jpg", "104WesthavenDrive-33.jpg", "6701BackBayLn-10.jpg",
    "2506CarlowDr-10.jpg", "315RingtailStreamDr-17.jpg", "1008ConcordiaDr-27.jpg",
    "593CrosswaterLn-31.jpg", "5409Hitcherbend-18.jpg", "6701BackBayLn-15.jpg",
    "1005PartidaTrail-19.jpg", "2506CarlowDr-11.jpg", "6701BackBayLn-17.jpg",
  ],
  "drone": [
    "drone-1.jpg", "1802MapleDrone-2.jpg", "1136CountyRoad484Drone-5.jpg",
    "1107CountryRoad322Drone-3.jpg", "197BristleconeDr-Drone-15.jpg",
    "104WesthavenDrone-5.jpg", "116MallardDrone-2.jpg",
    "bernia_interior-3.jpg", "bernia_interior-4.jpg", "bernia_interior-5.jpg",
    "bernia_interior-6.jpg", "bernia_interior-7.jpg",
  ],
  "twilight": ["WebTwilight-2.jpg", "WebTwilight-3.jpg"],
};

// Filenames confirmed to have existed on the original site but not found
// on disk -- shown as labeled placeholders so it's obvious what to look for.
const MISSING_PHOTOS: Record<string, string[]> = {
  "listing-photos": [
    "800EmbassyDr212-8.jpg", "5908backbay_exterior-5.jpg",
    "10305channelisland-9.jpg", "website_redo_small-9.jpg",
  ],
  "twilight": ["WebTwilight-1.jpg", "WebTwilight-4.jpg", "WebTwilight-11.jpg", "WebTwilight-12.jpg"],
};

// Placeholder counts for services with no source photos recovered at all.
const GALLERY_COUNTS: Record<string, number> = {
  "floorplans": 6,
  "brochures": 6,
};

const GALLERY_SERVICES = new Set([...Object.keys(GALLERY_PHOTOS), ...Object.keys(GALLERY_COUNTS)]);

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = SERVICES.find((s) => s.slug === slug);
  if (!service) notFound();

  const realPhotos = GALLERY_PHOTOS[slug];
  const missing = MISSING_PHOTOS[slug] ?? [];
  const photos = realPhotos
    ? [
        ...realPhotos.map((f) => ({ src: `/portfolio/${slug}/${f}`, alt: `${service.name} — Luck Images` })),
        ...missing.map((f) => ({ src: "", missingLabel: f })),
      ]
    : Array.from({ length: GALLERY_COUNTS[slug] || 0 }, () => ({ src: "" }));

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      {/* Hero */}
      <div className="relative flex flex-col items-center justify-center text-center px-6 py-32 overflow-hidden">
        <HomeNav />
        <img
          src="/hero-1.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0c]/70 via-[#0c0c0c]/80 to-[#0c0c0c]" />

        <div className="relative z-10 flex flex-col items-center">
          <FadeUp delay={0.05} className="text-white/70 mb-8 [&>svg]:w-12 [&>svg]:h-12">{service.icon}</FadeUp>
          <FadeUp delay={0.15}><p className="text-xs tracking-[4px] uppercase text-white/70 mb-4">Services</p></FadeUp>
          <FadeUp delay={0.25}><h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-8" style={{ textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>{service.name}</h1></FadeUp>
          <FadeUp delay={0.35}><p className="text-white/80 text-lg max-w-lg mb-12 leading-relaxed">{DESCRIPTIONS[service.slug]}</p></FadeUp>
          <FadeUp delay={0.45}>
            <div className="flex gap-4">
              <Link href="/login" className="text-xs tracking-[3px] uppercase bg-white text-black px-8 py-4 font-semibold hover:bg-white/90 transition-colors">Book Now</Link>
              <Link href="/" className="text-xs tracking-[3px] uppercase border border-white/40 px-8 py-4 hover:border-white hover:bg-white/5 transition-all">← All Services</Link>
            </div>
          </FadeUp>
        </div>
      </div>

      {/* Virtual Staging — before/after carousel */}
      {slug === "virtual-staging" && (
        <section className="px-4 md:px-8 pb-24 max-w-[1600px] mx-auto w-full">
          <FadeUp>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-8 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
              Before & After
            </p>
            <p className="text-xs text-[#555] mb-8 tracking-wide">Drag the slider to compare. Click the arrows to see more rooms.</p>
            <VirtualStagingCarousel
              pairs={VIRTUAL_STAGING_PAIRS.map((p) => ({
                before: `/portfolio/virtual-staging/${p.before}`,
                after: `/portfolio/virtual-staging/${p.after}`,
              }))}
            />
          </FadeUp>
        </section>
      )}

      {/* Gallery */}
      {GALLERY_SERVICES.has(slug) && (
        <section className="px-4 md:px-8 pb-24 max-w-[1600px] mx-auto w-full">
          <FadeUp>
            <p className="text-xs tracking-[4px] uppercase text-[#555] mb-8 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
              Portfolio
            </p>
            <PhotoCarousel photos={photos} />
          </FadeUp>
        </section>
      )}

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</a>
      </footer>
    </main>
  );
}
