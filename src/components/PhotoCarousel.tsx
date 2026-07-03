"use client";

import { useState } from "react";

type Photo = { src: string; alt?: string; missingLabel?: string };

export default function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const current = photos[index];

  function prev() { setIndex((i) => (i - 1 + photos.length) % photos.length); }
  function next() { setIndex((i) => (i + 1) % photos.length); }

  return (
    <div>
      <div className="relative">
        {/* Main photo */}
        <div
          className="relative w-full overflow-hidden bg-[#111]"
          style={{ aspectRatio: "3/2" }}
          onClick={() => current.src && setLightbox(true)}
        >
          {current.src ? (
            <img
              src={current.src}
              alt={current.alt || ""}
              className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#333] text-xs tracking-[2px] uppercase">
              <span>Missing</span>
              {current.missingLabel && <span className="text-[10px] tracking-normal normal-case text-[#444] font-mono lowercase">{current.missingLabel}</span>}
            </div>
          )}
        </div>

        {/* Prev / Next */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
            >
              ←
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
            >
              →
            </button>

            {/* Dots + counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
              <div className="flex items-center gap-2">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`Go to ${i + 1}`}
                    className={`w-2 h-2 rounded-full transition-all ${i === index ? "bg-white w-6" : "bg-white/40 hover:bg-white/70"}`}
                  />
                ))}
              </div>
              <span className="text-[10px] tracking-[2px] uppercase text-white/60 bg-black/50 px-2 py-1">
                {index + 1} / {photos.length}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Thumbnail reel */}
      {photos.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`View photo ${i + 1}`}
              className={`relative shrink-0 w-28 overflow-hidden transition-all bg-[#111] ${i === index ? "opacity-100 ring-2 ring-white" : "opacity-50 hover:opacity-80 ring-1 ring-white/10"}`}
              style={{ aspectRatio: "3/2" }}
            >
              {p.src ? (
                <img src={p.src} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[8px] tracking-[1px] uppercase text-[#444]">Missing</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && current.src && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <button className="absolute top-6 right-8 text-white/50 hover:text-white text-xs tracking-[3px] uppercase transition-colors" onClick={() => setLightbox(false)}>
            Close ✕
          </button>
          <button
            className="absolute left-6 text-white/40 hover:text-white text-2xl transition-colors px-4 py-8"
            onClick={(e) => { e.stopPropagation(); prev(); }}
          >
            ←
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-w-6xl max-h-[90vh] px-16">
            <img src={current.src} alt="" className="max-h-[90vh] max-w-full object-contain" />
            <p className="text-center text-xs tracking-[2px] text-white/30 uppercase mt-4">
              {index + 1} / {photos.length}
            </p>
          </div>
          <button
            className="absolute right-6 text-white/40 hover:text-white text-2xl transition-colors px-4 py-8"
            onClick={(e) => { e.stopPropagation(); next(); }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
