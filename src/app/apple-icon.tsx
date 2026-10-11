import { brandIconResponse } from "@/lib/brand-icon";

// iOS home-screen icon. iOS applies its own corner mask, so draw it
// full-bleed (maskable) rather than pre-rounded.

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandIconResponse(180, { maskable: true });
}
