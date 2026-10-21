// Tasks with reminders. Dates and times are typed and shown in
// Africa/Kampala (UTC+3, no DST); due_at / remind_at are stored as UTC
// instants.

import { addDays, kampalaToday } from '@/lib/calling/dates'

export interface Task {
  id: string
  account_id: string
  user_id: string
  title: string
  notes: string | null
  due_at: string
  remind_minutes: number | null
  remind_at: string | null
  reminded_at: string | null
  done_at: string | null
  lead_id: string | null
  deal_id: string | null
  contact_id: string | null
  source: 'manual' | 'call'
  call_log_id: string | null
  created_at: string
  updated_at: string
}

const KAMPALA_OFFSET_MS = 3 * 60 * 60 * 1000

/** Reminder choices offered per task (minutes before; null = none). */
export const REMIND_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'At the time' },
  { value: 5, label: '5 min before' },
  { value: 15, label: '15 min before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
]
export const DEFAULT_REMIND_MINUTES = 15

export function remindLabel(minutes: number | null): string {
  return REMIND_OPTIONS.find((o) => o.value === minutes)?.label ?? `${minutes} min before`
}

/** UTC ISO instant of a Kampala local date ("2026-10-26") + time ("10:30"). */
export function kampalaToIso(date: string, time: string): string {
  return new Date(Date.parse(`${date}T${time}:00Z`) - KAMPALA_OFFSET_MS).toISOString()
}

/** Kampala local { date, time } of an instant. */
export function isoToKampala(instant: string | Date): { date: string; time: string } {
  const t = (typeof instant === 'string' ? Date.parse(instant) : instant.getTime()) + KAMPALA_OFFSET_MS
  const iso = new Date(t).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** When the reminder fires, or null for "no reminder". */
export function remindAtFor(dueAt: string, minutes: number | null): string | null {
  if (minutes === null) return null
  return new Date(Date.parse(dueAt) - minutes * 60_000).toISOString()
}

/** Columns to write when a task's due time or reminder changes. */
export function scheduleFields(dueAt: string, minutes: number | null, now: Date = new Date()) {
  const remindAt = remindAtFor(dueAt, minutes)
  return {
    due_at: dueAt,
    remind_minutes: minutes,
    remind_at: remindAt,
    // A reminder time already in the past is treated as sent, so editing
    // an old task doesn't fire a stale notification.
    reminded_at: remindAt && Date.parse(remindAt) <= now.getTime() ? now.toISOString() : null,
  }
}

export type TaskGroup = 'overdue' | 'today' | 'upcoming' | 'done'

export function taskGroup(task: Pick<Task, 'due_at' | 'done_at'>, now: Date = new Date()): TaskGroup {
  if (task.done_at) return 'done'
  if (Date.parse(task.due_at) < now.getTime()) return 'overdue'
  return isoToKampala(task.due_at).date === kampalaToday(now) ? 'today' : 'upcoming'
}

/** "10:30", "Tomorrow 10:30", "Mon 26 Oct, 10:30". */
export function formatDue(dueAt: string, now: Date = new Date()): string {
  const { date, time } = isoToKampala(dueAt)
  const today = kampalaToday(now)
  if (date === today) return time
  if (date === addDays(today, 1)) return `Tomorrow ${time}`
  if (date === addDays(today, -1)) return `Yesterday ${time}`
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  return `${day}, ${time}`
}

/** Sort: open tasks by due time, done ones newest first. */
export function sortTasks<T extends Pick<Task, 'due_at' | 'done_at'>>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (!!a.done_at !== !!b.done_at) return a.done_at ? 1 : -1
    if (a.done_at && b.done_at) return b.done_at.localeCompare(a.done_at)
    return a.due_at.localeCompare(b.due_at)
  })
}

/**
 * Should the morning summary go out now? Once per Kampala day, at or
 * after the chosen time, and only within 3 hours of it (a scheduler
 * outage shouldn't produce an "8am summary" at 4pm).
 */
export function isSummaryDue(
  s: { morning_summary: boolean; summary_time: string; last_summary_on: string | null },
  now: Date = new Date(),
): boolean {
  if (!s.morning_summary) return false
  const today = kampalaToday(now)
  if (s.last_summary_on && s.last_summary_on >= today) return false
  const at = Date.parse(kampalaToIso(today, s.summary_time.slice(0, 5)))
  return now.getTime() >= at && now.getTime() < at + 3 * 60 * 60 * 1000
}

/** Text of the morning summary notification. */
export function summaryBody(c: { today: number; overdue: number; calls: number; followUps: number; first: string[] }): string {
  const parts: string[] = []
  if (c.today) parts.push(`${c.today} ${c.today === 1 ? 'task' : 'tasks'} today`)
  if (c.overdue) parts.push(`${c.overdue} overdue`)
  if (c.calls) parts.push(`${c.calls} ${c.calls === 1 ? 'call' : 'calls'} to make` + (c.followUps ? ` (${c.followUps} follow-ups)` : ''))
  if (!parts.length) return 'Nothing scheduled today.'
  const head = parts.join(' · ')
  return c.first.length ? `${head}\n${c.first.map((t) => `• ${t}`).join('\n')}` : head
}
