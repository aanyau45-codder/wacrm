import type { MetadataRoute } from "next";

// Web app manifest. Lets phones "Install app" from the browser, and is
// what the Android wrapper (a Trusted Web Activity) reads its name, colours
// and launcher icons from — the Android project lives outside this repo,
// in ../argon-crm-android. The icons are drawn by
// src/app/icons/[name]/route.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Argon CRM",
    short_name: "Argon CRM",
    description: "WhatsApp CRM — inbox, contacts, pipelines and AI replies.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
