"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export default function IntroAnimation() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("intro_seen")) return;
    setVisible(true);
    sessionStorage.setItem("intro_seen", "1");
    const t = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-[#0c0c0c] flex items-center justify-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut", delay: 0.15 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const }}
          >
            <Image src="/logo.png" alt="Luck Images" width={72} height={72} className="w-18 h-18" priority />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
