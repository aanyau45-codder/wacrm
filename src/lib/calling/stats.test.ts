import { describe, expect, it } from 'vitest'
import { DEFAULT_CALL_SETTINGS } from './defaults'
import { computeCallStats } from './stats'

const lead = (id: string, temperature: 'hot' | 'won' | 'cold' | null, industry = 'Schools') => ({
  id,
  temperature,
  industry,
  next_call_date: '2026-10-14',
  do_not_call: false,
  phone_invalid: false,
  attempts: 1,
})
// 10:00 Kampala on the given date.
const at = (date: string) => `${date}T07:00:00Z`

describe('computeCallStats', () => {
  const leads = [lead('a', 'won'), lead('b', 'hot'), lead('c', 'cold', 'Hotels'), lead('d', null)]
  const logs = [
    { lead_id: 'a', called_at: at('2026-10-12'), outcome: 'meeting', temperature_after: 'hot' as const },
    { lead_id: 'a', called_at: at('2026-10-14'), outcome: 'interested', temperature_after: 'won' as const },
    { lead_id: 'b', called_at: at('2026-10-14'), outcome: 'meeting', temperature_after: 'hot' as const },
    { lead_id: 'c', called_at: at('2026-10-14'), outcome: 'no_answer', temperature_after: 'cold' as const },
    { lead_id: 'c', called_at: at('2026-09-01'), outcome: 'no_answer', temperature_after: 'cold' as const },
  ]
  const s = computeCallStats(leads, logs, DEFAULT_CALL_SETTINGS, '2026-10-14', 7, '2026-10-12')

  it('counts calls today, this week and in range', () => {
    expect(s.callsToday).toBe(3)
    expect(s.callsWeek).toBe(4)
    expect(s.callsInRange).toBe(4)
  })

  it('computes pick-up rate from outcome settings', () => {
    expect(s.pickupRate).toBe(0.75)
  })

  it('computes Hot → Won conversion', () => {
    expect(s.hotEver).toBe(2)
    expect(s.hotWon).toBe(1)
    expect(s.hotToWon).toBe(0.5)
  })

  it('breaks results down by industry and temperature', () => {
    expect(s.byIndustry.map((r) => [r.industry, r.calls, r.pickups])).toEqual([
      ['Schools', 3, 3],
      ['Hotels', 1, 0],
    ])
    expect(s.byTemperature).toMatchObject({ new: 1, cold: 1, hot: 1, won: 1 })
    expect(s.queueToday).toBe(4)
  })
})
