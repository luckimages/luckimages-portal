"use client";

import { useState } from "react";

type Photo = { src: string; alt?: string; missingLabel?: string };

export default function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isOpen = lightboxIndex !== null;
  const current = isOpen ? photos[lightboxIndex!] : null;

  function prev() { setLightboxIndex((i) => ((i ?? 0) - 1 + photos.length) % photos.length); }
  function next() { setLightboxIndex((i) => ((i ?? 0) + 1) % photos.length); }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
    if (e.key === "Escape") setLightboxIndex(null);
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
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
          onKeyDown={handleKey}
          tabIndex={-1}
        >
          <button
            className="absolute top-6 right-8 text-white/50 hover:text-white text-xs tracking-[3px] uppercase transition-colors z-10"
            onClick={() => setLightboxIndex(null)}
          >
            Close ✕
          </button>
          <button
            className="absolute left-6 text-white/40 hover:text-white text-2xl transition-colors px-4 py-8 z-10"
            onClick={(e) => { e.stopPropagation(); prev(); }}
          >
            ←
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-w-6xl max-h-[90vh] px-16">
            <img src={current.src} alt="" className="max-h-[90vh] max-w-full object-contain" />
            <p className="text-center text-xs tracking-[2px] text-white/30 uppercase mt-4">
              {lightboxIndex! + 1} / {photos.length}
            </p>
          </div>
          <button
            className="absolute right-6 text-white/40 hover:text-white text-2xl transition-colors px-4 py-8 z-10"
            onClick={(e) => { e.stopPropagation(); next(); }}
          >
            →
          </button>
        </div>
      )}
    </>
  );
}
