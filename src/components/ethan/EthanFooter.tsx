import Link from "next/link";

export default function EthanFooter() {
  return (
    <footer className="border-t border-[#C9A44C]/15 bg-[#0c0c0c]">
      <div className="max-w-6xl mx-auto px-6 py-16 grid gap-10 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl tracking-[0.08em] text-[#F2EDE4]">Ethan Simpson</p>
          <p className="font-text text-[10px] tracking-[0.42em] uppercase text-[#A89F93] mt-2">
            Private Chef · Austin, Texas
          </p>
        </div>

        <div className="font-text text-sm text-[#A89F93] flex flex-col gap-2">
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#C9A44C] mb-2">Get In Touch</p>
          <a href="mailto:egsimpson03@gmail.com" className="hover:text-[#F2EDE4] transition-colors w-fit">
            egsimpson03@gmail.com
          </a>
          <p>Serving Austin and the surrounding Hill Country</p>
        </div>

        <div className="font-text text-sm text-[#A89F93] flex flex-col gap-2 md:items-end">
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#C9A44C] mb-2">Explore</p>
          <Link href="/ethan" className="hover:text-[#F2EDE4] transition-colors w-fit">Home</Link>
          <Link href="/ethan/about" className="hover:text-[#F2EDE4] transition-colors w-fit">About</Link>
          <Link href="/ethan/book" className="hover:text-[#F2EDE4] transition-colors w-fit">Book a Dinner</Link>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p className="font-text text-[11px] text-[#A89F93]/60">
            © {new Date().getFullYear()} Ethan Simpson. All rights reserved.
          </p>
          <p className="font-text text-[11px] text-[#A89F93]/60">
            Photography by{" "}
            <a href="/" className="hover:text-[#C9A44C] transition-colors">Luck Images</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
