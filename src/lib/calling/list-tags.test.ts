import { describe, expect, it } from 'vitest'
import { countTypes, leadTypes, tagFromFileName, withTag } from './list-tags'

describe('tagFromFileName', () => {
  it('turns a file name into a readable tag', () => {
    expect(tagFromFileName('schools.xlsx')).toBe('Schools')
    expect(tagFromFileName('private_schools-kampala.csv')).toBe('Private schools kampala')
    expect(tagFromFileName('.csv')).toBe('')
  })
})

describe('withTag', () => {
  it('adds once, ignoring case and blanks', () => {
    expect(withTag(['Schools'], 'schools ')).toEqual(['Schools'])
    expect(withTag([], '  ')).toEqual([])
    expect(withTag(undefined, 'Clinics')).toEqual(['Clinics'])
  })
})

describe('leadTypes / countTypes', () => {
  it('falls back to industry and merges case-insensitively', () => {
    expect(leadTypes({ tags: ['Schools'], industry: 'schools' })).toEqual(['Schools'])
    expect(leadTypes({ tags: [], industry: 'Bakery' })).toEqual(['Bakery'])
    expect(
      countTypes([
        { tags: ['Schools'], industry: null },
        { tags: [], industry: 'schools' },
        { tags: [], industry: 'Bakery' },
      ]),
    ).toEqual([
      { key: 'schools', label: 'Schools', count: 2 },
      { key: 'bakery', label: 'Bakery', count: 1 },
    ])
  })
})
