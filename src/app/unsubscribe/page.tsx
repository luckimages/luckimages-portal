import type { Metadata } from "next";
import { Suspense } from "react";
import UnsubscribeForm from "./UnsubscribeForm";

export const metadata: Metadata = {
  title: "Unsubscribe — Luck Images",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col items-center justify-center px-6 py-16">
      <p className="text-xs tracking-[4px] uppercase text-[#555] mb-10">Luck Images</p>
      <Suspense>
        <UnsubscribeForm />
      </Suspense>
    </main>
  );
}
