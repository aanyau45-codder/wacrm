import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  /** Pre-formatted value for display (e.g. "42" or "$1,250"). */
  value: string
  icon: ComponentType<{ className?: string }>
  /**
   * Delta-mode secondary row: arrow + delta text. Omit when the metric
   * doesn't have a sensible comparison (e.g. total pipeline value).
   */
  delta?: {
    /** Positive / negative / zero drives arrow + color. */
    sign: number
    /** Pre-formatted delta, e.g. "+3 vs yesterday". */
    label: string
  }
  /** Used instead of `delta` when the metric has a static subtitle. */
  subtitle?: string
  /** Pastel card colour (Argon "Pastel Cards" look). */
  tone?: 'peach' | 'lilac' | 'mint' | 'coral'
}

const TONES = {
  peach: 'bg-pastel-peach',
  lilac: 'bg-pastel-lilac',
  mint: 'bg-pastel-mint',
  coral: 'bg-pastel-coral',
} as const

export function MetricCard({ title, value, icon: Icon, delta, subtitle, tone = 'lilac' }: MetricCardProps) {
  return (
    <div className={cn('rounded-3xl p-5', TONES[tone])}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-foreground/70">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card/80 text-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-heading text-[28px] leading-none font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {delta ? <DeltaRow sign={delta.sign} label={delta.label} /> : subtitle ? (
        <p className="mt-2 text-sm text-foreground/70">{subtitle}</p>
      ) : null}
    </div>
  )
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const tone =
    sign > 0
      ? 'text-foreground'
      : sign < 0
      ? 'text-red-700 dark:text-red-300'
      : 'text-foreground/60'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className={cn('mt-2 flex items-center gap-1 text-sm', tone)}>
      <Arrow className="h-4 w-4" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  )
}
