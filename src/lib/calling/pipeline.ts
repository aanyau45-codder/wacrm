import type { DealStatus } from '@/types'
import type { Temperature } from './types'

// Calls → pipeline rules (see migration 042 for the reverse direction).

/**
 * The deal status a call should move a linked deal to, or null to
 * leave it alone. Won → won; Lost / Do not call → lost; a Hot or Warm
 * call on a closed deal reopens it.
 */
export function dealStatusForCall(temperature: Temperature, current: DealStatus | null | undefined): DealStatus | null {
  const status = current ?? 'open'
  let next: DealStatus | null = null
  if (temperature === 'won') next = 'won'
  else if (temperature === 'lost' || temperature === 'dnc') next = 'lost'
  else if ((temperature === 'hot' || temperature === 'warm') && status !== 'open') next = 'open'
  return next === status ? null : next
}

/** Stage a new Hot lead lands in: one named "Hot…" / "Qualified…", else the first. */
export function defaultLeadStage<T extends { id: string; name: string; position: number }>(stages: T[]): T | null {
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  return sorted.find((s) => /^(hot|qualif)/i.test(s.name.trim())) ?? sorted[0] ?? null
}
