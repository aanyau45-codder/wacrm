import { describe, expect, it } from 'vitest'
import { fillQuickMessage } from './quick-messages'
import { whatsappLink } from './phone'

describe('fillQuickMessage', () => {
  it('uses the contact person, falling back to the business', () => {
    expect(fillQuickMessage('Hi {name} at {business}', { business_name: 'Leans Cakes', contact_person: 'Sarah' })).toBe(
      'Hi Sarah at Leans Cakes',
    )
    expect(fillQuickMessage('Hi {Name}', { business_name: 'Leans Cakes', contact_person: null })).toBe('Hi Leans Cakes')
  })
})

describe('whatsappLink with text', () => {
  it('pre-fills an encoded message', () => {
    expect(whatsappLink('+256781829552', 'Hi & bye')).toBe('https://wa.me/256781829552?text=Hi%20%26%20bye')
    expect(whatsappLink('+256781829552', '  ')).toBe('https://wa.me/256781829552')
  })
})
