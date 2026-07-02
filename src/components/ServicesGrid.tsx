"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { SERVICES } from "@/lib/services";

export default function ServicesGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 max-w-4xl mx-auto border border-white/50 gap-px bg-white/50">
      {SERVICES.map((s, i) => (
        <motion.div
          key={s.slug}
          className="bg-[#0c0c0c]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const, delay: i * 0.06 }}
        >
          <Link
            href={`/services/${s.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#0c0c0c] p-8 flex flex-col items-center gap-4 hover:bg-white/5 transition-colors group h-full"
          >
            <span className="text-white/50 group-hover:text-white transition-colors">{s.icon}</span>
            <span className="text-xs tracking-[2px] uppercase text-white/60 group-hover:text-white transition-colors text-center">{s.name}</span>
            <span className="text-[10px] tracking-[2px] uppercase text-white/30 group-hover:text-white/60 transition-colors">Learn More →</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
