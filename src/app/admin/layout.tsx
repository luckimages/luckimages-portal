"use client";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.self !== window.top) {
      // In an iframe — intercept all link clicks and push to top frame
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
      <div className="w-full max-w-[1350px] min-h-screen">
        {children}
      </div>
    </div>
  );
}
