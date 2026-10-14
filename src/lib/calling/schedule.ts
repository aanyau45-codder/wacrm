import { addDays, isoWeekday, kampalaToday, startOfWeek } from './dates'
import type { CallLead, CallSettings, LeadInput, OutcomeConfig, Temperature } from './types'

// ============================================================
// Call scheduling rules. Pure functions (no I/O) so the log-call
// form can preview exactly what the server will save, and so the
// rules are unit-tested (schedule.test.ts).
// ============================================================

/** First allowed call day on or after `date`. */
export function nextCallDay(date: string, settings: Pick<CallSettings, 'call_days'>): string {
  const days = settings.call_days
  if (!days.length) return date
  let d = date
  for (let i = 0; i < 7; i++) {
    if (days.includes(isoWeekday(d))) return d
    d = addDays(d, 1)
  }
  return date
}

/** Call day `days` after `today` (rolled forward past non-call days). */
export function callDayAfter(
  today: string,
  days: number,
  settings: Pick<CallSettings, 'call_days'>,
): string {
  return nextCallDay(addDays(today, Math.max(0, days)), settings)
}

/** Kampala "HH:MM" of an instant. */
function kampalaTime(now: Date): string {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(11, 16)
}

/**
 * Where a freshly imported lead can first be scheduled: today if it's a
 * call day and calling hours aren't over, otherwise the next call day.
 */
export function firstQueueDate(settings: CallSettings, now: Date = new Date()): string {
  const today = kampalaToday(now)
  const todayOpen =
    settings.call_days.includes(isoWeekday(today)) && kampalaTime(now) < settings.end_time
  return todayOpen ? today : nextCallDay(addDays(today, 1), settings)
}

/** Default priority (0–100) for a new lead: richer contact info first. */
export function scoreLead(lead: Pick<LeadInput, 'priority' | 'email' | 'website' | 'contact_person' | 'social_links'>): number {
  if (typeof lead.priority === 'number' && Number.isFinite(lead.priority)) {
    return Math.min(100, Math.max(0, Math.round(lead.priority)))
  }
  let score = 50
  if (lead.contact_person) score += 15
  if (lead.email) score += 10
  if (lead.website) score += 10
  if (lead.social_links && Object.keys(lead.social_links).length > 0) score += 5
  return Math.min(100, score)
}

/**
 * Spread new leads over upcoming call days, highest priority first.
 * Each day takes at most `min(daily_target, ceil(weekly_target / call
 * days))` calls INCLUDING calls already scheduled that day
 * (`existingByDate`), and each ISO week at most `weekly_target`.
 * Returns the date per lead key.
 */
export function assignInitialDates<T extends { key: string; priority: number }>(
  leads: T[],
  settings: CallSettings,
  startDate: string,
  existingByDate: Record<string, number> = {},
): Map<string, string> {
  const result = new Map<string, string>()
  if (!leads.length) return result

  const order = leads
    .map((lead, i) => ({ lead, i }))
    .sort((a, b) => b.lead.priority - a.lead.priority || a.i - b.i)
    .map(({ lead }) => lead)

  const callDays = settings.call_days.length || 7
  const perDay = Math.max(
    1,
    Math.min(settings.daily_target, Math.ceil(settings.weekly_target / callDays)),
  )

  const dayCount: Record<string, number> = { ...existingByDate }
  const weekCount: Record<string, number> = {}
  for (const [date, n] of Object.entries(existingByDate)) {
    const wk = startOfWeek(date)
    weekCount[wk] = (weekCount[wk] ?? 0) + n
  }

  let day = nextCallDay(startDate, settings)
  // Hard stop (~10 years) so a bad config can never loop forever.
  for (let guard = 0, idx = 0; idx < order.length && guard < 3650; guard++) {
    const wk = startOfWeek(day)
    while (
      idx < order.length &&
      (dayCount[day] ?? 0) < perDay &&
      (weekCount[wk] ?? 0) < settings.weekly_target
    ) {
      result.set(order[idx].key, day)
      dayCount[day] = (dayCount[day] ?? 0) + 1
      weekCount[wk] = (weekCount[wk] ?? 0) + 1
      idx++
    }
    day = nextCallDay(addDays(day, 1), settings)
  }
  return result
}

/** Outcomes that take the lead out of the queue. */
export function isRemovalOutcome(outcome: OutcomeConfig): boolean {
  return outcome.action === 'invalid' || outcome.action === 'lost'
}

type LeadCallState = Pick<CallLead, 'temperature' | 'attempts' | 'failed_attempts'>

/**
 * What the log form pre-fills for an outcome: suggested temperature and
 * next call date (null = leaves the queue).
 */
export function suggestForOutcome(
  lead: LeadCallState,
  outcome: OutcomeConfig,
  settings: CallSettings,
  today: string,
): { temperature: Temperature; nextCallDate: string | null; parked: boolean } {
  const current: Temperature = lead.temperature ?? 'cold'
  if (outcome.action === 'invalid') {
    return { temperature: outcome.temperature ?? current, nextCallDate: null, parked: false }
  }
  if (outcome.action === 'lost') {
    return { temperature: 'lost', nextCallDate: null, parked: false }
  }
  if (outcome.failed && lead.failed_attempts + 1 >= settings.failed_attempt_limit) {
    return {
      temperature: 'cold',
      nextCallDate: callDayAfter(today, settings.park_days, settings),
      parked: true,
    }
  }
  const temperature = outcome.temperature ?? current
  const nextCallDate =
    outcome.action === 'meeting'
      ? addDays(today, Math.max(1, outcome.days))
      : callDayAfter(today, Math.max(1, outcome.days), settings)
  return { temperature, nextCallDate, parked: false }
}

export interface LogCallInput {
  outcome: OutcomeConfig
  temperature: Temperature
  /** Date from the form (pre-filled from the rules, maybe edited). */
  nextCallDate?: string | null
}

export interface LeadUpdate {
  temperature: Temperature
  last_outcome: string
  attempts: number
  failed_attempts: number
  next_call_date: string | null
  phone_invalid?: boolean
  do_not_call?: boolean
}

/**
 * Apply one logged call to the lead's denormalised state. The form's
 * date wins (manual override) unless the call takes the lead out of the
 * queue: wrong number, lost, won or do-not-call.
 */
export function applyCall(
  lead: LeadCallState,
  input: LogCallInput,
  settings: CallSettings,
  today: string,
): LeadUpdate {
  const { outcome } = input
  const suggestion = suggestForOutcome(lead, outcome, settings, today)
  const failed = outcome.failed ? lead.failed_attempts + 1 : 0
  const update: LeadUpdate = {
    temperature: input.temperature,
    last_outcome: outcome.key,
    attempts: lead.attempts + 1,
    // Reset once the lead is parked so the next cycle starts fresh.
    failed_attempts: suggestion.parked ? 0 : failed,
    next_call_date: input.nextCallDate || suggestion.nextCallDate,
  }

  if (outcome.action === 'invalid') {
    update.phone_invalid = true
    update.next_call_date = null
  }
  if (outcome.action === 'lost') {
    update.temperature = input.temperature === 'dnc' ? 'dnc' : 'lost'
    update.next_call_date = null
  }
  if (update.temperature === 'lost' || update.temperature === 'won') {
    update.next_call_date = null
  }
  if (update.temperature === 'dnc') {
    update.do_not_call = true
    update.next_call_date = null
  }
  return update
}
