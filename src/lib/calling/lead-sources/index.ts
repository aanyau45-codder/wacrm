import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAiConfig } from '@/lib/ai/config'
import { aiWebSource } from './ai-web'
import { googlePlacesSource } from './google-places'
import { LeadSourceError, type LeadSource } from './types'

export * from './types'

/**
 * Pick the lead provider for this account: Google Places when the
 * server has GOOGLE_PLACES_API_KEY, else AI web search with the
 * account's OpenRouter key. Server-only.
 */
export async function getLeadSource(db: SupabaseClient, accountId: string): Promise<LeadSource> {
  const placesKey = process.env.GOOGLE_PLACES_API_KEY
  if (placesKey) return googlePlacesSource(placesKey)

  const ai = await loadAiConfig(db, accountId, { requireActive: false })
  if (ai) return aiWebSource(ai)
  throw new LeadSourceError(
    'Lead search isn’t set up yet. Add GOOGLE_PLACES_API_KEY to the server environment, or an OpenRouter key in Settings → AI.',
    400,
  )
}
