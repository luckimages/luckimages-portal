"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";

type MediaItem = {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  service_type: string;
  preview_url: string | null;
  download_url: string | null;
  created_at: string;
  // Set by /api/media only for pre-existing uploads that predate the baked-in
  // server-side watermark — the CSS overlay below is a fallback for those,
  // not the primary protection anymore.
  needsCssWatermark?: boolean;
};

// A file picked (or dropped) but not yet uploaded — shown with a local,
// instant preview so the grid never sits blank, and removable before it's
// actually sent anywhere, so a wrong pick or a duplicate never has to go
// all the way to upload-then-delete.
type StagedFile = {
  key: string;
  file: File;
  fileName: string;
  previewUrl: string | null;
  status: "staged" | "uploading" | "failed";
};

type Props = {
  shootId: string;
  services?: string[];
  onMediaChange?: (count: number) => void;
  canDownload?: boolean;
  onDeliver?: () => Promise<void>;
  isDelivered?: boolean;
};

// Convert "HDR Photography" → "hdr-photography" (matches upload slug)
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Convert slug back to a display-friendly name using the known services list
function displayName(slug: string, services: string[]) {
  const match = services.find(s => slugify(s) === slug);
  return match || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const MEDIA_EXTENSIONS = [
  "jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "tif", "tiff",
  "cr2", "cr3", "nef", "arw", "dng", "raf", "orf", "rw2",
  "mp4", "mov", "m4v", "avi", "mkv", "webm",
];

// Drag-and-drop reports File.type from OS MIME registration, which is often blank
// for camera RAW files (and sometimes ordinary photos) — fall back to the extension
// so real files don't get silently dropped with zero feedback.
function isMediaFile(f: File): boolean {
  if (f.type.startsWith("image/") || f.type.startsWith("video/")) return true;
  const ext = f.name.split(".").pop()?.toLowerCase() || "";
  return MEDIA_EXTENSIONS.includes(ext);
}

type DownloadSize = "small" | "large";

// Popover shown wherever a download is triggered — client picks web-optimized
// (small) or full-resolution (large) before anything actually downloads.
function DownloadSizeMenu({ onSelect, onClose, align = "right" }: { onSelect: (size: DownloadSize) => void; onClose: () => void; align?: "left" | "right" }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); onClose(); }} />
      <div
        onClick={e => e.stopPropagation()}
        className={`absolute z-50 top-full mt-2 ${align === "right" ? "right-0" : "left-0"} w-72 bg-[#111] border border-white/15 shadow-xl p-1.5`}
      >
        <button onClick={() => onSelect("small")} className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors">
          <p className="text-xs font-semibold text-white flex items-center gap-2 flex-wrap">
            Small — Web &amp; MLS
            <span className="text-[9px] tracking-[1px] uppercase text-[#4ade80] border border-[#4ade80]/30 px-1.5 py-0.5">Recommended</span>
          </p>
          <p className="text-[11px] text-[#666] mt-1 leading-relaxed">Optimized for MLS listings, social media, and websites — loads faster and uploads without a fight.</p>
        </button>
        <div className="h-px bg-white/5 my-1" />
        <button onClick={() => onSelect("large")} className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors">
          <p className="text-xs font-semibold text-white">Large — Full Resolution</p>
          <p className="text-[11px] text-[#666] mt-1 leading-relaxed">Untouched full quality. Best for print, brochures, and professional use.</p>
        </button>
      </div>
    </>
  );
}

