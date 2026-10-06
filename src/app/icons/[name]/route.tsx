import { ImageResponse } from "next/og";

// App launcher icons for the web manifest and the Android app — the same
// brand mark as src/app/icon.tsx (violet rounded square + white chat
// glyph), drawn at install sizes.
//
//   /icons/icon-192.png, /icons/icon-512.png  rounded square ("any")
//   /icons/maskable-512.png                   full-bleed square, glyph kept
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

  const { size, maskable } = icon;
  const glyph = Math.round(size * (maskable ? 0.42 : 0.6));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7c3aed",
          borderRadius: maskable ? 0 : Math.round(size * 0.2),
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    },
  );
}
