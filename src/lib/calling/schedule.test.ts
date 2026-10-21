import { describe, expect, it } from 'vitest'
import { DEFAULT_CALL_SETTINGS, DEFAULT_OUTCOMES } from './defaults'
import {
  applyCall,
  callDayAfter,
  nextCallDay,
  scoreLead,
  suggestForOutcome,
} from './schedule'
import type { OutcomeConfig } from './types'

const settings = DEFAULT_CALL_SETTINGS // Mon–Fri, 20/day, 100/week, 4 fails → park 30
const outcome = (key: string): OutcomeConfig => DEFAULT_OUTCOMES.find((o) => o.key === key)!
const lead = (over: Partial<{ temperature: null | 'cold' | 'warm' | 'hot'; attempts: number; failed_attempts: number }> = {}) => ({
  temperature: null,
  attempts: 0,
  failed_attempts: 0,
  ...over,
})

// 2026-10-14 is a Wednesday; 2026-10-16 Friday; 2026-10-17 Saturday.
const WED = '2026-10-14'
const FRI = '2026-10-16'

describe('nextCallDay / callDayAfter', () => {
  it('keeps a call day', () => {
    expect(nextCallDay(WED, settings)).toBe(WED)
  })
  it('rolls a weekend forward to Monday', () => {
    expect(nextCallDay('2026-10-17', settings)).toBe('2026-10-19')
    expect(nextCallDay('2026-10-18', settings)).toBe('2026-10-19')
  })
  it('adds days then skips non-call days', () => {
    expect(callDayAfter(WED, 2, settings)).toBe(FRI)
    expect(callDayAfter(FRI, 2, settings)).toBe('2026-10-19')
  })
  it('honours custom call days', () => {
    expect(nextCallDay(WED, { call_days: [1] })).toBe('2026-10-19')
  })
})

describe('scoreLead', () => {
  it('uses an explicit priority', () => {
    expect(scoreLead({ priority: 120 })).toBe(100)
  })
  it('scores richer leads higher', () => {
    expect(scoreLead({ contact_person: 'Sarah', email: 'a@b.ug' })).toBeGreaterThan(scoreLead({}))
  })
})

describe('suggestForOutcome / applyCall', () => {
  it('did not pick up → retry in 2 call days', () => {
    const u = applyCall(lead(), { outcome: outcome('no_answer'), temperature: 'cold' }, settings, WED)
    expect(u.next_call_date).toBe(FRI)
    expect(u.failed_attempts).toBe(1)
    expect(u.attempts).toBe(1)
  })

  it('phone off on Friday → Fri + 2 lands on Sunday → Monday', () => {
    const u = applyCall(lead(), { outcome: outcome('phone_off'), temperature: 'cold' }, settings, FRI)
    expect(u.next_call_date).toBe('2026-10-19')
  })

  it('4th failed attempt → Cold and parked 30 days, counter reset', () => {
    const l = lead({ temperature: 'warm', attempts: 3, failed_attempts: 3 })
    const s = suggestForOutcome(l, outcome('no_answer'), settings, WED)
    expect(s).toEqual({ temperature: 'cold', nextCallDate: '2026-11-13', parked: true })
    const u = applyCall(l, { outcome: outcome('no_answer'), temperature: s.temperature }, settings, WED)
    expect(u.temperature).toBe('cold')
    expect(u.next_call_date).toBe('2026-11-13')
    expect(u.failed_attempts).toBe(0)
  })

  it('a picked-up call resets the failed counter', () => {
    const u = applyCall(lead({ failed_attempts: 2 }), { outcome: outcome('call_back'), temperature: 'cold' }, settings, WED)
    expect(u.failed_attempts).toBe(0)
  })

  it('call back → defaults to next day, my date overrides', () => {
    expect(suggestForOutcome(lead(), outcome('call_back'), settings, WED).nextCallDate).toBe('2026-10-15')
    const u = applyCall(lead(), { outcome: outcome('call_back'), temperature: 'warm', nextCallDate: '2026-10-22' }, settings, WED)
    expect(u.next_call_date).toBe('2026-10-22')
  })

  it('interested → Warm, 3 call days later', () => {
    const s = suggestForOutcome(lead(), outcome('interested'), settings, WED)
    expect(s.temperature).toBe('warm')
    expect(s.nextCallDate).toBe('2026-10-19') // Wed+3 = Sat → Mon
  })

  it('meeting booked → Hot, next call on the meeting date', () => {
    const u = applyCall(lead(), { outcome: outcome('meeting'), temperature: 'hot', nextCallDate: '2026-10-24' }, settings, WED)
    expect(u.temperature).toBe('hot')
    expect(u.next_call_date).toBe('2026-10-24') // a Saturday meeting is kept
  })

  it('wrong number → invalid, out of the queue', () => {
    const u = applyCall(lead(), { outcome: outcome('wrong_number'), temperature: 'cold', nextCallDate: '2026-10-20' }, settings, WED)
    expect(u.phone_invalid).toBe(true)
    expect(u.next_call_date).toBeNull()
  })

  it('harsh / not interested → Lost, out of the queue', () => {
    for (const key of ['rude', 'not_interested']) {
      const u = applyCall(lead(), { outcome: outcome(key), temperature: 'warm', nextCallDate: '2026-10-20' }, settings, WED)
      expect(u.temperature).toBe('lost')
      expect(u.next_call_date).toBeNull()
    }
  })

  it('Do Not Call always wins and is never rescheduled', () => {
    const u = applyCall(lead(), { outcome: outcome('interested'), temperature: 'dnc', nextCallDate: '2026-10-20' }, settings, WED)
    expect(u.do_not_call).toBe(true)
    expect(u.temperature).toBe('dnc')
    expect(u.next_call_date).toBeNull()
  })

  it('Won leaves the queue', () => {
    const u = applyCall(lead(), { outcome: outcome('meeting'), temperature: 'won', nextCallDate: '2026-10-20' }, settings, WED)
    expect(u.next_call_date).toBeNull()
  })
})
