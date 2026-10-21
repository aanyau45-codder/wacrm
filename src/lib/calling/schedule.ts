import { addDays, isoWeekday } from './dates'
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
