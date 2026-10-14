// ============================================================
// Lead Calling — shared types (see supabase/migrations/040).
// ============================================================

export const TEMPERATURES = ['cold', 'warm', 'hot', 'won', 'lost', 'dnc'] as const
export type Temperature = (typeof TEMPERATURES)[number]

export type OutcomeAction =
  /** Call again after `days` (call days only). */
  | 'retry'
  /** I choose the date; defaults to `days` from today. */
  | 'pick_date'
  /** Next call on the meeting date I enter. */
  | 'meeting'
  /** Flag the number invalid and drop it from the queue. */
  | 'invalid'
  /** Mark Lost and drop it from the queue (record kept). */
  | 'lost'

export const OUTCOME_ACTIONS: { value: OutcomeAction; label: string }[] = [
  { value: 'retry', label: 'Retry after N days' },
  { value: 'pick_date', label: 'I pick the date (default N days)' },
  { value: 'meeting', label: 'Meeting date' },
  { value: 'invalid', label: 'Invalid number — remove' },
  { value: 'lost', label: 'Mark lost — remove' },
]

export interface OutcomeConfig {
  key: string
  label: string
  action: OutcomeAction
  days: number
  /** Temperature the log form pre-selects (null = keep the lead's). */
  temperature: Temperature | null
  /** Counts as an unanswered attempt (towards the park rule). */
  failed: boolean
  /** Someone answered — feeds the pick-up rate. */
  pickup: boolean
}

export interface CallSettings {
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  call_days: number[]
  start_time: string
  end_time: string
  daily_target: number
  weekly_target: number
  failed_attempt_limit: number
  park_days: number
  outcomes: OutcomeConfig[]
  extra_tags: string[]
}

export type LeadSourceId = 'google_places' | 'ai_web' | 'csv' | 'manual'

export interface CallLead {
  id: string
  account_id: string
  user_id: string | null
  contact_id: string | null
  /** Deal this lead became on the pipeline (migration 042). */
  deal_id?: string | null
  business_name: string
  contact_person: string | null
  phone: string | null
  phone_normalized: string
  email: string | null
  website: string | null
  social_links: Record<string, string>
  industry: string | null
  town: string | null
  address: string | null
  maps_url: string | null
  source: LeadSourceId
  lead_note: string | null
  priority: number
  tags: string[]
  temperature: Temperature | null
  last_outcome: string | null
  last_remark: string | null
  last_called_at: string | null
  attempts: number
  failed_attempts: number
  next_call_date: string | null
  phone_invalid: boolean
  do_not_call: boolean
  created_at: string
  updated_at: string
}

export interface CallLog {
  id: string
  account_id: string
  lead_id: string
  user_id: string | null
  called_at: string
  outcome: string
  tags: string[]
  remarks: string | null
  temperature_after: Temperature
  next_call_date: string | null
  created_at: string
}

/** A lead before it's saved — from search, CSV/Excel or the add form. */
export interface LeadInput {
  business_name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  social_links?: Record<string, string>
  industry?: string | null
  town?: string | null
  address?: string | null
  maps_url?: string | null
  source: LeadSourceId
  lead_note?: string | null
  priority?: number | null
  tags?: string[]
}

export type DedupeStatus = 'new' | 'duplicate' | 'dnc' | 'no_phone'

export interface PreviewLead extends LeadInput {
  /** Stable client key for selection. */
  key: string
  status: DedupeStatus
  /** Why it was flagged (e.g. "Same phone as Kampala Bakers"). */
  reason?: string
}
