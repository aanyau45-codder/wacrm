import { describe, expect, it } from 'vitest'
import { formatPhone, normalizeUgPhone, whatsappLink } from './phone'

describe('normalizeUgPhone', () => {
  it.each([
    ['0772 123456', '+256772123456'],
    ['772123456', '+256772123456'],
    ['+256 772 123 456', '+256772123456'],
    ['256772123456', '+256772123456'],
    ['00256772123456', '+256772123456'],
    ['+256 (0) 772 123456', '+256772123456'],
    ['0414-123456', '+256414123456'],
    ['0772 123456 / 0701 654321', '+256772123456'],
    [772123456, '+256772123456'],
    ['+254 712 345678', '+254712345678'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeUgPhone(raw)).toBe(expected)
  })

  it.each([null, '', 'n/a', '12345', '0772'])('rejects %s', (raw) => {
    expect(normalizeUgPhone(raw)).toBeNull()
  })
})

describe('display helpers', () => {
  it('formats a Ugandan number', () => {
    expect(formatPhone('+256772123456')).toBe('+256 772 123 456')
  })
  it('builds a wa.me link', () => {
    expect(whatsappLink('+256772123456')).toBe('https://wa.me/256772123456')
    expect(whatsappLink(null)).toBeNull()
  })
})
