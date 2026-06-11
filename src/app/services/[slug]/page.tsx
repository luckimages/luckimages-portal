import Link from "next/link";
import { SERVICES } from "@/lib/services";
import { notFound } from "next/navigation";
import PhotoGallery from "@/components/PhotoGallery";

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

// Placeholder counts per service — swap src strings for real paths when ready
const GALLERY_COUNTS: Record<string, number> = {
  "listing-photos": 12,
  "twilight": 8,
  "drone": 8,
  "floorplans": 6,
  "brochures": 6,
};

const GALLERY_SERVICES = new Set(Object.keys(GALLERY_COUNTS));

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = SERVICES.find((s) => s.slug === slug);
  if (!service) notFound();

  const placeholderCount = GALLERY_COUNTS[slug] || 0;
  const photos = Array.from({ length: placeholderCount }, () => ({ src: "" }));

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <Link href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</Link>
        <Link href="/login" className="text-xs tracking-[3px] uppercase border border-white/25 px-5 py-2.5 hover:border-white hover:bg-white/5 transition-all">Login</Link>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="text-[#444] mb-8 [&>svg]:w-12 [&>svg]:h-12">{service.icon}</div>
        <p className="text-xs tracking-[4px] uppercase text-[#666] mb-4">Services</p>
        <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-8">{service.name}</h1>
        <p className="text-[#666] text-lg max-w-lg mb-12 leading-relaxed">{DESCRIPTIONS[service.slug]}</p>
        <div className="flex gap-4">
          <Link href="/login" className="text-xs tracking-[3px] uppercase bg-white text-black px-8 py-4 font-semibold hover:bg-white/90 transition-colors">Book Now</Link>
          <Link href="/" className="text-xs tracking-[3px] uppercase border border-white/25 px-8 py-4 hover:border-white hover:bg-white/5 transition-all">← All Services</Link>
        </div>
      </div>

      {/* Gallery */}
      {GALLERY_SERVICES.has(slug) && (
        <section className="px-8 pb-24 max-w-6xl mx-auto w-full">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-8 flex items-center gap-4 after:flex-1 after:h-px after:bg-white/10 after:content-['']">
            Portfolio
          </p>
          <PhotoGallery photos={photos} />
        </section>
      )}

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</a>
      </footer>
    </main>
  );
}
