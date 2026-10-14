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
  tone?: 'peach' | 'lilac' | 'mint' | 'coral' | 'sky'
}

const TONES = {
  peach: 'bg-pastel-peach text-pastel-peach-fg',
  lilac: 'bg-pastel-lilac text-pastel-lilac-fg',
  mint: 'bg-pastel-mint text-pastel-mint-fg',
  coral: 'bg-pastel-coral text-pastel-coral-fg',
  sky: 'bg-pastel-sky text-pastel-sky-fg',
} as const

export function MetricCard({ title, value, icon: Icon, delta, subtitle, tone = 'lilac' }: MetricCardProps) {
  return (
    <div className={cn('min-h-[132px] rounded-[22px] p-4 sm:p-5', TONES[tone])}>
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-bold">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-current/10">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 font-heading text-[30px] leading-none font-extrabold tracking-tight tabular-nums">
        {value}
      </p>
      {delta ? <DeltaRow sign={delta.sign} label={delta.label} /> : subtitle ? (
        <p className="mt-2 text-[13px] font-medium opacity-80">{subtitle}</p>
      ) : null}
    </div>
  )
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const tone =
    sign > 0
      ? ''
      : sign < 0
      ? 'font-semibold'
      : 'opacity-70'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className={cn('mt-2 flex items-center gap-1 text-[13px] font-medium', tone)}>
      <Arrow className="h-4 w-4" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  )
}
