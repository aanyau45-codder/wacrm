import { TEMPERATURE_META } from '@/lib/calling/defaults'
import type { Temperature } from '@/lib/calling/types'
import { cn } from '@/lib/utils'

export function TemperatureBadge({ value, className }: { value: Temperature | null; className?: string }) {
  const meta = TEMPERATURE_META[value ?? 'new']
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold',
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  )
}
