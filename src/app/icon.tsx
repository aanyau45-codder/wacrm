import { brandIconResponse } from "@/lib/brand-icon";

// Favicon: the Argon "Dusk Arch" mark (see src/components/brand/argon-logo.tsx).
// Next.js auto-injects <link rel="icon"> for this route, and it takes
// precedence over the default src/app/favicon.ico.

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return brandIconResponse(32);
}
