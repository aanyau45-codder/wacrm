import { DEFAULT_QUICK_MESSAGES } from './quick-messages'
import type { CallSettings, OutcomeConfig, Temperature } from './types'

// Mirrors the seed in supabase/migrations/040_lead_calling.sql. Used
// when an account has no call_settings row yet.
export const DEFAULT_OUTCOMES: OutcomeConfig[] = [
  { key: 'no_answer', label: 'Did not pick up', action: 'retry', days: 2, temperature: null, failed: true, pickup: false },
  { key: 'picked_no_talk', label: 'Picked up – didn’t talk', action: 'pick_date', days: 1, temperature: null, failed: false, pickup: true },
  { key: 'phone_off', label: 'Phone didn’t go through / off', action: 'retry', days: 2, temperature: null, failed: true, pickup: false },
  { key: 'wrong_number', label: 'Wrong number', action: 'invalid', days: 0, temperature: null, failed: false, pickup: false },
  { key: 'rude', label: 'Very harsh / rude', action: 'lost', days: 0, temperature: 'lost', failed: false, pickup: true },
  { key: 'call_back', label: 'Call back later', action: 'pick_date', days: 1, temperature: null, failed: false, pickup: true },
  { key: 'interested', label: 'Interested – send info', action: 'retry', days: 3, temperature: 'warm', failed: false, pickup: true },
  { key: 'meeting', label: 'Meeting booked', action: 'meeting', days: 1, temperature: 'hot', failed: false, pickup: true },
  { key: 'not_interested', label: 'Not interested', action: 'lost', days: 0, temperature: 'lost', failed: false, pickup: true },
  { key: 'has_solution', label: 'Already has a solution', action: 'retry', days: 90, temperature: 'cold', failed: false, pickup: true },
]

export const DEFAULT_CALL_SETTINGS: CallSettings = {
  call_days: [1, 2, 3, 4, 5],
  start_time: '09:00',
  end_time: '17:00',
  daily_target: 20,
  weekly_target: 100,
  failed_attempt_limit: 4,
  park_days: 30,
  outcomes: DEFAULT_OUTCOMES,
  extra_tags: ['Decision maker', 'Gatekeeper', 'Send WhatsApp', 'Price sensitive', 'Follow up by email'],
  quick_messages: DEFAULT_QUICK_MESSAGES,
}

export const TEMPERATURE_META: Record<Temperature | 'new', { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-pastel-lilac text-pastel-lilac-fg' },
  cold: { label: 'Cold', className: 'bg-pastel-sky text-pastel-sky-fg' },
  warm: { label: 'Warm', className: 'bg-pastel-peach text-pastel-peach-fg' },
  hot: { label: 'Hot', className: 'bg-pastel-coral text-pastel-coral-fg' },
  won: { label: 'Won', className: 'bg-pastel-mint text-pastel-mint-fg' },
  lost: { label: 'Lost', className: 'bg-pastel-grey text-pastel-grey-fg' },
  dnc: { label: 'Do not call', className: 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' },
}

/** Merge a (possibly partial) call_settings row over the defaults. */
export function resolveSettings(row: Partial<CallSettings> | null | undefined): CallSettings {
  if (!row) return DEFAULT_CALL_SETTINGS
  const d = DEFAULT_CALL_SETTINGS
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  return {
    call_days:
      Array.isArray(row.call_days) && row.call_days.length > 0
        ? row.call_days.map(Number)
        : d.call_days,
    start_time: (row.start_time ?? d.start_time).slice(0, 5),
    end_time: (row.end_time ?? d.end_time).slice(0, 5),
    daily_target: num(row.daily_target, d.daily_target),
    weekly_target: num(row.weekly_target, d.weekly_target),
    failed_attempt_limit: num(row.failed_attempt_limit, d.failed_attempt_limit),
    park_days: num(row.park_days, d.park_days),
    outcomes: Array.isArray(row.outcomes) && row.outcomes.length > 0 ? row.outcomes : d.outcomes,
    extra_tags: Array.isArray(row.extra_tags) ? row.extra_tags : d.extra_tags,
    // NULL (or a row from before migration 043) means the defaults.
    quick_messages: Array.isArray(row.quick_messages) ? row.quick_messages : d.quick_messages,
  }
}
