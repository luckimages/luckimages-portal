import Link from "next/link";

export default function FloorplansPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <Link href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</Link>
        <Link href="/login" className="text-xs tracking-[3px] uppercase border border-white/25 px-5 py-2.5 hover:border-white hover:bg-white/5 transition-all">Login</Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32">
        <p className="text-xs tracking-[4px] uppercase text-[#666] mb-4">Services</p>
        <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-8">Floorplans</h1>
        <p className="text-[#666] text-lg max-w-lg mb-12 leading-relaxed">Accurate, clean floorplan diagrams that give buyers a clear picture of every space. Delivered fast alongside your listing photos.</p>
        <div className="flex gap-4">
          <Link href="/login" className="text-xs tracking-[3px] uppercase bg-white text-black px-8 py-4 font-semibold hover:bg-white/90 transition-colors">Book Now</Link>
          <Link href="/" className="text-xs tracking-[3px] uppercase border border-white/25 px-8 py-4 hover:border-white hover:bg-white/5 transition-all">← All Services</Link>
        </div>
      </div>

      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <a href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</a>
      </footer>
    </main>
  );
}
