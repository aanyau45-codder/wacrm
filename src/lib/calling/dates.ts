// Calendar maths for the call queue. Every date here is a plain
// "YYYY-MM-DD" string in Africa/Kampala (UTC+3, no DST), matching the
// DATE column call_leads.next_call_date.

export const CALL_TIMEZONE = 'Africa/Kampala'
const KAMPALA_OFFSET_MS = 3 * 60 * 60 * 1000

/** Today's date in Kampala. */
export function kampalaToday(now: Date = new Date()): string {
  return new Date(now.getTime() + KAMPALA_OFFSET_MS).toISOString().slice(0, 10)
}

/** Kampala local date of an instant (e.g. a call_logs.called_at). */
export function kampalaDateOf(instant: string | Date): string {
  return kampalaToday(typeof instant === 'string' ? new Date(instant) : instant)
}

/** UTC instant of Kampala midnight starting `date` (for range queries). */
export function kampalaStartOfDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - KAMPALA_OFFSET_MS).toISOString()
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

/** Monday of the ISO week containing `date`. */
export function startOfWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date))
}

/** Sunday of the ISO week containing `date`. */
export function endOfWeek(date: string): string {
  return addDays(startOfWeek(date), 6)
}

/** "Today", "Tomorrow", "Yesterday" or "Wed 14 Oct". */
export function formatDay(date: string, today: string = kampalaToday()): string {
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  if (date === addDays(today, -1)) return 'Yesterday'
  return formatDate(date)
}

/** Always the plain date: "Wed 14 Oct". */
export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** "14 Oct, 10:32" in Kampala time. */
export function formatCallTime(instant: string): string {
  return new Date(instant).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CALL_TIMEZONE,
  })
}
