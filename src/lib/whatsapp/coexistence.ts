/**
 * WhatsApp Business app coexistence — the same number keeps working in
 * the WhatsApp Business app on the phone while Argon CRM uses it through
 * the Cloud API. Onboarded with Embedded Signup (featureType
 * `whatsapp_business_app_onboarding`); afterwards Meta sends three extra
 * webhook fields:
 *
 *   smb_message_echoes  — messages the business sent from the phone app
 *   history             — up to 180 days of past chats, in chunks
 *   smb_app_state_sync  — the phone's contact list (add / edit / remove)
 *
 * This module holds the payload shapes and the pure mapping helpers; the
 * webhook route does the DB work.
 */

export const COEXISTENCE_FIELDS = ['smb_message_echoes', 'history', 'smb_app_state_sync'] as const
export type CoexistenceField = (typeof COEXISTENCE_FIELDS)[number]

export function isCoexistenceField(field: string): field is CoexistenceField {
  return (COEXISTENCE_FIELDS as readonly string[]).includes(field)
}

/** Embedded Signup session event for the Business app (coexistence) flow. */
export const COEXISTENCE_FINISH_EVENT = 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'

/** History webhook error code when the business declines sharing chats. */
export const HISTORY_DECLINED_CODE = 2593109

export interface CoexMedia {
  id?: string
  mime_type?: string
  caption?: string
  filename?: string
}

/** A message as it appears in echoes and history threads. */
export interface CoexMessage {
  id: string
  from: string
  /** Present on echoes (and history messages the business sent). */
  to?: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: CoexMedia
  video?: CoexMedia
  document?: CoexMedia
  audio?: CoexMedia
  sticker?: CoexMedia
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  history_context?: { status?: string }
}

export interface CoexMetadata {
  display_phone_number: string
  phone_number_id: string
}

export interface HistoryChunk {
  metadata?: { phase?: number; chunk_order?: number; progress?: number }
  threads?: { id: string; messages?: CoexMessage[] }[]
  errors?: { code?: number; title?: string; message?: string }[]
}

export interface StateSyncItem {
  type: string
  contact?: { full_name?: string; first_name?: string; phone_number?: string }
  action?: 'add' | 'edit' | 'remove' | string
}

export interface CoexistenceValue {
  messaging_product?: string
  metadata: CoexMetadata
  message_echoes?: CoexMessage[]
  history?: HistoryChunk[]
  state_sync?: StateSyncItem[]
}

const CONTENT_TYPES = new Set(['text', 'image', 'document', 'audio', 'video', 'location'])

/**
 * Message row content for a synced (echo / history) message. No Meta
 * round-trip: media becomes a proxy URL when Meta sent an id (history only
 * carries ids for the last 14 days), otherwise a placeholder text.
 */
export function coexContent(m: CoexMessage): {
  contentType: string
  contentText: string | null
  mediaUrl: string | null
} {
  if (m.type === 'location' && m.location) {
    const l = m.location
    return {
      contentType: 'location',
      contentText: [l.name, l.address, `${l.latitude},${l.longitude}`].filter(Boolean).join(' - '),
      mediaUrl: null,
    }
  }
  const media = m.type === 'sticker' ? m.sticker : (m as unknown as Record<string, CoexMedia | undefined>)[m.type]
  if (m.type !== 'text' && media && typeof media === 'object') {
    const contentType = m.type === 'sticker' ? 'image' : CONTENT_TYPES.has(m.type) ? m.type : 'text'
    const label = media.caption || media.filename || null
    if (media.id && contentType !== 'text') {
      return { contentType, contentText: label, mediaUrl: `/api/whatsapp/media/${media.id}` }
    }
    return { contentType: 'text', contentText: label ?? `[${m.type}]`, mediaUrl: null }
  }
  if (m.type === 'text') return { contentType: 'text', contentText: m.text?.body ?? '', mediaUrl: null }
  return { contentType: 'text', contentText: `[${m.type}]`, mediaUrl: null }
}

/** Map Meta's history_context.status onto messages.status. */
export function historyStatus(m: CoexMessage, fromBusiness: boolean): string {
  if (!fromBusiness) return 'delivered'
  switch ((m.history_context?.status ?? '').toUpperCase()) {
    case 'READ':
    case 'PLAYED':
      return 'read'
    case 'DELIVERED':
      return 'delivered'
    case 'ERROR':
      return 'failed'
    default:
      return 'sent'
  }
}

/** Synced messages we don't store as chat bubbles. */
export function isSkippedCoexType(type: string): boolean {
  return type === 'reaction' || type === 'unsupported' || type === 'system' || type === 'ephemeral'
}

export function coexTimestamp(m: CoexMessage): string {
  const secs = parseInt(m.timestamp, 10)
  return Number.isFinite(secs) ? new Date(secs * 1000).toISOString() : new Date().toISOString()
}

/** Who sent a history message: the business (has `to`) or the customer. */
export function isFromBusiness(m: CoexMessage, businessDigits: string): boolean {
  if (m.to) return true
  return !!businessDigits && m.from.replace(/\D/g, '') === businessDigits
}
