"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type MediaItem = {
  id: string;
  file_name: string;
  file_type: string;
  preview_url: string | null;
  download_url: string | null;
  service_type: string;
};

type Shoot = {
  id: string;
  address: string;
  square_footage: number | null;
  contact_id: string | null;
};

type Contact = {
  name: string;
  phone: string | null;
  email: string | null;
  brokerage: string | null;
};

type InfoFields = {
  address: string;
  price: string;
  details: string;
  description: string;
  features: string[];
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  brokerage: string;
  mlsNumber: string;
  agentHeadshotB64: string;
  brokerageLogoB64: string;
};

type EnabledSections = Record<keyof InfoFields, boolean>;

const SECTION_META: { key: keyof InfoFields; label: string; type: "text" | "textarea" | "bullets" | "upload" }[] = [
  { key: "address",          label: "Property Address",      type: "text" },
  { key: "price",            label: "Listing Price",          type: "text" },
  { key: "details",          label: "Beds / Baths / Sqft",   type: "text" },
  { key: "description",      label: "Property Description",  type: "textarea" },
  { key: "features",         label: "Key Features",           type: "bullets" },
  { key: "agentName",        label: "Agent Name",             type: "text" },
  { key: "agentPhone",       label: "Agent Phone",            type: "text" },
  { key: "agentEmail",       label: "Agent Email",            type: "text" },
  { key: "brokerage",        label: "Brokerage",              type: "text" },
  { key: "agentHeadshotB64", label: "Agent Headshot",         type: "upload" as const },
  { key: "brokerageLogoB64", label: "Brokerage Logo",         type: "upload" as const },
  { key: "mlsNumber",        label: "MLS #",                  type: "text" },
];

const inputCls = "w-full bg-[#181818] border border-white/10 text-white text-sm px-3 py-2 outline-none focus:border-white/40 transition-colors placeholder:text-[#444]";
const labelCls = "text-xs tracking-[2px] uppercase text-[#555] block mb-1";

