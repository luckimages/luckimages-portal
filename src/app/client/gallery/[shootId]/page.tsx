"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import ShootGallery from "@/components/ShootGallery";

type Shoot = { address: string; scheduled_at: string; services: string[] };
type Invoice = { id: string; paid: boolean; amount_cents: number };

export default function GalleryPage() {
  const { shootId } = useParams<{ shootId: string }>();
  const router = useRouter();
  const [shoot, setShoot] = useState<Shoot | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceChecked, setInvoiceChecked] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
    });
    supabase.from("shoots").select("address,scheduled_at,services").eq("id", shootId).single()
      .then(({ data }) => setShoot(data));
    supabase.from("invoices").select("id,paid,amount_cents").eq("shoot_id", shootId).maybeSingle()
      .then(({ data }) => { setInvoice(data); setInvoiceChecked(true); });
  }, [shootId, router]);

  async function payInvoice() {
    if (!invoice) return;
    setPaying(true); setPayError("");
    try {
      const res = await fetch("/api/portal/pay-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) { setPayError(data.error || "Could not start payment"); setPaying(false); return; }
      window.location.href = data.url;
    } catch {
      setPayError("Could not start payment"); setPaying(false);
    }
  }

  const canDownload = !invoiceChecked || !invoice || invoice.paid;

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

        {/* Payment gate banner */}
        {invoiceChecked && invoice && !invoice.paid && (
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#fbbf24]/5 border border-[#fbbf24]/30 px-6 py-5">
            <div>
              <p className="text-sm font-semibold text-[#fbbf24]">Payment required to download</p>
              <p className="text-xs text-[#888] mt-1">
                Pay the ${(invoice.amount_cents / 100).toLocaleString()} invoice to unlock full-resolution downloads and remove the watermark.
              </p>
              {payError && <p className="text-xs text-red-400 mt-2">{payError}</p>}
            </div>
            <button
              onClick={payInvoice}
              disabled={paying}
              className="shrink-0 text-xs tracking-[3px] uppercase font-semibold bg-[#fbbf24] text-black px-6 py-3 hover:bg-[#fbbf24]/90 transition-colors disabled:opacity-50"
            >
              {paying ? "Loading…" : `Pay $${(invoice.amount_cents / 100).toLocaleString()} →`}
            </button>
          </div>
        )}

        <ShootGallery shootId={shootId} services={shoot?.services || []} canDownload={canDownload} />
      </div>
    </main>
  );
}
