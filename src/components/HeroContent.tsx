"use client";
import { motion } from "framer-motion";
import HeroCTA from "./HeroCTA";

const ease = [0.25, 0.1, 0.25, 1] as const;
const item = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease, delay },
});

export default function HeroContent() {
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <motion.p
        {...item(0.1)}
        className="text-xs tracking-[4px] uppercase text-white mb-6"
        style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
      >
        Austin, TX — Real Estate Media
      </motion.p>
      <motion.h1
        {...item(0.25)}
        className="text-[clamp(48px,8vw,96px)] font-black tracking-tight leading-none uppercase mb-8"
        style={{ textShadow: "0 4px 24px rgba(0,0,0,0.7)" }}
      >
        LUCK IMAGES
      </motion.h1>
      <motion.p
        {...item(0.4)}
        className="text-white text-lg max-w-md mb-12 leading-relaxed"
        style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
      >
        Photography. Drone. Matterport. Video.
        <br />
        Built for agents who move fast.
      </motion.p>
      <motion.div {...item(0.55)}>
        <HeroCTA />
      </motion.div>
    </div>
  );
}
