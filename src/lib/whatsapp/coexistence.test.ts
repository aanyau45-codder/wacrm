import { describe, expect, it } from 'vitest'
import { coexContent, historyStatus, isCoexistenceField, isFromBusiness, type CoexMessage } from './coexistence'

const msg = (m: Partial<CoexMessage>): CoexMessage => ({ id: 'w1', from: '256700000001', timestamp: '1760000000', type: 'text', ...m })

describe('coexistence helpers', () => {
  it('recognises the coexistence webhook fields', () => {
    expect(isCoexistenceField('smb_message_echoes')).toBe(true)
    expect(isCoexistenceField('history')).toBe(true)
    expect(isCoexistenceField('messages')).toBe(false)
  })

  it('maps content without calling Meta', () => {
    expect(coexContent(msg({ text: { body: 'Hi' } }))).toEqual({ contentType: 'text', contentText: 'Hi', mediaUrl: null })
    expect(coexContent(msg({ type: 'image', image: { id: 'm1', caption: 'Cake' } }))).toEqual({
      contentType: 'image',
      contentText: 'Cake',
      mediaUrl: '/api/whatsapp/media/m1',
    })
    // Older history media comes without an id.
    expect(coexContent(msg({ type: 'document', document: { filename: 'menu.pdf' } }))).toEqual({
      contentType: 'text',
      contentText: 'menu.pdf',
      mediaUrl: null,
    })
    expect(coexContent(msg({ type: 'sticker', sticker: { id: 's1' } })).contentType).toBe('image')
  })

  it('tells business messages from customer ones', () => {
    expect(isFromBusiness(msg({ to: '256700000002' }), '256700000009')).toBe(true)
    expect(isFromBusiness(msg({ from: '+256 700 000009' }), '256700000009')).toBe(true)
    expect(isFromBusiness(msg({}), '256700000009')).toBe(false)
  })

  it('maps history status', () => {
    expect(historyStatus(msg({ history_context: { status: 'READ' } }), true)).toBe('read')
    expect(historyStatus(msg({ history_context: { status: 'PLAYED' } }), true)).toBe('read')
    expect(historyStatus(msg({}), true)).toBe('sent')
    expect(historyStatus(msg({ history_context: { status: 'READ' } }), false)).toBe('delivered')
  })
})
