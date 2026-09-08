"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

type Props = {
  lat?: number | null;
  lng?: number | null;
  address?: string;
  /** Extra classes for the trigger button. */
  className?: string;
};

// A compact "Map" button that sits next to a shoot's address. When the realtor
// booked the shoot they dropped a confirmed pin — this shows that exact pin
// (read-only) so admin, photographers, and realtors can all see precisely
// where the property is when the address text alone isn't enough.
export default function ShootLocationMap({ lat, lng, address, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const hasPin = typeof lat === "number" && typeof lng === "number";

  useEffect(() => {
    if (!open || !hasPin || !mapDivRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapDivRef.current || mapRef.current) return;

      const pinIcon = L.divIcon({
        className: "luckimages-map-pin",
        html: `
          <div style="width:32px;height:42px;">
            <div style="width:32px;height:32px;border-radius:50%;background:#0c0c0c;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.45);box-sizing:border-box;overflow:hidden;">
              <img src="https://www.luckimages.com/logo.png" width="32" height="32" style="display:block;object-fit:cover;" alt="" />
            </div>
            <div style="width:0;height:0;margin:0 auto;border-left:6px solid transparent;border-right:6px solid transparent;border-top:11px solid #0c0c0c;"></div>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });

      const map = L.map(mapDivRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([lat as number, lng as number], 18);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      L.marker([lat as number, lng as number], { icon: pinIcon, interactive: false }).addTo(map);
      mapRef.current = map;
    })();

    return () => { cancelled = true; };
  }, [open, hasPin, lat, lng]);

  // Tear the map down whenever the panel closes so it re-initializes cleanly.
  useEffect(() => {
    if (open) return;
    mapRef.current?.remove();
    mapRef.current = null;
  }, [open]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  if (!hasPin) return null;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="inline-flex flex-col items-start">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className={`inline-flex items-center gap-1 text-[10px] tracking-[1px] uppercase px-2 py-1 border border-white/15 text-white/70 hover:text-white hover:border-white/40 transition-colors ${className}`}
        title="View the confirmed location pin"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {open ? "Hide map" : "Map"}
      </button>

      {open && (
        <div className="mt-2 w-[min(320px,80vw)] border border-white/10 bg-[#0c0c0c]" onClick={e => e.stopPropagation()}>
          <div ref={mapDivRef} className="w-full h-48" />
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/10">
            <span className="text-[9px] text-[#555] truncate pr-2">{address || "Confirmed pin"}</span>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] tracking-[1px] uppercase text-[#4ade80] hover:underline shrink-0"
            >
              Directions →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
