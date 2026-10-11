import { ImageResponse } from "next/og";
import { ARCH_PATH, BRAND_INK, BRAND_LILAC, BRAND_PEACH } from "@/components/brand/argon-logo";

// Renders the Argon "Dusk Arch" mark as a PNG for the favicon, Apple
// touch icon and the manifest / Android launcher icons. Same art as
// <ArgonMark>, drawn hook-free so it can run inside ImageResponse.
//
//   rounded  — 24% corner radius (favicon, "any" launcher icons)
//   maskable — full-bleed ink square with the arch shrunk into the 80%
//              safe zone, so Android's circle/squircle masks never clip it
export function brandIconResponse(
  size: number,
  { maskable = false, headers }: { maskable?: boolean; headers?: Record<string, string> } = {},
) {
  const small = size <= 32;
  const art = maskable ? Math.round(size * 0.72) : size;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_INK,
          borderRadius: maskable ? 0 : Math.round(size * 0.24),
        }}
      >
        <svg width={art} height={art} viewBox="0 0 100 100">
          <defs>
            <linearGradient id="arch" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={BRAND_PEACH} />
              <stop offset="1" stopColor={BRAND_LILAC} />
            </linearGradient>
          </defs>
          <path
            d={ARCH_PATH}
            fill="none"
            stroke="url(#arch)"
            strokeWidth={small ? 11 : 9}
            strokeLinecap="round"
          />
          <circle cx="50" cy="61" r={small ? 6 : 5} fill={BRAND_PEACH} />
        </svg>
      </div>
    ),
    { width: size, height: size, headers },
  );
}
