"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// How far the divider slants from top to bottom, in % of container width.
const SKEW_PCT = 5;

export default function BeforeAfterSlider({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (dragging) updatePosition(e.clientX);
  }, [dragging, updatePosition]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (dragging) updatePosition(e.touches[0].clientX);
  }, [dragging, updatePosition]);

  const stopDrag = useCallback(() => setDragging(false), []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", stopDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stopDrag);
    };
  }, [onMouseMove, onTouchMove, stopDrag]);

  const topX = Math.min(100, Math.max(0, position + SKEW_PCT));
  const bottomX = Math.min(100, Math.max(0, position - SKEW_PCT));

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden select-none cursor-ew-resize"
      style={{ aspectRatio: "16/9" }}
      onMouseDown={e => { setDragging(true); updatePosition(e.clientX); }}
      onTouchStart={e => { setDragging(true); updatePosition(e.touches[0].clientX); }}
    >
      {/* After (bottom layer, full width) */}
      <img src={after} alt={afterLabel} className="absolute inset-0 w-full h-full object-cover" draggable={false} />

      {/* Before (clipped to a diagonal edge) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `polygon(0 0, ${topX}% 0, ${bottomX}% 100%, 0 100%)` }}
      >
        <img src={before} alt={beforeLabel} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      </div>

      {/* Diagonal divider line */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <line
          x1={`${topX}%`} y1="0"
          x2={`${bottomX}%`} y2="100%"
          stroke="white"
          strokeWidth="2"
          style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.8))" }}
        />
      </svg>

      {/* Handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.5)] flex items-center justify-center gap-1 z-10"
        style={{ left: `${position}%` }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M5 8L2 5M2 5L5 2M2 5h12M11 8l3 3m-3-3l3-3M14 8H2" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 text-[10px] tracking-[2px] uppercase bg-black/60 text-white px-2 py-1 pointer-events-none">
        {beforeLabel}
      </span>
      <span className="absolute top-3 right-3 text-[10px] tracking-[2px] uppercase bg-black/60 text-white px-2 py-1 pointer-events-none">
        {afterLabel}
      </span>
    </div>
  );
}
