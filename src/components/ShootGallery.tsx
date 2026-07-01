"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type MediaItem = {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  service_type: string;
  preview_url: string | null;
  download_url: string | null;
  created_at: string;
};

type Props = {
  shootId: string;
  services?: string[];
  onMediaChange?: (count: number) => void;
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

export default function ShootGallery({ shootId, services = [], onMediaChange }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxItems, setLightboxItems] = useState<MediaItem[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Per-section upload state: keyed by service slug (or "" for ungrouped)
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [draggingSection, setDraggingSection] = useState<string | null>(null);
  const dragCounters = useRef<Record<string, number>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/media?shoot_id=${shootId}`);
    if (!res.ok) { setLoading(false); return; }
    const d = await res.json();
    setMedia(d.media || []);
    setCanEdit(d.canEdit || false);
    setLoading(false);
    onMediaChange?.((d.media || []).length);
  }, [shootId, onMediaChange]);

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

  async function uploadFileList(files: File[], serviceSlug: string) {
    if (!files.length) return;
    setUploading(serviceSlug);
    setUploadError("");
    setDraggingSection(null);
    dragCounters.current[serviceSlug] = 0;
    let failed = 0;
    // Find the original service name from slug
    const serviceType = services.find(s => slugify(s) === serviceSlug) || serviceSlug;
    for (const file of files) {
      const fd = new FormData();
      fd.append("shoot_id", shootId);
      fd.append("file", file);
      if (serviceSlug) fd.append("service_type", serviceType);
      const res = await fetch("/api/photographer/upload", { method: "POST", body: fd });
      if (!res.ok) failed++;
    }
    setUploading(null);
    if (failed > 0) setUploadError(`${failed} file(s) failed to upload.`);
    if (fileRefs.current[serviceSlug]) fileRefs.current[serviceSlug]!.value = "";
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

  async function downloadAll(items: MediaItem[]) {
    for (const m of items) {
      if (!m.download_url) continue;
      const a = document.createElement("a");
      a.href = m.download_url;
      a.download = m.file_name;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
    const isUploading = uploading === slug;

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
        uploadFileList(files, slug);
      } else if (dropped.length) {
        setUploadError(`${dropped.length} file(s) weren't recognized as photos/videos and weren't uploaded.`);
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
        {/* Upload overlay */}
        {isUploading && (
          <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center">
            <p className="text-xs tracking-[3px] uppercase text-white">Uploading...</p>
          </div>
        )}

        {/* Section toolbar */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-xs text-[#555]">{section.items.length} file{section.items.length !== 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            {section.items.length > 0 && (
              <button onClick={() => downloadAll(section.items)}
                className="text-xs tracking-[2px] uppercase text-white border border-white/20 px-3 py-1.5 hover:bg-white/5 transition-colors">
                ↓ Download All
              </button>
            )}
            {canEdit && (
              <label className="text-xs tracking-[2px] uppercase bg-white text-black px-3 py-1.5 hover:bg-white/90 transition-colors font-semibold cursor-pointer">
                + Add Files
                <input
                  ref={el => { fileRefs.current[slug] = el; }}
                  type="file" multiple accept="image/*,video/*" className="hidden"
                  disabled={!!uploading}
                  onChange={e => { if (e.target.files?.length) uploadFileList(Array.from(e.target.files), slug); }}
                />
              </label>
            )}
          </div>
        </div>

        {/* Grid or empty state */}
        {section.items.length === 0 ? (
          canEdit ? (
            <label className="flex flex-col items-center justify-center bg-[#0c0c0c] border border-white/10 border-dashed p-6 cursor-pointer hover:bg-white/[0.02] transition-colors">
              <span className="text-xl mb-1">↑</span>
              <span className="text-xs text-[#555]">Click to select or drag files here</span>
              <input
                ref={el => { fileRefs.current[slug] = el; }}
                type="file" multiple accept="image/*,video/*" className="hidden"
                disabled={!!uploading}
                onChange={e => { if (e.target.files?.length) uploadFileList(Array.from(e.target.files), slug); }}
              />
            </label>
          ) : (
            <div className="bg-[#0c0c0c] border border-white/5 p-6 text-center">
              <p className="text-xs text-[#333]">No media yet</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {section.items.map((m, idx) => (
              <div key={m.id} className="relative group aspect-square bg-[#111] border border-white/10 overflow-hidden">
                <button className="w-full h-full" onClick={() => { setLightboxItems(section.items); setLightboxIdx(idx); }}>
                  {isImage(m) && m.preview_url ? (
                    <img src={m.preview_url} alt={m.file_name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <span className="text-2xl">{m.file_type?.startsWith("video/") ? "▶" : "📄"}</span>
                      <p className="text-[10px] text-[#555] px-2 text-center truncate w-full">{m.file_name}</p>
                    </div>
                  )}
                </button>
                {/* Hover: download only (no delete X) */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-start p-2 pointer-events-none group-hover:pointer-events-auto">
                  <a href={m.download_url || "#"} download={m.file_name} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] tracking-[1px] uppercase text-white border border-white/30 px-2 py-1 hover:bg-white/10 transition-colors">
                    ↓
                  </a>
                </div>
              </div>
            ))}
          </div>
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

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-5 text-white/60 hover:text-white text-2xl leading-none z-10" onClick={() => setLightboxIdx(null)}>✕</button>

          {lightboxIdx > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-10 px-2"
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i - 1 : i); }}>‹</button>
          )}
          {lightboxIdx < lightboxItems.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-10 px-2"
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i + 1 : i); }}>›</button>
          )}

          <div className="max-w-5xl max-h-[85vh] w-full px-16" onClick={e => e.stopPropagation()}>
            {(() => {
              const m = lightboxItems[lightboxIdx];
              return (
                <div className="flex flex-col items-center gap-4">
                  {isImage(m) && m.preview_url ? (
                    <img src={m.preview_url} alt={m.file_name} className="max-h-[70vh] max-w-full object-contain" />
                  ) : m.file_type?.startsWith("video/") && m.preview_url ? (
                    <video src={m.preview_url} controls className="max-h-[70vh] max-w-full" />
                  ) : (
                    <div className="bg-[#111] border border-white/10 p-12 text-center">
                      <p className="text-4xl mb-3">📄</p>
                      <p className="text-sm text-[#888]">{m.file_name}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <p className="text-xs text-[#555]">{m.file_name} · {lightboxIdx + 1} of {lightboxItems.length}</p>
                    <a href={m.download_url || "#"} download={m.file_name} target="_blank" rel="noopener noreferrer"
                      className="text-xs tracking-[2px] uppercase text-white border border-white/20 px-4 py-2 hover:bg-white/5 transition-colors">
                      ↓ Download
                    </a>
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
        </div>
      )}

      {/* Delete confirmation */}
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
    </div>
  );
}
