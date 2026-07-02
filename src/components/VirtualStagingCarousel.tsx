"use client";

import { useState } from "react";
import BeforeAfterSlider from "./BeforeAfterSlider";

export default function VirtualStagingCarousel({
  pairs,
}: {
  pairs: { before: string; after: string }[];
}) {
  const [index, setIndex] = useState(0);

  function prev() { setIndex((i) => (i - 1 + pairs.length) % pairs.length); }
  function next() { setIndex((i) => (i + 1) % pairs.length); }

  return (
    <div className="relative">
      <BeforeAfterSlider
        key={index}
        before={pairs[index].before}
        after={pairs[index].after}
        heightClassName="h-[75vh]"
      />

      {/* Prev / Next */}
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
          {pairs.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to ${i + 1}`}
              className={`w-2 h-2 rounded-full transition-all ${i === index ? "bg-white w-6" : "bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
        <span className="text-[10px] tracking-[2px] uppercase text-white/60 bg-black/50 px-2 py-1">
          {index + 1} / {pairs.length}
        </span>
      </div>
    </div>
  );
}
