import type { AiConfig } from '@/lib/ai/types'
import type { LeadInput } from '../types'
import { LeadSourceError, type LeadSource } from './types'

// Fallback when there's no Google Places key: the account's own
// OpenRouter key with OpenRouter's web-search plugin. Results come from
// live web pages, but every lead is flagged "verify before calling".

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const SYSTEM_PROMPT = `You find real small and medium businesses in Uganda for a sales team to cold-call.
Use web search. Only include businesses you found on a real web page or directory listing with a phone number.
Never invent phone numbers, emails or websites — leave a field null if you didn't see it.
Reply with ONLY a JSON array, no prose, of objects with these keys:
business_name, contact_person, phone, email, website, facebook, instagram, town, address, why
"why" = one short sentence on why this business is a good lead (size, activity, gaps like no website).`

interface AiLead {
  business_name?: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  facebook?: string | null
  instagram?: string | null
  town?: string | null
  address?: string | null
  why?: string | null
}

/** Pull the first JSON array out of a model reply (tolerates ``` fences). */
export function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function aiWebSource(config: AiConfig): LeadSource {
  return {
    id: 'ai_web',
    label: 'AI web search',
    async search(params) {
      if (config.provider !== 'openrouter') {
        throw new LeadSourceError(
          'Lead search needs a Google Places key (GOOGLE_PLACES_API_KEY) or an OpenRouter key in Settings → AI.',
          400,
        )
      }
      const where = params.locations.length ? params.locations.join(', ') : 'Kampala'
      let res: Response
      try {
        res = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Argon CRM',
          },
          body: JSON.stringify({
            model: config.model,
            plugins: [{ id: 'web', max_results: 10 }],
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: `Find up to ${params.count} ${params.industry} businesses in ${where}, Uganda. Spread them across the listed locations.`,
              },
            ],
            max_tokens: 6000,
          }),
          signal: AbortSignal.timeout(90_000),
        })
      } catch {
        throw new LeadSourceError('The AI search timed out. Try fewer leads.')
      }
      const data = (await res.json().catch(() => null)) as {
        choices?: { message?: { content?: string } }[]
        error?: { message?: string }
      } | null
      if (!res.ok) {
        throw new LeadSourceError(
          `OpenRouter error (${res.status})${data?.error?.message ? `: ${data.error.message}` : ''}`,
        )
      }
      const rows = extractJsonArray(data?.choices?.[0]?.message?.content ?? '') as AiLead[]
      return rows
        .filter((r) => r && typeof r.business_name === 'string' && r.business_name.trim())
        .slice(0, params.count)
        .map((r): LeadInput => {
          const social: Record<string, string> = {}
          if (r.facebook) social.facebook = r.facebook
          if (r.instagram) social.instagram = r.instagram
          return {
            business_name: r.business_name!.trim(),
            contact_person: r.contact_person ?? null,
            phone: r.phone ?? null,
            email: r.email ?? null,
            website: r.website ?? null,
            social_links: social,
            industry: params.industry,
            town: r.town ?? params.locations[0] ?? null,
            address: r.address ?? null,
            maps_url: `https://www.google.com/maps/search/${encodeURIComponent(`${r.business_name} ${r.town ?? where} Uganda`)}`,
            source: 'ai_web',
            lead_note: `${r.why ? `${r.why} ` : ''}(AI web result — verify before calling)`,
          }
        })
    },
  }
}
