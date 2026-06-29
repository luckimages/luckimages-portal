"use client";

import { useState, useRef } from "react";

type Row = Record<string, string>;

const EXPECTED_COLUMNS = ["address", "date", "client_name", "services", "price", "status", "sqft", "notes"];

function parseCSV(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

export default function ImportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        setHeaders(Object.keys(parsed[0]));
        setRows(parsed);
        setStep("preview");
      }
    };
    reader.readAsText(file);
  }

  async function doImport() {
    setImporting(true);
    const res = await fetch("/api/admin/import-shoots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setResult(data);
    setImporting(false);
    setStep("done");
  }

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/10">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity">Luck Images</a>
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Dashboard</a>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 py-8 md:py-12 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-1">Data Import</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">Import Past Shoots</h1>
          <p className="text-sm text-[#555] mt-2">Upload a CSV with your shoot history. New contacts will be created automatically if not found.</p>
        </div>

        {/* Column guide */}
        <div className="bg-[#111] border border-white/10 p-5 mb-8">
          <p className="text-[10px] tracking-[2px] uppercase text-[#555] mb-3">Expected CSV Columns (all optional except address)</p>
          <div className="flex flex-wrap gap-2">
            {EXPECTED_COLUMNS.map(col => (
              <span key={col} className={`text-[10px] font-mono px-2 py-1 border ${col === "address" ? "border-white/30 text-white bg-white/5" : "border-white/10 text-[#555]"}`}>{col}</span>
            ))}
          </div>
          <p className="text-[10px] text-[#333] mt-3">address · date (any format) · client_name · services (comma-separated) · price ($200) · status (completed/scheduled/etc.) · sqft · notes</p>
        </div>

        {step === "upload" && (
          <div
            className="border-2 border-dashed border-white/10 p-16 text-center hover:border-white/20 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <p className="text-2xl mb-3">📁</p>
            <p className="text-sm font-semibold mb-1">Drop CSV here or click to browse</p>
            <p className="text-xs text-[#444]">Supports .csv files up to 5,000 rows</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {step === "preview" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold">{fileName}</p>
                <p className="text-xs text-[#555]">{rows.length} rows · {headers.length} columns</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setRows([]); setHeaders([]); setFileName(""); setStep("upload"); }} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-4 py-2">
                  Upload Different File
                </button>
                <button onClick={doImport} disabled={importing || rows.length === 0} className="text-xs tracking-[1px] uppercase font-semibold px-6 py-2 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40">
                  {importing ? `Importing ${rows.length} rows...` : `Import ${rows.length} Shoots`}
                </button>
              </div>
            </div>

            {/* Preview table */}
            <div className="border border-white/10 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left text-[10px] tracking-[1.5px] uppercase text-[#444] font-semibold">#</th>
                    {headers.map(h => (
                      <th key={h} className={`px-3 py-2 text-left text-[10px] tracking-[1.5px] uppercase font-semibold ${EXPECTED_COLUMNS.includes(h) ? "text-white" : "text-[#333]"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2 text-[#333]">{i + 1}</td>
                      {headers.map(h => (
                        <td key={h} className="px-3 py-2 text-[#888] max-w-[200px] truncate">{row[h] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <p className="text-center text-xs text-[#333] py-3 border-t border-white/5">Showing first 50 of {rows.length} rows — all {rows.length} will be imported</p>
              )}
            </div>
          </>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#111] border border-[#4ade80]/20 p-6">
                <p className="text-3xl font-black text-[#4ade80]">{result.imported}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1">Imported</p>
              </div>
              <div className="bg-[#111] border border-white/10 p-6">
                <p className="text-3xl font-black text-[#fbbf24]">{result.skipped}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1">Skipped</p>
              </div>
              <div className="bg-[#111] border border-white/10 p-6">
                <p className="text-3xl font-black text-red-400">{result.errors.length}</p>
                <p className="text-xs tracking-[2px] uppercase text-[#555] mt-1">Errors</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 p-4 space-y-1">
                <p className="text-[10px] tracking-[2px] uppercase text-red-400 mb-2">Errors</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-400/70">{e}</p>)}
              </div>
            )}
            <div className="flex items-center gap-4">
              <a href="/admin/shoots" className="text-xs tracking-[1px] uppercase font-semibold px-6 py-2.5 bg-white text-black hover:bg-white/90 transition-all">View All Shoots →</a>
              <button onClick={() => { setRows([]); setHeaders([]); setFileName(""); setResult(null); setStep("upload"); }} className="text-xs tracking-[1px] uppercase text-[#555] hover:text-white transition-colors border border-white/10 px-4 py-2.5">
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
