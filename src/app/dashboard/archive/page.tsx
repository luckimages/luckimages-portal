"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/constants";

type Folder = { id: string; name: string; parent_id: string | null; created_by_name: string; created_at: string };
type ArchiveFile = { id: string; name: string; folder_id: string | null; size_bytes: number; content_type: string | null; uploaded_by_name: string; created_at: string };
type Contact = { id: string; name: string; email: string | null };
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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [shareFile, setShareFile] = useState<ArchiveFile | null>(null);
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

  async function deleteFolder(folder: Folder, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${folder.name}" and everything inside it? This can't be undone.`)) return;
    await fetch(`/api/archive?type=folder&id=${folder.id}`, { method: "DELETE" });
    load(currentFolderId, sort);
  }
  async function deleteFile(file: ArchiveFile, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!confirm(`Delete "${file.name}"? This can't be undone.`)) return;
    await fetch(`/api/archive?type=file&id=${file.id}`, { method: "DELETE" });
    setViewerIndex(null);
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
            {files.map((f, i) => (
              <div
                key={f.id}
                onClick={() => setViewerIndex(i)}
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
                    onClick={e => { e.stopPropagation(); setShareFile(f); }}
                    className="text-[#555] hover:text-white transition-colors opacity-0 group-hover:opacity-100 px-1"
                    title="Share"
                  >
                    <ShareIcon />
                  </span>
                  <span
                    onClick={e => deleteFile(f, e)}
                    className="text-[#555] hover:text-[#f87171] transition-colors opacity-0 group-hover:opacity-100 text-xs px-1"
                    title="Delete"
                  >
                    ✕
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewerIndex !== null && files[viewerIndex] && (
        <FileViewerModal
          file={files[viewerIndex]}
          onClose={() => setViewerIndex(null)}
          onPrev={viewerIndex > 0 ? () => setViewerIndex(viewerIndex - 1) : null}
          onNext={viewerIndex < files.length - 1 ? () => setViewerIndex(viewerIndex + 1) : null}
          onDelete={() => deleteFile(files[viewerIndex])}
          onShare={() => setShareFile(files[viewerIndex])}
        />
      )}

      {shareFile && <ShareModal file={shareFile} onClose={() => setShareFile(null)} />}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>
    </svg>
  );
}

function isPreviewable(contentType: string | null): "image" | "pdf" | null {
  if (!contentType) return null;
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/pdf") return "pdf";
  return null;
}

