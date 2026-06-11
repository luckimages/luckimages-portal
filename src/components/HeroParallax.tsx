"use client";

import { useEffect, useRef, useState } from "react";

const IMAGES = ["/hero-1.jpg", "/hero-2.jpg", "/hero-3.jpg"];

export default function HeroParallax() {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cycle photos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % IMAGES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Parallax on scroll
  useEffect(() => {
    function onScroll() {
      if (!containerRef.current) return;
      const x = (window.scrollY / 600) * 30;
      containerRef.current.style.transform = `translateX(${x}px) scale(1.08)`;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 opacity-50 will-change-transform"
      style={{ transform: "translateX(0px) scale(1.08)" }}
    >
      {IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: i === current ? 1 : 0,
            transition: "opacity 3s ease",
          }}
        />
      ))}
    </div>
  );
}
