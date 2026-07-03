"use client";

import Link from "next/link";
import HomeNav from "@/components/HomeNav";
import QuoteGenerator from "@/components/QuoteGenerator";

export default function QuotePage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <HomeNav />
      <div className="pt-32 pb-16 text-center px-6">
        <p className="text-xs tracking-[4px] uppercase text-[#666] mb-4">Build Your Shoot</p>
        <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-tight leading-none uppercase mb-6">Get a Quote</h1>
        <p className="text-[#666] text-lg max-w-md mx-auto leading-relaxed">
          Choose your services and we&apos;ll reach out with a confirmed quote.
        </p>
      </div>
      <div className="px-6 pb-32 max-w-2xl mx-auto w-full">
        <QuoteGenerator />
      </div>
      <footer className="border-t border-white/10 px-8 py-8 flex items-center justify-between mt-auto">
        <span className="text-xs tracking-[3px] uppercase text-[#444]">© 2026 Luck Images</span>
        <Link href="mailto:ryan@luckimages.com" className="text-xs tracking-[2px] uppercase text-[#444] hover:text-white transition-colors">ryan@luckimages.com</Link>
      </footer>
    </main>
  );
}