export default function ShootGallery({ shootId, services = [], onMediaChange, canDownload = true, onDeliver, isDelivered = false }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxItems, setLightboxItems] = useState<MediaItem[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Per-section upload state: keyed by service slug (or "" for ungrouped)
  const [uploading, setUploading] = useState<string | null>(null);
  // Keyed by service slug — files picked/dropped but not yet confirmed for
  // upload. Nothing here has touched the server until "Confirm Upload".
  const [stagedFiles, setStagedFiles] = useState<Record<string, StagedFile[]>>({});
  const [uploadError, setUploadError] = useState("");
  const [draggingSection, setDraggingSection] = useState<string | null>(null);
  const [confirmedSections, setConfirmedSections] = useState<Set<string>>(new Set());
  const [delivering, setDelivering] = useState(false);
  const [delivered, setDelivered] = useState(isDelivered);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  // Which download-size menu is open, if any: a media id (per-item), a
  // section slug prefixed "all:" (Download All), or "lightbox".
  const [downloadMenuFor, setDownloadMenuFor] = useState<string | null>(null);
  const dragCounters = useRef<Record<string, number>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const filmstripActiveRef = useRef<HTMLButtonElement | null>(null);

  // Parent components often pass a new onMediaChange function identity on every
  // render — keep it in a ref so it doesn't force load() (and therefore the
  // fetch-on-mount effect) to re-run and re-fetch in a loop, which was causing
  // signed URLs to regenerate constantly and thumbnails to flicker.
  const onMediaChangeRef = useRef(onMediaChange);
  useEffect(() => { onMediaChangeRef.current = onMediaChange; }, [onMediaChange]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/media?shoot_id=${shootId}`);
    if (!res.ok) { setLoading(false); return; }
    const d = await res.json();
    setMedia(d.media || []);
    setCanEdit(d.canEdit || false);
    setLoading(false);
    onMediaChangeRef.current?.((d.media || []).length);
  }, [shootId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxIdx === null) return;
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowRight") setLightboxIdx(i => i !== null && i < lightboxItems.length - 1 ? i + 1 : i);
      if (e.key === "ArrowLeft") setLightboxIdx(i => i !== null && i > 0 ? i - 1 : i);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, lightboxItems.length]);

  // Sync delivered state when the parent tells us the shoot is already delivered
  useEffect(() => { if (isDelivered) setDelivered(true); }, [isDelivered]);

  // Keep the active filmstrip thumb in view when navigating via arrows/keys
  useEffect(() => {
    filmstripActiveRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [lightboxIdx]);

  // Close any open download-size menu when the lightbox navigates or closes
  useEffect(() => { setDownloadMenuFor(null); }, [lightboxIdx]);

  // Picking/dropping files only stages them locally — nothing touches the
  // server until "Confirm Upload". Appends to any already-staged files for
  // this section rather than replacing, so multiple picks/drops stack up.
  function stageFiles(files: File[], serviceSlug: string) {
    if (!files.length) return;
    setUploadError("");
    setDraggingSection(null);
    dragCounters.current[serviceSlug] = 0;
    const staged: StagedFile[] = files.map((file, i) => ({
      key: `${Date.now()}_${i}_${file.name}`,
      file,
      fileName: file.name,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      status: "staged",
    }));
    setStagedFiles(prev => ({ ...prev, [serviceSlug]: [...(prev[serviceSlug] || []), ...staged] }));
    if (fileRefs.current[serviceSlug]) fileRefs.current[serviceSlug]!.value = "";
  }

  function removeStagedFile(serviceSlug: string, key: string) {
    setStagedFiles(prev => {
      const item = (prev[serviceSlug] || []).find(p => p.key === key);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return { ...prev, [serviceSlug]: (prev[serviceSlug] || []).filter(p => p.key !== key) };
    });
  }

  async function confirmUpload(serviceSlug: string) {
    const staged = (stagedFiles[serviceSlug] || []).filter(p => p.status === "staged");
    if (!staged.length) return;
    setUploading(serviceSlug);
    setUploadError("");
    let failed = 0;
    // Find the original service name from slug
    const serviceType = services.find(s => slugify(s) === serviceSlug) || serviceSlug;
    const supabase = createClient();

    setStagedFiles(prev => ({
      ...prev,
      [serviceSlug]: (prev[serviceSlug] || []).map(p => staged.some(s => s.key === p.key) ? { ...p, status: "uploading" } : p),
    }));

    for (const item of staged) {
      const file = item.file;

      // Upload straight from the browser to Supabase Storage — real estate
      // (and especially drone/HDR) originals routinely blow past Vercel's
      // hard 4.5MB serverless request-body limit, which silently failed
      // every file that size regardless of our own code. Only a small JSON
      // pointer goes through our API route now; the bytes never do.
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = serviceSlug
        ? `${shootId}/${serviceSlug}/${timestamp}_${safeName}`
        : `${shootId}/${timestamp}_${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from("shoot-media")
        .upload(filePath, file, { contentType: file.type || "application/octet-stream", upsert: false, cacheControl: "31536000" });
      if (uploadErr) {
        failed++;
        setStagedFiles(prev => ({ ...prev, [serviceSlug]: (prev[serviceSlug] || []).map(p => p.key === item.key ? { ...p, status: "failed" } : p) }));
        continue;
      }

      const res = await fetch("/api/photographer/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shoot_id: shootId,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type || "application/octet-stream",
          service_type: serviceSlug ? serviceType : undefined,
        }),
      });
      if (!res.ok) {
        failed++;
        setStagedFiles(prev => ({ ...prev, [serviceSlug]: (prev[serviceSlug] || []).map(p => p.key === item.key ? { ...p, status: "failed" } : p) }));
        continue;
      }

      // Success — drop this staged entry and pull in the real media list so
      // its actual thumbnail shows up now instead of waiting for the batch.
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      setStagedFiles(prev => ({ ...prev, [serviceSlug]: (prev[serviceSlug] || []).filter(p => p.key !== item.key) }));
      await load();
    }
    setUploading(null);
    if (failed > 0) setUploadError(`${failed} file(s) failed to upload.`);
    await load();
  }

  async function deleteMedia(id: string) {
    setDeleting(id);
    await fetch("/api/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setMedia(prev => prev.filter(m => m.id !== id));
    setDeleting(null);
    setConfirmDelete(null);
    if (lightboxIdx !== null) setLightboxIdx(null);
    onMediaChange?.(media.length - 1);
  }

  async function batchDeleteSelected() {
    setBatchDeleting(true);
    const ids = Array.from(batchSelected);
    for (const id of ids) {
      await fetch("/api/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    }
    setMedia(prev => prev.filter(m => !batchSelected.has(m.id)));
    onMediaChange?.(media.length - ids.length);
    setBatchSelected(new Set());
    setBatchMode(false);
    setBatchDeleting(false);
    setConfirmBatchDelete(false);
  }

  function toggleBatchItem(id: string) {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function downloadHref(m: MediaItem, size: DownloadSize): string | null {
    if (size === "large") return m.download_url;
    // Small/web is generated on demand — every image gets a URL regardless
    // of whether a signed large download_url exists, as long as we're
    // allowed to download at all (canDownload already gates whether this
    // function is ever reachable in the UI).
    return `/api/portal/download-web?media_id=${m.id}`;
  }

  function triggerDownload(m: MediaItem, size: DownloadSize) {
    const href = downloadHref(m, size);
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = size === "large" ? m.file_name : `${m.file_name.replace(/\.[^.]+$/, "")}-web.jpg`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function downloadAll(items: MediaItem[], size: DownloadSize) {
    for (const m of items) {
      if (!isImage(m) && size === "small") { triggerDownload(m, "large"); await new Promise(r => setTimeout(r, 250)); continue; }
      triggerDownload(m, size);
      await new Promise(r => setTimeout(r, 250));
    }
  }

  const isImage = (m: MediaItem) => m.file_type?.startsWith("image/");

  // Build sections: one per service (by slug), plus "Other" for untagged
  const serviceSections: { slug: string; label: string; items: MediaItem[] }[] = [];

  if (services.length > 0) {
    for (const svc of services) {
      const slug = slugify(svc);
      const items = media.filter(m => m.service_type === slug);
      serviceSections.push({ slug, label: svc, items });
    }
    // Untagged = not matching any known service slug
    const knownSlugs = services.map(slugify);
    const other = media.filter(m => !knownSlugs.includes(m.service_type));
    if (other.length > 0) serviceSections.push({ slug: "", label: "Other", items: other });
  } else {
    // No services provided — show everything in one ungrouped section
    serviceSections.push({ slug: "", label: "", items: media });
  }

  if (loading) {
    return <div className="py-8 text-center text-xs text-[#444] tracking-[2px] uppercase">Loading media...</div>;
  }

  function SectionGrid({ section }: { section: typeof serviceSections[0] }) {
    const slug = section.slug;
    const isDragging = draggingSection === slug;
    const staged = stagedFiles[slug] || [];
    const readyToConfirm = staged.filter(p => p.status === "staged").length;
    const isConfirmed = confirmedSections.has(slug);

    function onDragEnter(e: React.DragEvent) {
      if (!canEdit) return;
      e.preventDefault();
      dragCounters.current[slug] = (dragCounters.current[slug] || 0) + 1;
      if (dragCounters.current[slug] === 1) setDraggingSection(slug);
    }
    function onDragLeave(e: React.DragEvent) {
      if (!canEdit) return;
      e.preventDefault();
      dragCounters.current[slug] = (dragCounters.current[slug] || 0) - 1;
      if (dragCounters.current[slug] <= 0) setDraggingSection(null);
    }
    function onDragOver(e: React.DragEvent) { e.preventDefault(); }
    function onDrop(e: React.DragEvent) {
      if (!canEdit) return;
      e.preventDefault();
      setDraggingSection(null);
      dragCounters.current[slug] = 0;
      const dropped = Array.from(e.dataTransfer.files);
      const files = dropped.filter(isMediaFile);
      if (files.length) {
        stageFiles(files, slug);
      } else if (dropped.length) {
        setUploadError(`${dropped.length} file(s) weren't recognized as photos/videos and weren't added.`);
      }
    }

    return (
      <div
        className="relative"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-20 border-2 border-dashed border-white/60 bg-black/70 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-2xl mb-1">↑</p>
              <p className="text-xs font-semibold tracking-[2px] uppercase">Drop to Upload{section.label ? ` — ${section.label}` : ""}</p>
            </div>
          </div>
        )}
        {/* Hidden file input for drag-and-drop stageFiles ref */}
        <input
          ref={el => { fileRefs.current[slug] = el; }}
          type="file" multiple accept="image/*,video/*" className="hidden"
          disabled={!!uploading}
          onChange={e => { if (e.target.files?.length) stageFiles(Array.from(e.target.files), slug); }}
        />

        {/* Section toolbar */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-xs text-[#555]">{section.items.length} file{section.items.length !== 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            {canEdit && section.items.length > 0 && (
              batchMode ? (
                <>
                  {batchSelected.size > 0 && (
                    <button
                      onClick={() => setConfirmBatchDelete(true)}
                      className="text-xs tracking-[2px] uppercase px-3 py-1.5 border border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors font-semibold">
                      Delete ({batchSelected.size})
                    </button>
                  )}
                  <button
                    onClick={() => { setBatchMode(false); setBatchSelected(new Set()); }}
                    className="text-xs tracking-[2px] uppercase px-3 py-1.5 border border-white/20 text-[#888] hover:text-white hover:border-white/40 transition-colors">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setBatchMode(true)}
                  className="text-xs tracking-[2px] uppercase px-3 py-1.5 border border-white/20 text-[#888] hover:text-white hover:border-white/40 transition-colors">
                  Batch Select
                </button>
              )
            )}
            {section.items.length > 0 && canDownload && (
              <div className="relative">
                <button onClick={() => setDownloadMenuFor(downloadMenuFor === `all:${slug}` ? null : `all:${slug}`)}
                  className="text-xs tracking-[2px] uppercase text-white border border-white/20 px-3 py-1.5 hover:bg-white/5 transition-colors">
                  ↓ Download All
                </button>
                {downloadMenuFor === `all:${slug}` && (
                  <DownloadSizeMenu
                    onClose={() => setDownloadMenuFor(null)}
                    onSelect={size => { setDownloadMenuFor(null); downloadAll(section.items, size); }}
                  />
                )}
              </div>
            )}
            {canEdit && onDeliver && (
              <button
                onClick={delivered ? undefined : async () => {
                  setDelivering(true);
                  try { await onDeliver(); setDelivered(true); } finally { setDelivering(false); }
                }}
                disabled={delivering}
                className={`text-xs tracking-[2px] uppercase px-3 py-1.5 font-semibold transition-colors ${
                  delivered
                    ? "bg-[#4ade80] text-black cursor-default"
                    : "bg-white text-black hover:bg-white/90 disabled:opacity-40"
                }`}>
                {delivered ? "Delivered ✓" : delivering ? "Delivering..." : "Deliver"}
              </button>
            )}
          </div>
        </div>

        {/* Grid or empty state */}
        {section.items.length === 0 && staged.length === 0 ? (
          canEdit ? (
            <label className="flex flex-col items-center justify-center bg-[#0c0c0c] border border-white/10 border-dashed p-6 cursor-pointer hover:bg-white/[0.02] transition-colors">
              <span className="text-xl mb-1">↑</span>
              <span className="text-xs text-[#555]">Click to select or drag files here</span>
              <input
                ref={el => { fileRefs.current[slug] = el; }}
                type="file" multiple accept="image/*,video/*" className="hidden"
                disabled={!!uploading}
                onChange={e => { if (e.target.files?.length) stageFiles(Array.from(e.target.files), slug); }}
              />
            </label>
          ) : (
            <div className="bg-[#0c0c0c] border border-white/5 p-6 text-center">
              <p className="text-xs text-[#333]">No media yet</p>
            </div>
          )
        ) : (
          <>
            {(() => {
              // Merge staged + uploaded into one alphabetically sorted grid
              type GridEntry =
                | { kind: "staged"; p: StagedFile }
                | { kind: "uploaded"; m: MediaItem; origIdx: number };
              const allItems: GridEntry[] = [
                ...staged.map(p => ({ kind: "staged" as const, p })),
                ...section.items.map((m, origIdx) => ({ kind: "uploaded" as const, m, origIdx })),
              ];
              allItems.sort((a, b) => {
                const nameA = a.kind === "staged" ? a.p.fileName : a.m.file_name;
                const nameB = b.kind === "staged" ? b.p.fileName : b.m.file_name;
                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
              });
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {allItems.map(entry => {
                    if (entry.kind === "staged") {
                      const p = entry.p;
                      return (
                        <div key={p.key} className="relative aspect-square bg-[#111] border border-white/10 overflow-hidden">
                          {p.previewUrl ? (
                            <img src={p.previewUrl} alt={p.fileName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                              <span className="text-2xl">📄</span>
                              <p className="text-[10px] text-[#555] px-2 text-center truncate w-full">{p.fileName}</p>
                            </div>
                          )}
                          {p.status === "uploading" ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            </div>
                          ) : (
                            <>
                              {p.status === "failed" && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                  <span className="text-[10px] tracking-[1px] uppercase text-red-400 bg-black/70 px-2 py-1">Failed</span>
                                </div>
                              )}
                              <button onClick={() => removeStagedFile(slug, p.key)}
                                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-black/70 text-white/80 hover:bg-red-500 hover:text-white text-xs leading-none transition-colors"
                                title="Remove">
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      );
                    } else {
                      const { m, origIdx } = entry;
                      const isSelected = batchSelected.has(m.id);
                      return (
                        <div key={m.id}
                          className={`relative group aspect-square bg-[#111] border overflow-hidden transition-all ${batchMode ? "cursor-pointer" : ""} ${isSelected ? "border-white" : "border-white/10"}`}
                          onClick={batchMode ? () => toggleBatchItem(m.id) : undefined}>
                          <button className="w-full h-full" disabled={batchMode}
                            onClick={!batchMode ? () => { setLightboxItems(section.items); setLightboxIdx(origIdx); } : undefined}>
                            {isImage(m) && m.preview_url ? (
                              <img src={m.preview_url} alt={m.file_name} className={`w-full h-full object-cover transition-transform ${!batchMode ? "group-hover:scale-105" : ""}`} />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                <span className="text-2xl">{m.file_type?.startsWith("video/") ? "▶" : "📄"}</span>
                                <p className="text-[10px] text-[#555] px-2 text-center truncate w-full">{m.file_name}</p>
                              </div>
                            )}
                          </button>
                          {/* Batch select overlay */}
                          {batchMode && (
                            <div className={`absolute inset-0 transition-colors ${isSelected ? "bg-white/10" : "hover:bg-white/5"}`}>
                              <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "border-white bg-white" : "border-white/40 bg-black/40"}`}>
                                {isSelected && <span className="text-black text-[10px] font-bold leading-none">✓</span>}
                              </div>
                            </div>
                          )}
                          {/* Fallback CSS watermark — only for uploads that predate the
                              baked-in server-side watermark on the thumbnail itself */}
                          {!canDownload && !batchMode && m.needsCssWatermark && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                              <div className="absolute -inset-8 flex flex-wrap content-evenly justify-evenly gap-3 -rotate-[25deg]">
                                {Array.from({ length: 12 }).map((_, i) => (
                                  <span key={i} className="text-white/30 text-[8px] tracking-[2px] uppercase font-black whitespace-nowrap shrink-0">Luck Images</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Hover actions (non-batch mode) */}
                          {!batchMode && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-start p-2 pointer-events-none">
                              {canDownload ? (
                                isImage(m) ? (
                                  <div className="relative pointer-events-auto">
                                    <button onClick={() => setDownloadMenuFor(downloadMenuFor === m.id ? null : m.id)}
                                      className="text-[10px] tracking-[1px] uppercase text-white border border-white/30 px-2 py-1 hover:bg-white/10 transition-colors">
                                      ↓
                                    </button>
                                    {downloadMenuFor === m.id && (
                                      <DownloadSizeMenu
                                        align="left"
                                        onClose={() => setDownloadMenuFor(null)}
                                        onSelect={size => { setDownloadMenuFor(null); triggerDownload(m, size); }}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <a href={m.download_url || "#"} download={m.file_name} target="_blank" rel="noopener noreferrer"
                                    className="pointer-events-auto text-[10px] tracking-[1px] uppercase text-white border border-white/30 px-2 py-1 hover:bg-white/10 transition-colors">
                                    ↓
                                  </a>
                                )
                              ) : (
                                <span className="text-[10px] tracking-[1px] uppercase text-[#fbbf24] border border-[#fbbf24]/30 px-2 py-1">
                                  🔒
                                </span>
                              )}
                            </div>
                          )}
                          {/* Delete button (non-batch mode) */}
                          {canEdit && !batchMode && (
                            <button onClick={() => setConfirmDelete(m.id)}
                              className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-black/70 text-white/80 hover:bg-red-500 hover:text-white text-xs leading-none transition-colors"
                              title="Delete">
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    }
                  })}
                </div>
              );
            })()}
            {readyToConfirm > 0 && (
              <div className="mt-3 flex items-center justify-between gap-3 bg-[#0c0c0c] border border-white/10 px-4 py-3">
                <p className="text-xs text-[#888]">{readyToConfirm} file{readyToConfirm !== 1 ? "s" : ""} ready to upload</p>
                <button onClick={() => confirmUpload(slug)} disabled={uploading === slug}
                  className="text-xs tracking-[2px] uppercase bg-white text-black px-4 py-2 hover:bg-white/90 transition-colors font-semibold disabled:opacity-40">
                  {uploading === slug ? "Uploading..." : `Confirm Upload (${readyToConfirm})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Global error bar */}
      {uploadError && (
        <div className="mb-4 bg-red-400/5 border border-red-400/20 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-red-400 text-xs">{uploadError}</p>
          <button onClick={() => setUploadError("")} className="text-red-400/60 hover:text-red-400 text-sm leading-none">✕</button>
        </div>
      )}

      {/* Total file count */}
      {services.length > 0 && (
        <p className="text-xs text-[#444] mb-4">{media.length} total file{media.length !== 1 ? "s" : ""}</p>
      )}

      {/* Sections */}
      {serviceSections.map((section, i) => (
        <div key={section.slug || "__all__"} className={i > 0 ? "mt-6" : ""}>
          {section.label && (
            <div className="flex items-center gap-3 mb-3">
              <p className="text-[10px] tracking-[3px] uppercase text-[#666] font-semibold">{section.label}</p>
              <div className="flex-1 h-px bg-white/5" />
            </div>
          )}
          <SectionGrid section={section} />
        </div>
      ))}

      {/* Deliver to Client banner — shows when all non-empty sections are marked ready */}
      {(() => {
        if (!onDeliver || !canEdit) return null;
        const nonEmpty = serviceSections.filter(s => s.items.length > 0);
        if (nonEmpty.length === 0) return null;
        const allReady = nonEmpty.every(s => confirmedSections.has(s.slug));
        if (!allReady) return null;
        return (
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#4ade80]/5 border border-[#4ade80]/30 px-6 py-5">
            <div>
              <p className="text-sm font-semibold text-[#4ade80]">All media is marked ready</p>
              <p className="text-xs text-[#555] mt-1">Click to deliver — the client will receive an email with a direct link to their gallery.</p>
            </div>
            <button
              onClick={delivered ? undefined : async () => {
                setDelivering(true);
                try { await onDeliver(); setDelivered(true); } finally { setDelivering(false); }
              }}
              disabled={delivering}
              className="shrink-0 text-xs tracking-[3px] uppercase font-semibold bg-[#4ade80] text-black px-6 py-3 hover:bg-[#4ade80]/90 transition-colors disabled:opacity-50"
            >
              {delivered ? "Delivered ✓" : delivering ? "Delivering…" : "Deliver to Client →"}
            </button>
          </div>
        );
      })()}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div data-lightbox-open="true" className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-5 text-white/60 hover:text-white text-2xl leading-none z-10" onClick={() => setLightboxIdx(null)}>✕</button>

          {lightboxIdx > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-10 px-2"
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i - 1 : i); }}>‹</button>
          )}
          {lightboxIdx < lightboxItems.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-10 px-2"
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i + 1 : i); }}>›</button>
          )}

          <div className="max-w-[92vw] max-h-[85vh] w-full px-12" onClick={e => e.stopPropagation()}>
            {(() => {
              const m = lightboxItems[lightboxIdx];
              return (
                <div className="flex flex-col items-center gap-4">
                  {isImage(m) && m.preview_url ? (
                    <div className="relative">
                      <img src={m.preview_url} alt={m.file_name} className="max-h-[72vh] max-w-full object-contain" />
                      {!canDownload && m.needsCssWatermark && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                          <div className="absolute -inset-16 flex flex-wrap content-evenly justify-evenly gap-8 -rotate-[20deg]">
                            {Array.from({ length: 30 }).map((_, i) => (
                              <span key={i} className="text-white/25 text-xs tracking-[3px] uppercase font-black whitespace-nowrap shrink-0">Luck Images</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : m.file_type?.startsWith("video/") && m.preview_url ? (
                    <video src={m.preview_url} controls className="max-h-[72vh] max-w-full" />
                  ) : (
                    <div className="bg-[#111] border border-white/10 p-12 text-center">
                      <p className="text-4xl mb-3">📄</p>
                      <p className="text-sm text-[#888]">{m.file_name}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <p className="text-xs text-[#555]">{m.file_name} · {lightboxIdx + 1} of {lightboxItems.length}</p>
                    {canDownload ? (
                      isImage(m) ? (
                        <div className="relative">
                          <button onClick={() => setDownloadMenuFor(downloadMenuFor === "lightbox" ? null : "lightbox")}
                            className="text-xs tracking-[2px] uppercase text-white border border-white/20 px-4 py-2 hover:bg-white/5 transition-colors">
                            ↓ Download
                          </button>
                          {downloadMenuFor === "lightbox" && (
                            <DownloadSizeMenu
                              align="left"
                              onClose={() => setDownloadMenuFor(null)}
                              onSelect={size => { setDownloadMenuFor(null); triggerDownload(m, size); }}
                            />
                          )}
                        </div>
                      ) : (
                        <a href={m.download_url || "#"} download={m.file_name} target="_blank" rel="noopener noreferrer"
                          className="text-xs tracking-[2px] uppercase text-white border border-white/20 px-4 py-2 hover:bg-white/5 transition-colors">
                          ↓ Download
                        </a>
                      )
                    ) : (
                      <span className="text-xs tracking-[2px] uppercase text-[#fbbf24] border border-[#fbbf24]/30 px-4 py-2">
                        🔒 Pay to Download
                      </span>
                    )}
                    {canEdit && (
                      <button onClick={() => setConfirmDelete(m.id)}
                        className="text-xs tracking-[2px] uppercase text-[#ef4444] border border-[#ef4444]/30 px-4 py-2 hover:bg-[#ef4444]/10 transition-colors">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Filmstrip — click any thumb to jump straight to it */}
          {lightboxItems.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8 bg-gradient-to-t from-black/90 to-transparent"
              onClick={e => e.stopPropagation()}>
              <div className="flex gap-2 overflow-x-auto max-w-full justify-center">
                {lightboxItems.map((item, i) => (
                  <button
                    key={item.id}
                    ref={i === lightboxIdx ? filmstripActiveRef : undefined}
                    onClick={() => setLightboxIdx(i)}
                    className={`shrink-0 w-14 h-14 border-2 overflow-hidden transition-all ${i === lightboxIdx ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"}`}
                  >
                    {isImage(item) && item.preview_url ? (
                      <img src={item.preview_url} alt={item.file_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center text-lg">📄</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Single delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setConfirmDelete(null)}>
          <div className="bg-[#111] border border-white/10 p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-2">Delete this file?</p>
            <p className="text-xs text-[#555] mb-6">This permanently removes the file from storage. Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 text-xs tracking-[2px] uppercase border border-white/10 py-2.5 text-[#555] hover:text-white transition-colors">Cancel</button>
              <button onClick={() => deleteMedia(confirmDelete)} disabled={deleting === confirmDelete}
                className="flex-1 text-xs tracking-[2px] uppercase bg-[#ef4444] text-white py-2.5 hover:bg-[#ef4444]/80 transition-colors disabled:opacity-40">
                {deleting === confirmDelete ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch delete confirmation */}
      {confirmBatchDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setConfirmBatchDelete(false)}>
          <div className="bg-[#111] border border-white/10 p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-2">Delete {batchSelected.size} file{batchSelected.size !== 1 ? "s" : ""}?</p>
            <p className="text-xs text-[#555] mb-6">This permanently removes all selected files from storage. Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBatchDelete(false)} className="flex-1 text-xs tracking-[2px] uppercase border border-white/10 py-2.5 text-[#555] hover:text-white transition-colors">Cancel</button>
              <button onClick={batchDeleteSelected} disabled={batchDeleting}
                className="flex-1 text-xs tracking-[2px] uppercase bg-[#ef4444] text-white py-2.5 hover:bg-[#ef4444]/80 transition-colors disabled:opacity-40">
                {batchDeleting ? "Deleting..." : `Delete ${batchSelected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
