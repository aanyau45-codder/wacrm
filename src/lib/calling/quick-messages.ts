import type { CallLead } from './types'

// Saved WhatsApp texts for the lead sheet. {name} is the contact person
// (or the business when there isn't one); {business} is the business.

export const DEFAULT_QUICK_MESSAGES = [
  'Hello {name}, I tried calling you today. When is a good time to talk?',
  'Hello {name}, thank you for your time on the phone. Here is the information I promised:',
  'Hello {name}, just following up on our call. Do you have any questions?',
]

export const MAX_QUICK_MESSAGES = 6

export function fillQuickMessage(
  template: string,
  lead: Pick<CallLead, 'business_name' | 'contact_person'>,
): string {
  const name = lead.contact_person?.trim() || lead.business_name
  return template.replace(/\{name\}/gi, name).replace(/\{business\}/gi, lead.business_name)
}
