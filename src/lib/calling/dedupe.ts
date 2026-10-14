import { normalizeUgPhone, phoneKey } from './phone'
import type { LeadInput, PreviewLead } from './types'

// ============================================================
// Lead dedupe — shared by AI search, CSV/Excel import and the
// server-side import route. Two leads are the same when their
// phone numbers normalise to the same +256… number, or when the
// business name AND town match (case/spacing/punctuation ignored).
// Leads marked Do Not Call never come back.
// ============================================================

/** Minimal shape of an existing call_leads row needed for dedupe. */
export interface ExistingLeadRef {
  business_name: string
  town: string | null
  phone_normalized: string | null
  do_not_call: boolean
}

export function nameTownKey(name: string | null | undefined, town: string | null | undefined): string {
  const clean = (s: string | null | undefined) =>
    (s ?? '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\b(ltd|limited|co|company|uganda|u)\b\.?/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  const n = clean(name)
  return n ? `${n}|${clean(town)}` : ''
}

/** Normalise a raw lead (phone to +256…, trims). */
export function cleanLead(lead: LeadInput): LeadInput {
  const trim = (s: string | null | undefined) => {
    const t = (s ?? '').trim()
    return t ? t : null
  }
  let website = trim(lead.website)
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`
  return {
    ...lead,
    business_name: (lead.business_name ?? '').replace(/\s+/g, ' ').trim(),
    contact_person: trim(lead.contact_person),
    phone: normalizeUgPhone(lead.phone),
    email: trim(lead.email)?.toLowerCase() ?? null,
    website,
    industry: trim(lead.industry),
    town: trim(lead.town),
    address: trim(lead.address),
    maps_url: trim(lead.maps_url),
    lead_note: trim(lead.lead_note),
  }
}

/**
 * Tag each incoming lead new / duplicate / dnc / no_phone against the
 * account's existing leads and earlier rows of the same batch.
 */
export function dedupeLeads(
  incoming: LeadInput[],
  existing: ExistingLeadRef[],
): PreviewLead[] {
  const byPhone = new Map<string, ExistingLeadRef>()
  const byName = new Map<string, ExistingLeadRef>()
  for (const e of existing) {
    const p = phoneKey(e.phone_normalized)
    if (p) byPhone.set(p, e)
    const n = nameTownKey(e.business_name, e.town)
    if (n && !byName.has(n)) byName.set(n, e)
  }

  const batchPhone = new Map<string, string>()
  const batchName = new Map<string, string>()

  return incoming.map((raw, i) => {
    const lead = cleanLead(raw)
    const key = `${i}-${phoneKey(lead.phone) || nameTownKey(lead.business_name, lead.town) || 'x'}`
    const p = phoneKey(lead.phone)
    const n = nameTownKey(lead.business_name, lead.town)

    const match = (p && byPhone.get(p)) || (n && byName.get(n)) || null
    if (match?.do_not_call) {
      return { ...lead, key, status: 'dnc', reason: `On your Do Not Call list (${match.business_name})` }
    }
    if (match) {
      const how = p && byPhone.get(p) ? 'Same phone as' : 'Same name and town as'
      return { ...lead, key, status: 'duplicate', reason: `${how} ${match.business_name}` }
    }
    const dupInBatch = (p && batchPhone.get(p)) || (n && batchName.get(n))
    if (dupInBatch) {
      return { ...lead, key, status: 'duplicate', reason: `Repeated in this list (${dupInBatch})` }
    }
    if (p) batchPhone.set(p, lead.business_name)
    if (n) batchName.set(n, lead.business_name)

    if (!lead.business_name) {
      return { ...lead, key, status: 'no_phone', reason: 'Missing business name' }
    }
    if (!lead.phone) {
      return { ...lead, key, status: 'no_phone', reason: 'No valid phone number' }
    }
    return { ...lead, key, status: 'new' }
  })
}
