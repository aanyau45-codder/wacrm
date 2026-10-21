"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BrandSplash } from "@/components/brand/brand-splash";

// Covers the app while the phone has no internet, instead of half-loaded
// pages and failed requests. Pages that can't load at all are caught by
// the service worker (public/sw.js → public/offline.html).

export function OfflineScreen() {
  const t = useTranslations("Offline");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <BrandSplash>
      <p className="text-lg font-bold">{t("title")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("body")}</p>
      <button
        type="button"
        onClick={() => setOffline(!navigator.onLine)}
        className="mt-6 h-11 rounded-full bg-foreground px-6 text-sm font-semibold text-background"
      >
        {t("retry")}
      </button>
    </BrandSplash>
  );
}
