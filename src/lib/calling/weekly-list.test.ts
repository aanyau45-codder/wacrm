import { describe, expect, it } from 'vitest'
import { isFollowUp, isInPool, isOnList, planRefresh, type ListLead } from './weekly-list'

const TODAY = '2026-10-21'
const lead = (id: string, p: Partial<ListLead> = {}): ListLead => ({
  id,
  priority: 50,
  created_at: '2026-10-01T00:00:00Z',
  next_call_date: null,
  attempts: 0,
  do_not_call: false,
  phone_invalid: false,
  temperature: null,
  ...p,
})

describe('weekly list', () => {
  it('sorts leads into pool, list and follow-ups', () => {
    expect(isInPool(lead('a'))).toBe(true)
    expect(isOnList(lead('b', { next_call_date: TODAY }))).toBe(true)
    expect(isFollowUp(lead('c', { attempts: 1, next_call_date: TODAY }))).toBe(true)
    expect(isOnList(lead('d', { attempts: 1, next_call_date: TODAY }))).toBe(false)
    expect(isInPool(lead('e', { do_not_call: true }))).toBe(false)
    expect(isInPool(lead('f', { temperature: 'lost' }))).toBe(false)
  })

  it('tops the list up to the goal from the pool, by priority', () => {
    const leads = [
      lead('kept', { next_call_date: TODAY }),
      lead('low', { priority: 10 }),
      lead('high', { priority: 90 }),
      lead('mid', { priority: 50 }),
      lead('followup', { attempts: 2, next_call_date: '2026-10-01' }),
    ]
    const plan = planRefresh(leads, 3, TODAY)
    expect(plan.toList).toEqual(['high', 'mid'])
    expect(plan.toPool).toEqual([])
    expect(plan.listSize).toBe(3)
    expect(plan.poolLeft).toBe(1)
  })

  it('adds nothing when the list is already full; re-dates old ones to today', () => {
    const leads = [lead('old', { next_call_date: '2026-10-13' }), lead('now', { next_call_date: TODAY }), lead('pool')]
    const plan = planRefresh(leads, 2, TODAY)
    expect(plan.toList).toEqual(['old'])
    expect(plan.listSize).toBe(2)
    expect(plan.poolLeft).toBe(1)
  })

  it('sends extra leads back to the pool when over the goal', () => {
    const leads = [
      lead('first', { next_call_date: '2026-10-13' }),
      lead('second', { next_call_date: '2026-10-20' }),
      lead('third', { next_call_date: '2026-11-02' }),
    ]
    const plan = planRefresh(leads, 2, TODAY)
    expect(plan.toList).toEqual(['first', 'second'])
    expect(plan.toPool).toEqual(['third'])
    expect(plan.listSize).toBe(2)
  })
})
