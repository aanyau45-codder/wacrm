import { brandIconResponse } from "@/lib/brand-icon";

// App launcher icons for the web manifest and the Android app — the same
// Argon "Dusk Arch" mark as the favicon (src/app/icon.tsx), drawn at
// install sizes.
//
//   /icons/icon-192.png, /icons/icon-512.png  rounded square ("any")
//   /icons/maskable-512.png                   full-bleed square, arch kept
//                                             inside the 80% safe zone so
//                                             Android's circle/squircle
//                                             masks never clip it
const ICONS: Record<string, { size: number; maskable: boolean }> = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const icon = ICONS[name];
  if (!icon) return new Response("Not found", { status: 404 });

  return brandIconResponse(icon.size, {
    maskable: icon.maskable,
    // Short cache: the mark changed with the Argon rebrand, and a year-long
    // immutable cache would pin old launcher icons on installed devices.
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
