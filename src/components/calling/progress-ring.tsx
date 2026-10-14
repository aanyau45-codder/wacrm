import { cn } from '@/lib/utils'

/** Violet ring on lilac: calls done vs target. */
export function ProgressRing({ value, max, size = 64, className }: { value: number; max: number; size?: number; className?: string }) {
  const stroke = Math.round(size / 9)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.min(1, value / Math.max(1, max))
  return (
    <div
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
      title={`${value} of ${max} calls`}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-pastel-lilac" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          className="stroke-violet-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="text-center leading-none">
        <b className="block font-extrabold tabular-nums" style={{ fontSize: size / 4 }}>{value}</b>
        <span className="text-[10px] text-muted-foreground tabular-nums">/{max}</span>
      </div>
    </div>
  )
}
