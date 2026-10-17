import { CALL_TIMEZONE, kampalaDateOf } from './dates'
import type { CallLead, CallLog, Temperature } from './types'

/** A logged call with the lead it belongs to (call_logs + call_leads). */
export interface CallLogEntry extends CallLog {
  lead: CallLead | null
}

export interface CallLogFilter {
  query?: string
  outcome?: string | null
  temperature?: Temperature | null
  remarksOnly?: boolean
}

/** Search matches the business, contact, phone, remarks and tags. */
export function filterCallLog(entries: CallLogEntry[], f: CallLogFilter): CallLogEntry[] {
  const q = (f.query ?? '').trim().toLowerCase()
  // Local "0772…" should match the stored "256772…".
  const digits = q.replace(/\D/g, '').replace(/^0+/, '')
  return entries.filter((e) => {
    if (f.outcome && e.outcome !== f.outcome) return false
    if (f.temperature && e.temperature_after !== f.temperature) return false
    if (f.remarksOnly && !e.remarks?.trim()) return false
    if (!q) return true
    const l = e.lead
    const text = [l?.business_name, l?.contact_person, l?.town, e.remarks, ...e.tags].filter(Boolean).join(' ').toLowerCase()
    if (text.includes(q)) return true
    return digits.length >= 3 && !!l?.phone_normalized?.includes(digits)
  })
}

/** Newest first, grouped by Kampala calendar day. */
export function groupCallLogByDay(entries: CallLogEntry[]): { date: string; entries: CallLogEntry[] }[] {
  const sorted = [...entries].sort((a, b) => b.called_at.localeCompare(a.called_at))
  const groups: { date: string; entries: CallLogEntry[] }[] = []
  for (const e of sorted) {
    const date = kampalaDateOf(e.called_at)
    const last = groups[groups.length - 1]
    if (last?.date === date) last.entries.push(e)
    else groups.push({ date, entries: [e] })
  }
  return groups
}

/** "10:32" in Kampala time. */
export function formatCallClock(instant: string): string {
  return new Date(instant).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CALL_TIMEZONE,
  })
}
