import { describe, expect, it } from 'vitest'
import { dedupeLeads, nameTownKey } from './dedupe'
import { parseCsv, rowsToLeads } from './parse-leads'
import type { LeadInput } from './types'

const lead = (business_name: string, phone: string | null, town = 'Kampala'): LeadInput => ({
  business_name,
  phone,
  town,
  source: 'csv',
})

describe('nameTownKey', () => {
  it('ignores case, punctuation and "Ltd"', () => {
    expect(nameTownKey('Mama Rose Bakery Ltd.', 'Kampala')).toBe(nameTownKey('mama rose  bakery', 'KAMPALA'))
  })
})

describe('dedupeLeads', () => {
  const existing = [
    { business_name: 'Kampala Bakers', town: 'Kampala', phone_normalized: '256772123456', do_not_call: false },
    { business_name: 'Grumpy Hardware', town: 'Jinja', phone_normalized: '256701000000', do_not_call: true },
  ]

  it('flags a phone match in any format', () => {
    const [r] = dedupeLeads([lead('Other Name', '0772 123 456')], existing)
    expect(r.status).toBe('duplicate')
    expect(r.phone).toBe('+256772123456')
  })

  it('flags a name + town match', () => {
    const [r] = dedupeLeads([lead('KAMPALA BAKERS', '0788111222')], existing)
    expect(r.status).toBe('duplicate')
  })

  it('keeps Do Not Call leads out', () => {
    const [r] = dedupeLeads([lead('Grumpy Hardware', '0799999999', 'Jinja')], existing)
    expect(r.status).toBe('dnc')
  })

  it('catches repeats inside the batch', () => {
    const rows = dedupeLeads([lead('A', '0772000001'), lead('B', '+256772000001')], [])
    expect(rows.map((r) => r.status)).toEqual(['new', 'duplicate'])
  })

  it('flags leads without a usable phone', () => {
    const [r] = dedupeLeads([lead('No Phone Ltd', 'n/a')], [])
    expect(r.status).toBe('no_phone')
  })

  it('same name in a different town is new', () => {
    const [r] = dedupeLeads([lead('Kampala Bakers', '0788111222', 'Mbarara')], existing)
    expect(r.status).toBe('new')
  })
})

describe('CSV parsing', () => {
  it('maps loose headers and quoted cells', () => {
    const csv = 'Company,Mobile No.,City,Notes\n"Rose, Bakery",0772 123456,Kampala,"Says ""hi"""\n'
    const { leads, error } = rowsToLeads(parseCsv(csv))
    expect(error).toBeUndefined()
    expect(leads).toEqual([
      { business_name: 'Rose, Bakery', phone: '0772 123456', town: 'Kampala', lead_note: 'Says "hi"', source: 'csv' },
    ])
  })

  it('handles semicolon files', () => {
    const { leads } = rowsToLeads(parseCsv('Name;Phone\nShop;0772123456'))
    expect(leads[0].business_name).toBe('Shop')
  })

  it('needs name and phone columns', () => {
    expect(rowsToLeads(parseCsv('Foo,Bar\n1,2')).error).toMatch(/business name/)
  })
})
