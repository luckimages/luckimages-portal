"use client";

import { useEffect, useRef } from "react";

// Runs `fn` on an interval, but ONLY while the browser tab is visible. When the
// tab is hidden (background tab, minimized, screen locked) the interval stops
// entirely; when it becomes visible again `fn` fires once immediately and the
// interval resumes. `fn` also fires once as soon as polling becomes enabled
// (mount, or switching to the view that needs it). Keeps a dashboard left open
// overnight from hammering the API while still showing fresh data on sight.
//
// Pass `enabled: false` to suspend polling (e.g. when the board isn't the
// active view).
export function useVisiblePolling(fn: () => void, intervalMs: number, enabled: boolean = true) {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (timer == null) timer = setInterval(() => fnRef.current(), intervalMs); };
    const stop = () => { if (timer != null) { clearInterval(timer); timer = null; } };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fnRef.current();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") { fnRef.current(); start(); }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
