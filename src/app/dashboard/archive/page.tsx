"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

type Folder = { id: string; name: string; parent_id: string | null; created_by_name: string; created_at: string };
type ArchiveFile = { id: string; name: string; folder_id: string | null; size_bytes: number; content_type: string | null; uploaded_by_name: string; created_at: string };
type Sort = "name" | "date";
type Crumb = { id: string | null; name: string };

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ArchivePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "Archive" }]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("name");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolderId = crumbs[crumbs.length - 1].id;

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) { router.replace("/dashboard"); return; }
      setChecked(true);
    });
  }, [router]);

  const load = useCallback((folderId: string | null, s: Sort) => {
    setLoading(true);
    const q = new URLSearchParams({ sort: s });
    if (folderId) q.set("folder_id", folderId);
    fetch(`/api/archive?${q.toString()}`)
      .then(r => r.json())
      .then(d => { setFolders(d.folders ?? []); setFiles(d.files ?? []); setSearching(false); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (checked && !search) load(currentFolderId, sort); }, [checked, currentFolderId, sort, load, search]);

  function runSearch(term: string) {
    setSearch(term);
    if (!term.trim()) { load(currentFolderId, sort); return; }
    setLoading(true);
    fetch(`/api/archive?${new URLSearchParams({ search: term, sort })}`)
      .then(r => r.json())
      .then(d => { setFolders(d.folders ?? []); setFiles(d.files ?? []); setSearching(true); })
      .finally(() => setLoading(false));
  }

  function openFolder(folder: Folder) {
    setSearch("");
    setCrumbs(c => [...c, { id: folder.id, name: folder.name }]);
  }
  function goToCrumb(i: number) {
    setSearch("");
    setCrumbs(c => c.slice(0, i + 1));
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    await fetch("/api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_folder", name, parent_id: currentFolderId }),
    });
    setNewFolderName("");
    setNewFolderOpen(false);
    load(currentFolderId, sort);
  }

  async function uploadFiles(fileList: FileList | File[]) {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const urlRes = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upload_url", name: file.name, content_type: file.type, folder_id: currentFolderId }),
      }).then(r => r.json());
      if (!urlRes.uploadUrl) continue;
      await fetch(urlRes.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_file",
          folder_id: currentFolderId,
          name: file.name,
          file_key: urlRes.fileKey,
          size_bytes: file.size,
          content_type: file.type,
        }),
      });
    }
    setUploading(false);
    load(currentFolderId, sort);
  }

  async function downloadFile(file: ArchiveFile) {
    const res = await fetch(`/api/archive/download?id=${file.id}`).then(r => r.json());
    if (res.url) window.open(res.url, "_blank");
  }

  async function deleteFolder(folder: Folder, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${folder.name}" and everything inside it? This can't be undone.`)) return;
    await fetch(`/api/archive?type=folder&id=${folder.id}`, { method: "DELETE" });
    load(currentFolderId, sort);
  }
  async function deleteFile(file: ArchiveFile, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${file.name}"? This can't be undone.`)) return;
    await fetch(`/api/archive?type=file&id=${file.id}`, { method: "DELETE" });
    load(currentFolderId, sort);
  }

  if (!checked) return null;

  return (
    <div
      className="min-h-dvh bg-[#0c0c0c] text-white"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="text-[10px] tracking-[3px] uppercase text-[#555]">My Nocturne</div>
            <h1 className="text-3xl font-black tracking-tight uppercase mt-1">File Archive</h1>
          </div>
          <a href="/dashboard/me" className="text-xs text-[#555] hover:text-white transition-colors">← Back to My Nocturne</a>
        </div>

        {/* Search + sort + actions */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <input
            value={search}
            onChange={e => runSearch(e.target.value)}
            placeholder="Search all files and folders..."
            className="flex-1 min-w-[200px] bg-[#111] border border-white/10 focus:border-white/30 text-sm text-white px-3 py-2 outline-none"
          />
          <div className="flex border border-white/10">
            {(["name", "date"] as Sort[]).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-3 py-2 text-[10px] tracking-[1.5px] uppercase transition-colors ${sort === s ? "bg-white text-black font-bold" : "text-[#555] hover:text-white"}`}
              >
                {s === "name" ? "A–Z" : "Date"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setNewFolderOpen(true)}
            className="text-[10px] tracking-[1.5px] uppercase px-3 py-2 border border-white/20 text-[#555] hover:text-white hover:border-white/40 transition-all"
          >
            New Folder
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-[10px] tracking-[1.5px] uppercase px-3 py-2 bg-white text-black font-bold hover:bg-white/90 transition-all disabled:opacity-40"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {newFolderOpen && (
          <div className="flex items-center gap-2 mb-4 border border-white/10 p-3">
            <input
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setNewFolderOpen(false); }}
              placeholder="Folder name"
              className="flex-1 bg-[#0c0c0c] border border-white/10 focus:border-white/30 text-sm text-white px-3 py-1.5 outline-none"
            />
            <button onClick={createFolder} className="text-[10px] tracking-[1.5px] uppercase px-3 py-1.5 bg-white text-black font-bold">Create</button>
            <button onClick={() => setNewFolderOpen(false)} className="text-[10px] tracking-[1.5px] uppercase px-3 py-1.5 text-[#555] hover:text-white">Cancel</button>
          </div>
        )}

        {/* Breadcrumbs */}
        {!searching && (
          <div className="flex items-center gap-1.5 mb-4 text-xs flex-wrap">
            {crumbs.map((c, i) => (
              <span key={c.id ?? "root"} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[#444]">/</span>}
                <button
                  onClick={() => goToCrumb(i)}
                  className={i === crumbs.length - 1 ? "text-white font-semibold" : "text-[#666] hover:text-white transition-colors"}
                >
                  {c.name}
                </button>
              </span>
            ))}
          </div>
        )}
        {searching && <div className="text-xs text-[#666] mb-4">Search results for &ldquo;{search}&rdquo;</div>}

        {/* Drop zone hint */}
        {dragOver && (
          <div className="fixed inset-0 z-40 bg-black/70 border-4 border-dashed border-white/40 flex items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold">Drop to upload</span>
          </div>
        )}

        {loading ? (
          <div className="border border-white/5 px-5 py-10 text-center text-[#444] text-xs tracking-widest uppercase">Loading...</div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="border border-white/5 px-5 py-10 text-center text-[#444] text-xs tracking-widest uppercase">
            {searching ? "No matches" : "Empty — drop files here or create a folder"}
          </div>
        ) : (
          <div className="border border-white/[0.07]">
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => openFolder(f)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-white/[0.04] last:border-b-0 text-sm text-left hover:bg-white/[0.02] group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[#fbbf24] shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>
                  </span>
                  <span className="truncate">{f.name}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-[#555] text-xs hidden sm:inline">{f.created_by_name} · {fmtDate(f.created_at)}</span>
                  <span
                    onClick={e => deleteFolder(f, e)}
                    className="text-[#555] hover:text-[#f87171] transition-colors opacity-0 group-hover:opacity-100 text-xs px-1"
                  >
                    ✕
                  </span>
                </div>
              </button>
            ))}
            {files.map(f => (
              <div
                key={f.id}
                onClick={() => downloadFile(f)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-white/[0.04] last:border-b-0 text-sm cursor-pointer hover:bg-white/[0.02] group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[#888] shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  </span>
                  <span className="truncate">{f.name}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-[#555] text-xs hidden sm:inline">{f.uploaded_by_name} · {fmtDate(f.created_at)}</span>
                  <span className="text-[#666] text-xs tabular-nums w-16 text-right">{fmtSize(f.size_bytes)}</span>
                  <span
                    onClick={e => deleteFile(f, e)}
                    className="text-[#555] hover:text-[#f87171] transition-colors opacity-0 group-hover:opacity-100 text-xs px-1"
                  >
                    ✕
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
