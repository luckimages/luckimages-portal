"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const IMAGES = ["/hero-1.jpg", "/hero-2.jpg", "/hero-3.jpg", "/hero-4.jpg"];

export default function HeroParallax() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % IMAGES.length);
    }, 6000);
  }, []);

  useEffect(() => {
    if (playing) startTimer();
    else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, startTimer]);

  function prev() {
    setCurrent((c) => (c - 1 + IMAGES.length) % IMAGES.length);
    if (playing) startTimer();
  }

  function next() {
    setCurrent((c) => (c + 1) % IMAGES.length);
    if (playing) startTimer();
  }

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
    <>
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
            style={{ opacity: i === current ? 1 : 0, transition: "opacity 3s ease" }}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-5">
        <button onClick={prev} className="text-white/30 hover:text-white/70 transition-colors text-base leading-none">←</button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="text-white/30 hover:text-white/70 transition-colors"
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1" y="1" width="4" height="10" rx="1"/>
              <rect x="7" y="1" width="4" height="10" rx="1"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 1.5l9 4.5-9 4.5z"/>
            </svg>
          )}
        </button>
        <button onClick={next} className="text-white/30 hover:text-white/70 transition-colors text-base leading-none">→</button>
      </div>
    </>
  );
}
