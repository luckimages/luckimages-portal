"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PreviewBanner({ role }: { role: "realtor" | "photographer" }) {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(sessionStorage.getItem("previewRole") === role);
  }, [role]);

  if (!show) return null;

  function exit() {
    sessionStorage.removeItem("previewRole");
    router.push("/choose-portal");
  }

  return (
    <div className="bg-[#a78bfa]/10 border-b border-[#a78bfa]/30 px-8 py-2 flex items-center justify-between">
      <p className="text-xs tracking-[2px] uppercase text-[#a78bfa]">
        Previewing as {role} — changes here are real
      </p>
      <button onClick={exit} className="text-xs tracking-[2px] uppercase text-[#a78bfa] hover:text-white transition-colors">
        ← Exit Preview
      </button>
    </div>
  );
}
