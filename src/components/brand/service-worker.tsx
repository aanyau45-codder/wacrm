"use client";

import { useEffect } from "react";

// Registers public/sw.js, which shows public/offline.html (logo + "check
// your internet connection") instead of Chrome's "This site can't be
// reached" page when the app is opened without internet.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[sw] register failed:", err);
    });
  }, []);
  return null;
}
