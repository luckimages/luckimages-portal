"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type MediaItem = {
  id: string;
  file_name: string;
  file_type: string;
  preview_url: string | null;
  download_url: string | null;
  created_at: string;
};

type Props = {
  shootId: string;
  onMediaChange?: (count: number) => void;
};

export default function ShootGallery({ shootId, onMediaChange }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

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
      if (e.key === "ArrowRight") setLightboxIdx(i => i !== null && i < media.length - 1 ? i + 1 : i);
      if (e.key === "ArrowLeft") setLightboxIdx(i => i !== null && i > 0 ? i - 1 : i);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, media.length]);

  async function uploadFileList(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setDragging(false);
    for (const file of files) {
      const fd = new FormData();
      fd.append("shoot_id", shootId);
      fd.append("file", file);
      await fetch("/api/photographer/upload", { method: "POST", body: fd });
    }
    setUploading(false);
    setUploadOpen(false);
    if (fileRef.current) fileRef.current.value = "";
    await load();
  }

  async function uploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    await uploadFileList(Array.from(e.target.files));
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (files.length) uploadFileList(files);
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

  async function downloadAll() {
    for (const m of media) {
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

  if (loading) {
    return <div className="py-8 text-center text-xs text-[#444] tracking-[2px] uppercase">Loading media...</div>;
  }

  return (
    <div className="relative" onDragEnter={canEdit ? onDragEnter : undefined} onDragLeave={canEdit ? onDragLeave : undefined} onDragOver={canEdit ? onDragOver : undefined} onDrop={canEdit ? onDrop : undefined}>

      {/* Drag-over overlay */}
      {dragging && (
        <div className="absolute inset-0 z-20 border-2 border-dashed border-white/60 bg-black/70 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-3xl mb-2">↑</p>
            <p className="text-sm font-semibold tracking-[2px] uppercase">Drop to Upload</p>
          </div>
        </div>
      )}

      {/* Uploading overlay */}
      {uploading && (
        <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center">
          <p className="text-xs tracking-[3px] uppercase text-white">Uploading...</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs text-[#555]">{media.length} file{media.length !== 1 ? "s" : ""}</p>
        <div className="flex gap-2">
          {media.length > 0 && (
            <button onClick={downloadAll}
              className="text-xs tracking-[2px] uppercase text-white border border-white/20 px-4 py-2 hover:bg-white/5 transition-colors">
              ↓ Download All
            </button>
          )}
          {canEdit && (
            <button onClick={() => setUploadOpen(o => !o)}
              className="text-xs tracking-[2px] uppercase bg-white text-black px-4 py-2 hover:bg-white/90 transition-colors font-semibold">
              {uploadOpen ? "Cancel" : "+ Add Files"}
            </button>
          )}
        </div>
      </div>

      {/* Upload zone */}
      {canEdit && uploadOpen && (
        <label className="flex flex-col items-center justify-center bg-[#0c0c0c] border border-white/10 border-dashed p-8 mb-4 cursor-pointer hover:bg-white/[0.02] transition-colors">
          <span className="text-2xl mb-2">↑</span>
          <span className="text-sm text-[#666] mb-1">Click to select or drag files here</span>
          <span className="text-xs text-[#444]">JPG, PNG, MP4, DNG — any size</span>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" disabled={uploading} onChange={uploadFiles} />
        </label>
      )}

      {/* Grid */}
      {media.length === 0 ? (
        <div className="bg-[#111] border border-white/10 p-10 text-center">
          <p className="text-[#555] text-sm">No media uploaded yet.</p>
          {canEdit && <p className="text-xs text-[#333] mt-2">Use + Add Files above to upload.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {media.map((m, idx) => (
            <div key={m.id} className="relative group aspect-square bg-[#111] border border-white/10 overflow-hidden">
              {/* Thumbnail */}
              <button className="w-full h-full" onClick={() => setLightboxIdx(idx)}>
                {isImage(m) && m.preview_url ? (
                  <img src={m.preview_url} alt={m.file_name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <span className="text-2xl">{m.file_type?.startsWith("video/") ? "▶" : "📄"}</span>
                    <p className="text-[10px] text-[#555] px-2 text-center truncate w-full">{m.file_name}</p>
                  </div>
                )}
              </button>

              {/* Hover actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2 pointer-events-none group-hover:pointer-events-auto">
                <a href={m.download_url || "#"} download={m.file_name} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] tracking-[1px] uppercase text-white border border-white/30 px-2 py-1 hover:bg-white/10 transition-colors">
                  ↓
                </a>
                {canEdit && (
                  <button onClick={() => setConfirmDelete(m.id)}
                    className="text-[10px] tracking-[1px] uppercase text-[#ef4444] border border-[#ef4444]/30 px-2 py-1 hover:bg-[#ef4444]/10 transition-colors">
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-5 text-white/60 hover:text-white text-2xl leading-none z-10" onClick={() => setLightboxIdx(null)}>✕</button>

          {lightboxIdx > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-10 px-2"
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i - 1 : i); }}>‹</button>
          )}
          {lightboxIdx < media.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-10 px-2"
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i + 1 : i); }}>›</button>
          )}

          <div className="max-w-5xl max-h-[85vh] w-full px-16" onClick={e => e.stopPropagation()}>
            {(() => {
              const m = media[lightboxIdx];
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
                    <p className="text-xs text-[#555]">{m.file_name} · {lightboxIdx + 1} of {media.length}</p>
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
