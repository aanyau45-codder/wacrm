import { describe, expect, it } from 'vitest'
import { filterCallLog, formatCallClock, groupCallLogByDay, type CallLogEntry } from './call-log'
import type { CallLead } from './types'

const lead = (p: Partial<CallLead>) =>
  ({ business_name: 'Jayz Bakery', contact_person: 'Jane', town: 'Kampala', phone_normalized: '256772123456', ...p }) as CallLead

const entry = (p: Partial<CallLogEntry>): CallLogEntry => ({
  id: 'x',
  account_id: 'a',
  lead_id: 'l',
  user_id: null,
  called_at: '2026-10-16T08:00:00Z',
  outcome: 'answered',
  tags: [],
  remarks: null,
  temperature_after: 'warm',
  next_call_date: null,
  created_at: '2026-10-16T08:00:00Z',
  lead: lead({}),
  ...p,
})

describe('call log', () => {
  const logs = [
    entry({ id: '1', remarks: 'Wants a demo on Friday', temperature_after: 'hot' }),
    entry({ id: '2', outcome: 'no_answer', lead: lead({ business_name: 'Mukono High School', phone_normalized: '256700999888' }) }),
    entry({ id: '3', tags: ['price objection'] }),
  ]

  it('searches business, remarks, tags and phone', () => {
    expect(filterCallLog(logs, { query: 'demo' }).map((e) => e.id)).toEqual(['1'])
    expect(filterCallLog(logs, { query: 'mukono' }).map((e) => e.id)).toEqual(['2'])
    expect(filterCallLog(logs, { query: 'price' }).map((e) => e.id)).toEqual(['3'])
    expect(filterCallLog(logs, { query: '0700 999' }).map((e) => e.id)).toEqual(['2'])
  })

  it('filters by outcome, stage and remarks', () => {
    expect(filterCallLog(logs, { outcome: 'no_answer' }).map((e) => e.id)).toEqual(['2'])
    expect(filterCallLog(logs, { temperature: 'hot' }).map((e) => e.id)).toEqual(['1'])
    expect(filterCallLog(logs, { remarksOnly: true }).map((e) => e.id)).toEqual(['1'])
  })

  it('groups by Kampala day, newest first', () => {
    const groups = groupCallLogByDay([
      entry({ id: 'a', called_at: '2026-10-15T20:30:00Z' }), // 23:30 Kampala, 15th
      entry({ id: 'b', called_at: '2026-10-15T21:30:00Z' }), // 00:30 Kampala, 16th
      entry({ id: 'c', called_at: '2026-10-16T09:00:00Z' }),
    ])
    expect(groups.map((g) => [g.date, g.entries.map((e) => e.id)])).toEqual([
      ['2026-10-16', ['c', 'b']],
      ['2026-10-15', ['a']],
    ])
    expect(formatCallClock('2026-10-16T09:05:00Z')).toBe('12:05')
  })
})
