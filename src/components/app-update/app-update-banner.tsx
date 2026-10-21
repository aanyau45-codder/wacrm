"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { ANDROID_PACKAGE, APK_VERSION_KEY, LATEST_APK } from "@/lib/android-app";

const VERSION_KEY = APK_VERSION_KEY;
const DISMISS_KEY = "argon.apkUpdateDismissed";

// Builds before the ?apk= start URL (1.0.0 / 1.0.1) can only be spotted
// by the android-app:// referrer Chrome sets on a TWA launch.
const LEGACY_VERSION = 2;

/** Which APK build is running this page, or null when not in the app. */
function detectApkVersion(): number | null {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get("apk");
    if (param && /^\d+$/.test(param)) {
      sessionStorage.setItem(VERSION_KEY, param);
      url.searchParams.delete("apk");
      window.history.replaceState(window.history.state, "", url.toString());
    } else if (
      !sessionStorage.getItem(VERSION_KEY) &&
      document.referrer.startsWith(`android-app://${ANDROID_PACKAGE}`)
    ) {
      sessionStorage.setItem(VERSION_KEY, String(LEGACY_VERSION));
    }
    const stored = sessionStorage.getItem(VERSION_KEY);
    return stored ? Number(stored) : null;
  } catch {
    return null;
  }
}

/**
 * "New app version" card shown inside the Android app when a newer APK
 * is published. Tapping Update downloads it; Android then asks once to
 * install, and the update keeps the user's data (same signing key).
 */
export function AppUpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const version = detectApkVersion();
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (version !== null && version < LATEST_APK.versionCode && !dismissed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-[84px] z-[60] lg:bottom-3 mx-auto flex max-w-md items-center gap-3 rounded-3xl bg-pastel-lilac p-3 pl-4 shadow-[0_12px_40px_-12px_rgba(30,28,70,0.35)]">
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold text-foreground">
          New app version
        </p>
        <p className="text-xs text-foreground/70">
          Tap Update, then Install when Android asks.
        </p>
      </div>
      <a
        href={LATEST_APK.url}
        download
        onClick={dismiss}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        <Download className="h-4 w-4" />
        Update
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground/60 hover:bg-card/60"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
