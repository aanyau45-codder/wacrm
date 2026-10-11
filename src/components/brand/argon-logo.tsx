import { useId } from "react";
import { cn } from "@/lib/utils";

// Argon CRM brand mark ("Dusk Arch"): the A drawn as an open archway in a
// peach-to-lilac gradient on ink, its crossbar a single dot. The favicon
// and launcher icons (src/app/icon.tsx, src/app/icons/[name]/route.tsx)
// draw the same paths — keep them in sync.

export const ARCH_PATH = "M31 77V50a19 19 0 0 1 38 0v27";
export const BRAND_INK = "#15141c";
export const BRAND_PEACH = "#fde3cf";
export const BRAND_LILAC = "#b9b8f2";

export function ArgonMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const id = useId();
  // Thicker strokes at favicon-ish sizes so the arch stays legible.
  const small = size <= 32;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-arch`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={BRAND_PEACH} />
          <stop offset="1" stopColor={BRAND_LILAC} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill={BRAND_INK} />
      <path
        d={ARCH_PATH}
        fill="none"
        stroke={`url(#${id}-arch)`}
        strokeWidth={small ? 11 : 9}
        strokeLinecap="round"
      />
      <circle cx="50" cy="61" r={small ? 6 : 5} fill={BRAND_PEACH} />
    </svg>
  );
}

/** Mark + stacked wordmark: "Argon" on top, a smaller "crm" below. */
export function ArgonLogo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: Math.round(size * 0.3) }}
    >
      <ArgonMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className="font-brand font-medium tracking-[-0.01em] text-foreground"
          style={{ fontSize: size * 0.55 }}
        >
          Argon
        </span>
        <span
          className="mt-[3px] pl-[2px] font-sans font-medium tracking-[0.32em] text-muted-foreground"
          style={{ fontSize: Math.max(9, size * 0.26) }}
        >
          crm
        </span>
      </span>
    </span>
  );
}
