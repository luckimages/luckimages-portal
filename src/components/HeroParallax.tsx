"use client";

import { useEffect, useRef, useState } from "react";

const IMAGES = ["/hero-1.jpg", "/hero-2.jpg", "/hero-3.jpg"];
const INTERVAL = 10000;

export default function HeroParallax() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [fading, setFading] = useState(false);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);

  // Crossfade timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => {
        setPrev(c);
        setFading(true);
        return (c + 1) % IMAGES.length;
      });
    }, INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Clear prev after fade completes
  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => { setPrev(null); setFading(false); }, 3000);
    return () => clearTimeout(t);
  }, [fading]);

  // Parallax on scroll
  useEffect(() => {
    function onScroll() {
      const x = (window.scrollY / 600) * 30;
      imgRefs.current.forEach((el) => {
        if (el) el.style.transform = `translateX(${x}px) scale(1.08)`;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="absolute inset-0 opacity-50">
      {IMAGES.map((src, i) => {
        const isActive = i === current;
        const isPrev = i === prev;
        if (!isActive && !isPrev) return null;
        return (
          <img
            key={src}
            ref={(el) => { imgRefs.current[i] = el; }}
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover will-change-transform"
            style={{
              transform: "translateX(0px) scale(1.08)",
              transition: "transform 0.1s linear, opacity 3s ease",
              opacity: isActive ? 1 : 0,
            }}
          />
        );
      })}
    </div>
  );
}