function fileToB64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BrochureBuilderPage() {
  const { id: shootId } = useParams<{ id: string }>();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [shoot, setShoot] = useState<Shoot | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<EnabledSections>({
    address: true, price: true, details: true, description: false,
    features: false, agentName: true, agentPhone: true, agentEmail: true,
    brokerage: true, mlsNumber: false, agentHeadshotB64: false, brokerageLogoB64: false,
  });
  const [fields, setFields] = useState<InfoFields>({
    address: "", price: "", details: "", description: "", features: [""],
    agentName: "", agentPhone: "", agentEmail: "", brokerage: "",
    mlsNumber: "", agentHeadshotB64: "", brokerageLogoB64: "",
  });
  const [newFeature, setNewFeature] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
    });
    supabase.from("shoots").select("id,address,square_footage,contact_id").eq("id", shootId).single()
      .then(({ data: s }) => {
        if (!s) return;
        setShoot(s);
        setFields(f => ({
          ...f,
          address: s.address || "",
          details: s.square_footage ? `· ${s.square_footage.toLocaleString()} sqft` : "",
        }));
        if (s.contact_id) {
          supabase.from("contacts").select("name,phone,email,brokerage").eq("id", s.contact_id).single()
            .then(({ data: c }) => {
              if (!c) return;
              setContact(c);
              setFields(f => ({
                ...f,
                agentName: c.name || "",
                agentPhone: c.phone || "",
                agentEmail: c.email || "",
                brokerage: c.brokerage || "",
              }));
            });
        }
      });
    fetch(`/api/media?shoot_id=${shootId}`)
      .then(r => r.json())
      .then(d => setMedia((d.media || []).filter((m: MediaItem) => m.file_type?.startsWith("image/"))));
  }, [shootId, router]);

  function togglePhoto(url: string) {
    setSelectedPhotos(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      if (prev.length >= 4) return prev;
      return [...prev, url];
    });
  }

  function toggleSection(key: keyof InfoFields) {
    setEnabled(e => ({ ...e, [key]: !e[key] }));
  }

  function setField(key: keyof InfoFields, value: string) {
    setFields(f => ({ ...f, [key]: value }));
  }

  function addFeature() {
    const v = newFeature.trim();
    if (!v) return;
    setFields(f => ({ ...f, features: [...(f.features.filter(Boolean)), v] }));
    setNewFeature("");
  }

  function removeFeature(i: number) {
    setFields(f => ({ ...f, features: f.features.filter((_, idx) => idx !== i) }));
  }

  async function handleUpload(key: "agentHeadshotB64" | "brokerageLogoB64", file: File) {
    const b64 = await fileToB64(file);
    setField(key, b64);
  }

  async function generate() {
    if (selectedPhotos.length === 0) { setError("Select at least one photo."); return; }
    setError("");
    setGenerating(true);
    try {
      const body = {
        photos: selectedPhotos,
        ...(enabled.address && { address: fields.address }),
        ...(enabled.price && { price: fields.price }),
        ...(enabled.details && { details: fields.details }),
        ...(enabled.description && { description: fields.description }),
        ...(enabled.features && fields.features.filter(Boolean).length > 0 && { features: fields.features.filter(Boolean) }),
        ...(enabled.agentName && { agentName: fields.agentName }),
        ...(enabled.agentPhone && { agentPhone: fields.agentPhone }),
        ...(enabled.agentEmail && { agentEmail: fields.agentEmail }),
        ...(enabled.brokerage && { brokerage: fields.brokerage }),
        ...(enabled.mlsNumber && { mlsNumber: fields.mlsNumber }),
        ...(enabled.agentHeadshotB64 && fields.agentHeadshotB64 && { agentHeadshotB64: fields.agentHeadshotB64 }),
        ...(enabled.brokerageLogoB64 && fields.brokerageLogoB64 && { brokerageLogoB64: fields.brokerageLogoB64 }),
      };
      const res = await fetch("/api/admin/brochure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError("PDF generation failed. Try again."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const addrSlug = shoot?.address?.split(",")[0]?.replace(/\s+/g, "-").toLowerCase() || "brochure";
      a.download = `${addrSlug}-brochure.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  const inputRow = (key: keyof InfoFields, placeholder: string, type: "text" | "textarea" = "text") => {
    if (!enabled[key]) return null;
    if (type === "textarea") {
      return (
        <textarea
          value={fields[key] as string}
          onChange={e => setField(key, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={inputCls + " resize-none mt-1"}
        />
      );
    }
    return (
      <input
        type="text"
        value={fields[key] as string}
        onChange={e => setField(key, e.target.value)}
        placeholder={placeholder}
        className={inputCls + " mt-1"}
      />
    );
  };

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Link href="/admin/shoots" className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">← Shoots</Link>
          <span className="text-white/20">·</span>
          <span className="text-xs tracking-[2px] uppercase text-white">Brochure Builder</span>
        </div>
        <span className="text-xs text-[#444] tracking-[1px] uppercase">{shoot?.address}</span>
      </header>

      {/* Step indicator */}
      <div className="flex border-b border-white/10">
        {[["1", "Select Photos"], ["2", "Brochure Info"], ["3", "Generate"]].map(([n, label], i) => {
          const s = (i + 1) as 1 | 2 | 3;
          const active = step === s;
          const done = step > s;
          return (
            <button
              key={n}
              onClick={() => done || active ? setStep(s) : undefined}
              className={`flex items-center gap-2 px-6 py-4 text-xs tracking-[2px] uppercase transition-colors border-b-2 ${active ? "border-white text-white" : done ? "border-white/20 text-[#666] hover:text-white cursor-pointer" : "border-transparent text-[#444] cursor-default"}`}
            >
              <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold border ${active ? "border-white text-white" : done ? "border-white/30 text-[#666]" : "border-white/15 text-[#444]"}`}>{n}</span>
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-8 py-10">

        {/* Step 1: Select photos */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-2">Step 1</p>
              <h1 className="text-2xl font-black tracking-tight uppercase">Select Hero Photos</h1>
              <p className="text-sm text-[#555] mt-2">Pick up to 4 photos from the delivered gallery. They'll appear at the top of the brochure.</p>
            </div>

            {media.length === 0 ? (
              <p className="text-sm text-[#555]">No photos found in this shoot's gallery.</p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {media.filter(m => m.preview_url).map(m => {
                  const url = m.download_url || m.preview_url!;
                  const selected = selectedPhotos.includes(url);
                  const position = selectedPhotos.indexOf(url);
                  const maxed = selectedPhotos.length >= 4 && !selected;
                  return (
                    <button
                      key={m.id}
                      onClick={() => !maxed && togglePhoto(url)}
                      className={`relative aspect-square overflow-hidden border-2 transition-all ${selected ? "border-white" : maxed ? "border-transparent opacity-40 cursor-not-allowed" : "border-transparent hover:border-white/40"}`}
                    >
                      <img src={m.preview_url!} alt={m.file_name} className="w-full h-full object-cover" />
                      {selected && (
                        <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-white text-black text-[10px] font-black flex items-center justify-center">
                          {position + 1}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-4 pt-2">
              <span className="text-xs text-[#555]">{selectedPhotos.length}/4 selected</span>
              <button
                onClick={() => { if (selectedPhotos.length > 0) setStep(2); }}
                disabled={selectedPhotos.length === 0}
                className="ml-auto text-xs tracking-[3px] uppercase bg-white text-black font-semibold px-8 py-3 hover:bg-white/90 transition-colors disabled:opacity-30"
              >
                Next: Brochure Info →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Info builder */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-2">Step 2</p>
              <h1 className="text-2xl font-black tracking-tight uppercase">Brochure Info</h1>
              <p className="text-sm text-[#555] mt-2">Check each section you want on the brochure. Pre-filled fields are pulled from the shoot record — edit as needed.</p>
            </div>

            <div className="flex flex-col gap-1">
              {SECTION_META.map(({ key, label, type }) => {
                const isEnabled = enabled[key];
                return (
                  <div key={key} className={`border transition-colors ${isEnabled ? "border-white/20 bg-white/[0.02]" : "border-white/5 bg-transparent"}`}>
                    <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleSection(key)}
                        className="accent-white w-4 h-4 shrink-0"
                      />
                      <span className={`text-sm font-medium transition-colors ${isEnabled ? "text-white" : "text-[#555]"}`}>{label}</span>
                      {(key === "address" || key === "agentName" || key === "agentPhone" || key === "agentEmail" || key === "brokerage") && fields[key] && (
                        <span className="text-[10px] text-[#4ade80] ml-auto tracking-[1px] uppercase">Auto-filled</span>
                      )}
                    </label>

                    {isEnabled && (
                      <div className="px-4 pb-4">
                        {type === "text" && inputRow(key, key === "price" ? "$750,000" : key === "details" ? "4 bed · 3 bath · 2,400 sqft" : key === "mlsNumber" ? "1234567" : "")}
                        {type === "textarea" && inputRow(key, "Write a short paragraph about the property...", "textarea")}
                        {type === "bullets" && (
                          <div className="flex flex-col gap-2 mt-1">
                            {fields.features.filter(Boolean).map((f, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[#555] text-xs">·</span>
                                <span className="text-sm text-white flex-1">{f}</span>
                                <button onClick={() => removeFeature(i)} className="text-[#555] hover:text-red-400 text-xs transition-colors">Remove</button>
                              </div>
                            ))}
                            <div className="flex gap-2 mt-1">
                              <input
                                type="text"
                                value={newFeature}
                                onChange={e => setNewFeature(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addFeature())}
                                placeholder="Add a feature and press Enter..."
                                className={inputCls + " flex-1"}
                              />
                              <button onClick={addFeature} className="text-xs tracking-[2px] uppercase border border-white/20 px-4 py-2 hover:bg-white/5 transition-colors">Add</button>
                            </div>
                          </div>
                        )}
                        {type === "upload" && (
                          <div className="mt-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(key as "agentHeadshotB64" | "brokerageLogoB64", file);
                              }}
                              className="text-xs text-[#888] file:mr-3 file:text-xs file:bg-white/10 file:border-0 file:text-white file:px-3 file:py-1.5 file:cursor-pointer"
                            />
                            {fields[key] && (
                              <img src={fields[key] as string} className="mt-2 h-16 object-contain opacity-80" alt="preview" />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button onClick={() => setStep(1)} className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">← Back</button>
              <button
                onClick={() => setStep(3)}
                className="ml-auto text-xs tracking-[3px] uppercase bg-white text-black font-semibold px-8 py-3 hover:bg-white/90 transition-colors"
              >
                Next: Generate →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Generate */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs tracking-[4px] uppercase text-[#555] mb-2">Step 3</p>
              <h1 className="text-2xl font-black tracking-tight uppercase">Generate PDF</h1>
              <p className="text-sm text-[#555] mt-2">Review your selections and download the brochure.</p>
            </div>

            {/* Summary */}
            <div className="flex flex-col gap-4 border border-white/10 p-6">
              <div>
                <p className={labelCls}>Photos Selected</p>
                <div className="flex gap-2 flex-wrap mt-2">
                  {selectedPhotos.map((url, i) => (
                    <img key={i} src={url} className="w-20 h-14 object-cover" alt={`photo ${i+1}`} />
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className={labelCls}>Info Sections</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {SECTION_META.filter(s => enabled[s.key]).map(s => (
                    <span key={s.key} className="text-[10px] tracking-[1px] uppercase text-white/60 border border-white/15 px-2 py-1">{s.label}</span>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 border border-red-400/20 bg-red-400/5 px-4 py-3">{error}</p>}

            <div className="flex items-center gap-4">
              <button onClick={() => setStep(2)} className="text-xs tracking-[2px] uppercase text-[#555] hover:text-white transition-colors">← Back</button>
              <button
                onClick={generate}
                disabled={generating}
                className="ml-auto text-xs tracking-[3px] uppercase bg-white text-black font-semibold px-10 py-4 hover:bg-white/90 transition-colors disabled:opacity-50"
              >
                {generating ? "Generating PDF..." : "Download Brochure PDF →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