function FileViewerModal({ file, onClose, onPrev, onNext, onDelete, onShare }: {
  file: ArchiveFile;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onDelete: () => void;
  onShare: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/archive/download?id=${file.id}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setUrl(d.url ?? null); });
    return () => { cancelled = true; };
  }, [file.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const preview = isPreviewable(file.content_type);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{file.name}</div>
          <div className="text-[10px] text-[#666] uppercase tracking-wider mt-0.5">{fmtSize(file.size_bytes)} · {fmtDate(file.created_at)}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton title="Share" onClick={onShare}><ShareIcon /></IconButton>
          <IconButton title="Download" onClick={() => url && window.open(url, "_blank")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
          </IconButton>
          <IconButton title="Delete" onClick={onDelete} danger>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </IconButton>
          <IconButton title="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </IconButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative flex items-center justify-center min-h-0 overflow-hidden">
        {onPrev && (
          <button onClick={onPrev} className="absolute left-2 sm:left-4 z-10 p-2 text-white/50 hover:text-white transition-colors" title="Previous">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        )}
        {onNext && (
          <button onClick={onNext} className="absolute right-2 sm:right-4 z-10 p-2 text-white/50 hover:text-white transition-colors" title="Next">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        )}

        {!url ? (
          <p className="text-xs tracking-widest uppercase text-[#555]">Loading...</p>
        ) : preview === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.name} className="max-w-full max-h-full object-contain px-12" />
        ) : preview === "pdf" ? (
          <iframe src={url} title={file.name} className="w-full h-full bg-white" />
        ) : (
          <div className="flex flex-col items-center gap-4 px-12 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[#555]"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            <p className="text-sm text-[#888]">No preview available for this file type</p>
            <button onClick={() => url && window.open(url, "_blank")} className="text-[10px] tracking-[1.5px] uppercase px-4 py-2 bg-white text-black font-bold">Download</button>
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2.5 transition-colors ${danger ? "text-[#555] hover:text-[#f87171]" : "text-[#888] hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function ShareModal({ file, onClose }: { file: ArchiveFile; onClose: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [err, setErr] = useState("");

  useEffect(() => {
    createClient().from("contacts").select("id, name, email").order("name").then(({ data }) => setContacts(data ?? []));
  }, []);

  const matches = contacts.filter(c => c.email && c.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  async function sendTo(contact: Contact) {
    if (!contact.email) return;
    setErr("");
    setSendingTo(contact.id);
    const res = await fetch("/api/archive/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: file.id, contact_id: contact.id }),
    });
    setSendingTo(null);
    if (res.ok) setSentTo(s => new Set(s).add(contact.id));
    else setErr((await res.json().catch(() => ({}))).error || "Couldn't send");
  }

  async function createAndSend() {
    const name = newName.trim();
    const email = newEmail.trim();
    if (!name || !email) return;
    setErr("");
    const { data, error } = await createClient().from("contacts").insert({ name, email, type: "lead", stage: "new" }).select().single();
    if (error || !data) { setErr("Couldn't create contact"); return; }
    setContacts(c => [data, ...c]);
    setCreatingNew(false);
    setNewName("");
    setNewEmail("");
    await sendTo(data);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75" />
      <div className="relative bg-[#141414] border border-white/10 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] tracking-[3px] uppercase text-[#666] mb-1">Share</p>
            <p className="text-lg font-bold truncate max-w-xs">{file.name}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="w-full bg-[#0c0c0c] border border-white/10 focus:border-white/30 text-sm text-white px-3 py-2 outline-none mb-3"
        />

        <div className="max-h-56 overflow-y-auto border border-white/10 divide-y divide-white/5 mb-3">
          {matches.length === 0 && <div className="px-3 py-4 text-xs text-[#555] text-center">No matching contacts with an email</div>}
          {matches.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm truncate">{c.name}</div>
                <div className="text-xs text-[#666] truncate">{c.email}</div>
              </div>
              {sentTo.has(c.id) ? (
                <span className="text-xs text-[#4ade80] shrink-0">Sent ✓</span>
              ) : (
                <button
                  onClick={() => sendTo(c)}
                  disabled={sendingTo === c.id}
                  className="text-[10px] tracking-[1.5px] uppercase px-3 py-1.5 border border-white/20 text-[#888] hover:text-white hover:border-white/40 transition-all disabled:opacity-40 shrink-0"
                >
                  {sendingTo === c.id ? "..." : "Send"}
                </button>
              )}
            </div>
          ))}
        </div>

        {!creatingNew ? (
          <button onClick={() => setCreatingNew(true)} className="text-xs text-[#666] hover:text-white transition-colors">
            + New contact
          </button>
        ) : (
          <div className="border border-white/10 p-3 flex flex-col gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Name"
              className="w-full bg-[#0c0c0c] border border-white/10 focus:border-white/30 text-sm text-white px-3 py-1.5 outline-none"
            />
            <input
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full bg-[#0c0c0c] border border-white/10 focus:border-white/30 text-sm text-white px-3 py-1.5 outline-none"
            />
            <div className="flex gap-2">
              <button onClick={createAndSend} className="flex-1 text-[10px] tracking-[1.5px] uppercase py-2 bg-white text-black font-bold">Create &amp; Send</button>
              <button onClick={() => setCreatingNew(false)} className="flex-1 text-[10px] tracking-[1.5px] uppercase py-2 text-[#555] hover:text-white border border-white/10">Cancel</button>
            </div>
          </div>
        )}

        {err && <p className="text-xs text-red-400 mt-3">{err}</p>}
      </div>
    </div>
  );
}
