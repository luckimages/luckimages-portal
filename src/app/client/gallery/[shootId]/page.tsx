"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useParams } from "next/navigation";

type MediaFile = { id: string; file_name: string; file_path: string; file_type: string; created_at: string };
type Shoot = { address: string; scheduled_at: string; services: string[] };

export default function GalleryPage() {
  const { shootId } = useParams<{ shootId: string }>();
  const [shoot, setShoot] = useState<Shoot | null>(null);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("shoots").select("address,scheduled_at,services").eq("id", shootId).single(),
      supabase.from("media").select("*").eq("shoot_id", shootId).order("created_at"),
    ]).then(async ([{ data: shootData }, { data: mediaData }]) => {
      setShoot(shootData);
      if (!mediaData?.length) return;
      setMedia(mediaData);
      const signedUrls: Record<string, string> = {};
      await Promise.all(mediaData.map(async (m) => {
        const { data } = await supabase.storage.from("shoot-media").createSignedUrl(m.file_path, 3600);
        if (data?.signedUrl) signedUrls[m.id] = data.signedUrl;
      }));
      setUrls(signedUrls);
    });
  }, [shootId]);

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <span className="text-xl font-black tracking-tight uppercase">Luck Images</span>
        <Link href="/client" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">← Back</Link>
      </header>

      <div className="flex-1 px-8 py-10 max-w-6xl mx-auto w-full">
        {shoot && (
          <div className="mb-8">
            <p className="text-xs tracking-[4px] uppercase text-[#666] mb-2">{new Date(shoot.scheduled_at).toLocaleDateString()} · {shoot.services?.join(", ")}</p>
            <h1 className="text-2xl font-black tracking-tight uppercase">{shoot.address}</h1>
          </div>
        )}

        {media.length === 0 ? (
          <div className="bg-[#111] border border-white/10 p-12 text-center">
            <p className="text-[#555]">Photos haven't been uploaded yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {media.map(m => (
              <a key={m.id} href={urls[m.id] || "#"} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-[#111] border border-white/10 overflow-hidden hover:border-white/30 transition-colors">
                {urls[m.id] && m.file_type?.startsWith("image/") ? (
                  <img src={urls[m.id]} alt={m.file_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-xs text-[#555] tracking-wide uppercase">{m.file_name}</p>
                  </div>
                )}
              </a>
            ))}
          </div>
        )}

        {media.length > 0 && (
          <div className="mt-6 flex justify-end">
            <p className="text-xs text-[#444] tracking-[1px]">{media.length} file{media.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
    </main>
  );
}
