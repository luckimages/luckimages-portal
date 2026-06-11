"use client";

import { useState } from "react";

type Photo = { src: string; alt?: string };

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  function prev() { setLightbox((i) => (i! - 1 + photos.length) % photos.length); }
  function next() { setLightbox((i) => (i! + 1) % photos.length); }

  return (
    <>
      {/* Grid */}
      <div className="columns-2 md:columns-3 gap-2 space-y-2">
        {photos.map((p, i) => (
          <div
            key={i}
            onClick={() => setLightbox(i)}
            className="break-inside-avoid cursor-pointer overflow-hidden group"
          >
            {p.src ? (
              <img
                src={p.src}
                alt={p.alt || ""}
                className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full bg-[#1a1a1a] border border-white/5 flex items-center justify-center text-[#333] text-xs tracking-[2px] uppercase" style={{ aspectRatio: i % 3 === 0 ? "4/3" : i % 3 === 1 ? "3/4" : "16/9" }}>
                Photo
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          {/* Close */}
          <button className="absolute top-6 right-8 text-white/50 hover:text-white text-xs tracking-[3px] uppercase transition-colors" onClick={() => setLightbox(null)}>
            Close ✕
          </button>

          {/* Prev */}
          <button
            className="absolute left-6 text-white/40 hover:text-white text-2xl transition-colors px-4 py-8"
            onClick={(e) => { e.stopPropagation(); prev(); }}
          >
            ←
          </button>

          {/* Image */}
          <div onClick={(e) => e.stopPropagation()} className="max-w-5xl max-h-[85vh] px-16">
            {photos[lightbox].src ? (
              <img src={photos[lightbox].src} alt="" className="max-h-[85vh] max-w-full object-contain" />
            ) : (
              <div className="w-[800px] h-[500px] bg-[#1a1a1a] border border-white/10 flex items-center justify-center text-[#444] text-xs tracking-[2px] uppercase">
                Photo Placeholder
              </div>
            )}
            <p className="text-center text-xs tracking-[2px] text-white/30 uppercase mt-4">
              {lightbox + 1} / {photos.length}
            </p>
          </div>

          {/* Next */}
          <button
            className="absolute right-6 text-white/40 hover:text-white text-2xl transition-colors px-4 py-8"
            onClick={(e) => { e.stopPropagation(); next(); }}
          >
            →
          </button>
        </div>
      )}
    </>
  );
}
