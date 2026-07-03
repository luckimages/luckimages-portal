"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Photo = { src: string; alt?: string; missingLabel?: string };

export default function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const isOpen = lightboxIndex !== null;
  const current = isOpen ? photos[lightboxIndex!] : null;

  const prev = useCallback(() => setLightboxIndex((i) => ((i ?? 0) - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setLightboxIndex((i) => ((i ?? 0) + 1) % photos.length), [photos.length]);

  useEffect(() => {
    if (isOpen) lightboxRef.current?.focus();
  }, [isOpen]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
    if (e.key === "Escape") setLightboxIndex(null);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50) next();
    else if (delta > 50) prev();
    touchStartX.current = null;
  }

  return (
    <>
      {/* 2-column grid */}
      <div className="grid grid-cols-2 gap-2">
        {photos.map((p, i) => (
          <div
            key={i}
            className="relative w-full overflow-hidden bg-[#111] cursor-zoom-in"
            style={{ aspectRatio: "3/2" }}
            onClick={() => p.src && setLightboxIndex(i)}
          >
            {p.src ? (
              <img
                src={p.src}
                alt={p.alt || ""}
                className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#333] text-xs tracking-[2px] uppercase">
                <span>Missing</span>
                {p.missingLabel && <span className="text-[10px] tracking-normal normal-case text-[#444] font-mono lowercase">{p.missingLabel}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {isOpen && current?.src && (
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center outline-none"
          onClick={() => setLightboxIndex(null)}
          onKeyDown={handleKey}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          tabIndex={-1}
        >
          {/* Close */}
          <button
            className="absolute top-5 right-6 text-white/50 hover:text-white text-xs tracking-[3px] uppercase transition-colors z-10"
            onClick={() => setLightboxIndex(null)}
          >
            Close ✕
          </button>

          {/* Prev */}
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-2xl transition-colors px-3 py-6 z-10"
            onClick={(e) => { e.stopPropagation(); prev(); }}
          >
            ←
          </button>

          {/* Image — full screen width, 3:2 ratio always */}
          <div
            className="relative w-screen"
            style={{ aspectRatio: "3/2" }}
            onClick={(e) => e.stopPropagation()}
          >
            <img src={current.src} alt="" className="w-full h-full object-cover" draggable={false} />
            <p className="absolute -bottom-7 left-0 right-0 text-center text-xs tracking-[2px] text-white/30 uppercase">
              {lightboxIndex! + 1} / {photos.length}
            </p>
          </div>

          {/* Next */}
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-2xl transition-colors px-3 py-6 z-10"
            onClick={(e) => { e.stopPropagation(); next(); }}
          >
            →
          </button>
        </div>
      )}
    </>
  );
}
