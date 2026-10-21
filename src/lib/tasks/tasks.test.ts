import { describe, expect, it } from 'vitest'
import {
  formatDue,
  isSummaryDue,
  isoToKampala,
  kampalaToIso,
  remindAtFor,
  scheduleFields,
  sortTasks,
  summaryBody,
  taskGroup,
} from './tasks'

// Wed 21 Oct 2026, 10:00 in Kampala.
const NOW = new Date('2026-10-21T07:00:00Z')

describe('Kampala time conversion', () => {
  it('round-trips a local date + time', () => {
    const iso = kampalaToIso('2026-10-26', '10:30')
    expect(iso).toBe('2026-10-26T07:30:00.000Z')
    expect(isoToKampala(iso)).toEqual({ date: '2026-10-26', time: '10:30' })
  })

  it('handles times that cross midnight UTC', () => {
    expect(kampalaToIso('2026-10-26', '01:00')).toBe('2026-10-25T22:00:00.000Z')
    expect(isoToKampala('2026-10-25T22:00:00Z')).toEqual({ date: '2026-10-26', time: '01:00' })
  })
})

describe('reminders', () => {
  it('computes the reminder time', () => {
    expect(remindAtFor('2026-10-26T07:30:00.000Z', 15)).toBe('2026-10-26T07:15:00.000Z')
    expect(remindAtFor('2026-10-26T07:30:00.000Z', 0)).toBe('2026-10-26T07:30:00.000Z')
    expect(remindAtFor('2026-10-26T07:30:00.000Z', null)).toBeNull()
  })

  it('marks a past reminder as already sent', () => {
    const past = scheduleFields('2026-10-21T07:05:00.000Z', 15, NOW)
    expect(past.remind_at).toBe('2026-10-21T06:50:00.000Z')
    expect(past.reminded_at).toBe(NOW.toISOString())
    const future = scheduleFields('2026-10-21T08:00:00.000Z', 15, NOW)
    expect(future.reminded_at).toBeNull()
    expect(scheduleFields('2026-10-21T08:00:00.000Z', null, NOW)).toMatchObject({ remind_at: null, reminded_at: null })
  })
})

describe('taskGroup', () => {
  it('groups by Kampala day', () => {
    expect(taskGroup({ due_at: '2026-10-21T06:00:00Z', done_at: null }, NOW)).toBe('overdue')
    expect(taskGroup({ due_at: '2026-10-21T20:00:00Z', done_at: null }, NOW)).toBe('today') // 23:00 Kampala
    expect(taskGroup({ due_at: '2026-10-21T21:30:00Z', done_at: null }, NOW)).toBe('upcoming') // 00:30 Thu
    expect(taskGroup({ due_at: '2026-10-19T06:00:00Z', done_at: '2026-10-19T07:00:00Z' }, NOW)).toBe('done')
  })
})

describe('formatDue', () => {
  it('uses short labels near today', () => {
    expect(formatDue('2026-10-21T11:30:00Z', NOW)).toBe('14:30')
    expect(formatDue('2026-10-22T06:00:00Z', NOW)).toBe('Tomorrow 09:00')
    expect(formatDue('2026-10-20T06:00:00Z', NOW)).toBe('Yesterday 09:00')
    expect(formatDue('2026-10-26T06:00:00Z', NOW)).toBe('Mon 26 Oct, 09:00')
  })
})

describe('sortTasks', () => {
  it('puts open tasks first by due time, then done newest first', () => {
    const sorted = sortTasks([
      { due_at: '2026-10-22T06:00:00Z', done_at: null },
      { due_at: '2026-10-20T06:00:00Z', done_at: '2026-10-20T07:00:00Z' },
      { due_at: '2026-10-21T06:00:00Z', done_at: null },
      { due_at: '2026-10-19T06:00:00Z', done_at: '2026-10-21T07:00:00Z' },
    ])
    expect(sorted.map((t) => t.due_at.slice(8, 10))).toEqual(['21', '22', '19', '20'])
  })
})

describe('isSummaryDue', () => {
  const base = { morning_summary: true, summary_time: '08:00:00', last_summary_on: '2026-10-20' }

  it('fires once a day, from the chosen time for 3 hours', () => {
    expect(isSummaryDue(base, NOW)).toBe(true) // 10:00
    expect(isSummaryDue(base, new Date('2026-10-21T04:59:00Z'))).toBe(false) // 07:59
    expect(isSummaryDue(base, new Date('2026-10-21T08:00:00Z'))).toBe(false) // 11:00
    expect(isSummaryDue({ ...base, last_summary_on: '2026-10-21' }, NOW)).toBe(false)
    expect(isSummaryDue({ ...base, last_summary_on: null }, NOW)).toBe(true)
    expect(isSummaryDue({ ...base, morning_summary: false }, NOW)).toBe(false)
  })
})

describe('summaryBody', () => {
  it('summarises the day', () => {
    expect(summaryBody({ today: 2, overdue: 1, calls: 12, followUps: 3, first: ['Call Acme', 'Send quote'] })).toBe(
      '2 tasks today · 1 overdue · 12 calls to make (3 follow-ups)\n• Call Acme\n• Send quote',
    )
    expect(summaryBody({ today: 0, overdue: 0, calls: 0, followUps: 0, first: [] })).toBe('Nothing scheduled today.')
  })
})
