"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Only track public marketing pages — not the portal, admin tools, or auth flows.
const EXCLUDED_PREFIXES = ["/dashboard", "/admin", "/client", "/photographer", "/login", "/register", "/choose-portal", "/api", "/auth"];

function isTrackable(pathname: string) {
  return !EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function getSessionId() {
  let id = sessionStorage.getItem("li_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("li_session_id", id);
  }
  return id;
}

export default function PageTracker() {
  const pathname = usePathname();
  const current = useRef<{ id: string; start: number } | null>(null);

  useEffect(() => {
    if (!pathname || !isTrackable(pathname)) return;

    function endCurrent() {
      if (!current.current) return;
      const duration = (Date.now() - current.current.start) / 1000;
      const payload = JSON.stringify({ id: current.current.id, duration });
      navigator.sendBeacon?.("/api/track-pageview/end", new Blob([payload], { type: "application/json" }));
      current.current = null;
    }

    fetch("/api/track-pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer,
        sessionId: getSessionId(),
        userAgent: navigator.userAgent,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.id) current.current = { id: d.id, start: Date.now() }; })
      .catch(() => {});

    function handleVisibility() {
      if (document.visibilityState === "hidden") endCurrent();
    }

    window.addEventListener("beforeunload", endCurrent);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      endCurrent();
      window.removeEventListener("beforeunload", endCurrent);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname]);

  return null;
}
