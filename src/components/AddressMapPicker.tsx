"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

type Suggestion = { displayName: string; lat: number; lng: number };

type Props = {
  address: string;
  onAddressChange: (address: string) => void;
  lat: number | null;
  lng: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  inputCls: string;
  labelCls: string;
};

// Address input with OpenStreetMap-powered autocomplete, plus a map with a
// draggable pin so the realtor can nudge the marker onto the exact property —
// confirming the location themselves rather than us guessing from the
// address text alone.
export default function AddressMapPicker({ address, onAddressChange, lat, lng, onLocationChange, inputCls, labelCls }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  function handleAddressInput(value: string) {
    onAddressChange(value);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      }
      setSearching(false);
    }, 400);
  }

  function selectSuggestion(s: Suggestion) {
    onAddressChange(s.displayName);
    onLocationChange(s.lat, s.lng);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  // Mount the Leaflet map once a location exists, and keep the marker in
  // sync if the location changes from elsewhere (e.g. picking a new suggestion).
  useEffect(() => {
    if (lat == null || lng == null || !mapDivRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      // Bundlers don't resolve Leaflet's default marker image paths — point
      // them at the package's own CDN-hosted assets instead.
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (cancelled) return;

      if (!mapRef.current && mapDivRef.current) {
        const map = L.map(mapDivRef.current).setView([lat, lng], 18);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onLocationChange(pos.lat, pos.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
      } else if (mapRef.current && markerRef.current) {
        // Location changed externally (new suggestion picked) — recenter.
        const current = markerRef.current.getLatLng();
        if (Math.abs(current.lat - lat) > 1e-9 || Math.abs(current.lng - lng) > 1e-9) {
          markerRef.current.setLatLng([lat, lng]);
          mapRef.current.setView([lat, lng], 18);
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Clean up the map instance on unmount only.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <label className={labelCls}>Property Address</label>
      <div className="relative">
        <input
          type="text"
          required
          placeholder="123 Main St, Austin, TX 78701"
          value={address}
          onChange={e => handleAddressInput(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          className={inputCls}
        />
        {showSuggestions && (searching || suggestions.length > 0) && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#181818] border border-white/10 max-h-56 overflow-y-auto">
            {searching && <p className="text-xs text-[#555] px-3 py-2">Searching...</p>}
            {!searching && suggestions.map((s, i) => (
              <button key={i} type="button" onMouseDown={() => selectSuggestion(s)}
                className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors text-xs text-white/80 border-b border-white/5 last:border-b-0">
                {s.displayName}
              </button>
            ))}
          </div>
        )}
      </div>

      {lat != null && lng != null ? (
        <div className="flex flex-col gap-1.5">
          <div ref={mapDivRef} className="w-full h-64 border border-white/10" />
          <p className="text-[10px] text-[#555]">
            Drag the pin to line it up exactly with the property — this confirms the location on file.
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-[#444]">Pick a suggestion above to drop a pin you can fine-tune.</p>
      )}
    </div>
  );
}
