"use client";

import { useEffect, useRef } from "react";

export default function HeroParallax() {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    function onScroll() {
      if (!imgRef.current) return;
      const offset = window.scrollY;
      // shift horizontally ±30px over the first 600px of scroll
      const x = (offset / 600) * 30;
      imgRef.current.style.transform = `translateX(${x}px) scale(1.08)`;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <img
      ref={imgRef}
      src="/hero.jpg"
      alt=""
      className="absolute inset-0 w-full h-full object-cover opacity-50 will-change-transform"
      style={{ transform: "translateX(0px) scale(1.08)", transition: "transform 0.1s linear" }}
    />
  );
}
