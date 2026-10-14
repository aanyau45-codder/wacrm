import { describe, expect, it } from 'vitest'
import { dealStatusForCall, defaultLeadStage } from './pipeline'

describe('dealStatusForCall', () => {
  it('closes the deal on won / lost / do not call', () => {
    expect(dealStatusForCall('won', 'open')).toBe('won')
    expect(dealStatusForCall('lost', 'open')).toBe('lost')
    expect(dealStatusForCall('dnc', 'won')).toBe('lost')
  })
  it('reopens a closed deal on a hot or warm call', () => {
    expect(dealStatusForCall('hot', 'lost')).toBe('open')
    expect(dealStatusForCall('warm', 'won')).toBe('open')
  })
  it('leaves the deal alone otherwise', () => {
    expect(dealStatusForCall('hot', 'open')).toBeNull()
    expect(dealStatusForCall('cold', 'open')).toBeNull()
    expect(dealStatusForCall('cold', 'lost')).toBeNull()
    expect(dealStatusForCall('won', 'won')).toBeNull()
  })
})

describe('defaultLeadStage', () => {
  const s = (id: string, name: string, position: number) => ({ id, name, position })
  it('prefers a Hot or Qualified stage', () => {
    expect(defaultLeadStage([s('a', 'New Lead', 0), s('b', 'Qualified', 1)])?.id).toBe('b')
    expect(defaultLeadStage([s('a', 'New', 0), s('c', 'Hot lead', 2)])?.id).toBe('c')
  })
  it('falls back to the first stage', () => {
    expect(defaultLeadStage([s('b', 'Proposal', 1), s('a', 'New', 0)])?.id).toBe('a')
    expect(defaultLeadStage([])).toBeNull()
  })
})
