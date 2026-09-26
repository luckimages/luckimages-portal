"use client";
import { useEffect } from "react";
import { backToShell } from "@/lib/backToShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.self !== window.top) {
      function onClickLink(e: MouseEvent) {
        const a = (e.target as HTMLElement).closest("a");
        if (a && a.href && !a.target) {
          e.preventDefault();
          window.top!.location.href = a.href;
        }
      }
      document.addEventListener("click", onClickLink);
      return () => document.removeEventListener("click", onClickLink);
    }
  }, []);

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[1900px] min-h-screen">
        <div className="md:hidden flex items-center px-4 py-3 border-b border-white/10">
          <button onClick={() => backToShell()} className="text-sm text-white/40 hover:text-white transition-colors">← Dashboard</button>
        </div>
        {children}
      </div>
    </div>
  );
}
