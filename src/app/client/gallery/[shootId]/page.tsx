"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useParams } from "next/navigation";
import ShootGallery from "@/components/ShootGallery";

type Shoot = { address: string; scheduled_at: string; services: string[] };

export default function GalleryPage() {
  const { shootId } = useParams<{ shootId: string }>();
  const [shoot, setShoot] = useState<Shoot | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("shoots").select("address,scheduled_at,services").eq("id", shootId).single()
      .then(({ data }) => setShoot(data));
  }, [shootId]);

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <span className="text-xl font-black tracking-tight uppercase">Luck Images</span>
        <Link href="/client" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">← Back</Link>
      </header>

      <div className="flex-1 px-4 md:px-8 py-10 max-w-6xl mx-auto w-full">
        {shoot && (
          <div className="mb-8">
            <p className="text-xs tracking-[4px] uppercase text-[#666] mb-2">
              {new Date(shoot.scheduled_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {shoot.services?.join(", ")}
            </p>
            <h1 className="text-2xl font-black tracking-tight uppercase">{shoot.address}</h1>
          </div>
        )}
        <ShootGallery shootId={shootId} />
      </div>
    </main>
  );
}
