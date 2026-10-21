// The Android app (argon-crm-android, a Trusted Web Activity) is
// side-loaded from an APK rather than the Play Store, so it has no store
// to update it. Instead the web app tells it when a newer APK exists:
// each APK build opens /dashboard?apk=<versionCode>, and when that's
// lower than LATEST_APK the in-app banner offers the download.
//
// Shipping a new APK: bump appVersionCode in twa-manifest.json, set its
// startUrl to "/dashboard?apk=<new code>", build, copy the APK to
// public/downloads/, then update LATEST_APK in the same commit.
export const ANDROID_PACKAGE = "com.argonbuilds.crm";

export const LATEST_APK = {
  versionCode: 5,
  versionName: "1.0.4",
  url: "/downloads/argon-crm-1.0.4.apk",
} as const;

// sessionStorage key holding the running APK's versionCode (set by the
// update banner from ?apk=).
export const APK_VERSION_KEY = "argon.apkVersion";

// First APK with notifications switched on (task reminders). Older
// builds must update before reminders can work.
export const NOTIFICATIONS_MIN_APK = 5;
