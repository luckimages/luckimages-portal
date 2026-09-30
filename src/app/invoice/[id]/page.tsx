"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { truncateAddressToStreet } from "@/lib/address";

type InvoiceData = {
  id: string;
  amount_cents: number;
  paid: boolean;
  paid_at: string | null;
  due_date: string | null;
  line_items: { label: string; amount_cents: number }[] | null;
  description: string | null;
  shoot: {
    address: string;
    scheduled_at: string | null;
    services: string[] | null;
    square_footage: number | null;
    delivered_at: string | null;
  } | null;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    " · " + new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const rowLabelCls = "text-[10px] tracking-[2px] uppercase text-[#666]";

export default function PublicInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      setJustPaid(true);
      window.history.replaceState({}, "", `/invoice/${id}`);
    }
  }, [id]);

  useEffect(() => {
    fetch(`/api/public/invoice/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setInvoice)
      .catch(() => setNotFound(true));
  }, [id]);

  async function payInvoice() {
    setPaying(true); setPayError("");
    try {
      const res = await fetch("/api/public/pay-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) { setPayError(data.error || "Could not start payment"); setPaying(false); return; }
      window.location.href = data.url;
    } catch {
      setPayError("Could not start payment"); setPaying(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center px-4">
        <p className="text-sm text-[#666]">This invoice link isn&apos;t valid or has expired.</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center">
        <p className="text-xs text-[#555] tracking-[3px] uppercase">Loading...</p>
      </div>
    );
  }

  const shoot = invoice.shoot;
  const lineItems = invoice.line_items || [];
  const paid = invoice.paid || justPaid;

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex flex-col items-center px-4 py-12">
      <img src="/logo.png" width={40} height={40} alt="Luck Images" className="mb-3" />
      <p className="text-[10px] tracking-[4px] uppercase text-[#555] mb-10">Luck Images</p>

      <div className="w-full max-w-md">
        {justPaid && (
          <div className="bg-[#4ade8018] border border-[#4ade80]/20 p-4 mb-4 text-center">
            <p className="text-[#4ade80] text-sm">Payment received — thank you!</p>
          </div>
        )}

        <div className="bg-[#111] border border-white/10 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className={rowLabelCls}>Amount</p>
              <p className="text-3xl font-bold mt-1">${(invoice.amount_cents / 100).toLocaleString()}</p>
            </div>
            <span className={`text-xs tracking-[1px] uppercase px-2 py-1 h-fit ${paid ? "bg-[#4ade8018] text-[#4ade80]" : "bg-[#fbbf2418] text-[#fbbf24]"}`}>
              {paid ? "Paid" : "Unpaid"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <p className={rowLabelCls}>Property</p>
              <p className="text-sm text-white mt-1">{shoot ? truncateAddressToStreet(shoot.address) : (invoice.description || "—")}</p>
            </div>
            <div>
              <p className={rowLabelCls}>Square Footage</p>
              <p className="text-sm text-white mt-1">{shoot?.square_footage ? `${shoot.square_footage.toLocaleString()} sf` : "—"}</p>
            </div>
            <div>
              <p className={rowLabelCls}>Shoot Date &amp; Time</p>
              <p className="text-sm text-white mt-1">{shoot ? formatDateTime(shoot.scheduled_at) : "—"}</p>
            </div>
            <div>
              <p className={rowLabelCls}>Media Delivered</p>
              <p className="text-sm text-white mt-1">
                {shoot?.delivered_at
                  ? new Date(shoot.delivered_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "Not yet delivered"}
              </p>
            </div>
          </div>

          {(shoot?.services?.length ?? 0) > 0 && (
            <div className="mb-5">
              <p className={rowLabelCls}>Services Provided</p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {(shoot?.services || []).map(s => (
                  <span key={s} className="text-[10px] tracking-[1px] uppercase px-2 py-0.5 bg-white/5 border border-white/10 text-[#888]">{s}</span>
                ))}
              </div>
            </div>
          )}

          {lineItems.length > 0 && (
            <div className="mb-5">
              <p className={rowLabelCls}>Price Breakdown</p>
              <div className="mt-1.5 flex flex-col gap-1">
                {lineItems.map((li, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-[#ccc]">{li.label}</span>
                    <span className="text-white tabular-nums">${(li.amount_cents / 100).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-semibold pt-1.5 mt-1 border-t border-white/10">
                  <span className="text-white">Total</span>
                  <span className="text-white tabular-nums">${(invoice.amount_cents / 100).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="mb-5">
            <p className={rowLabelCls}>Invoice Status</p>
            {paid ? (
              <p className="text-sm text-[#4ade80] mt-1">
                Invoice paid{invoice.paid_at ? ` on ${new Date(invoice.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
              </p>
            ) : (
              <p className="text-sm text-[#fbbf24] mt-1">
                Unpaid{invoice.due_date ? ` · due ${new Date(invoice.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
              </p>
            )}
          </div>

          {payError && <p className="text-xs text-red-400 border border-red-400/20 bg-red-400/5 px-3 py-2 mb-4">{payError}</p>}

          {!paid && (
            <button
              onClick={payInvoice}
              disabled={paying}
              className="w-full text-xs tracking-[3px] uppercase bg-white text-black font-semibold py-4 hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {paying ? "Loading…" : "Pay Now →"}
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-[#444] mt-6">
          Questions about this invoice? Email <a href="mailto:ryan@luckimages.com" className="text-[#666] hover:text-white transition-colors">ryan@luckimages.com</a>
        </p>
      </div>
    </div>
  );
}
