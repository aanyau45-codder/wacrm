import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAiConfig } from '@/lib/ai/config'
import { decrypt } from '@/lib/whatsapp/encryption'
import { aiWebSource } from './ai-web'
import { googlePlacesSource } from './google-places'
import { LeadSourceError, type LeadSource } from './types'

export * from './types'

/**
 * The account's Google Places key from Settings → Lead search,
 * decrypted. Null when none is saved. Server-only.
 */
export async function loadPlacesKey(db: SupabaseClient, accountId: string): Promise<string | null> {
  const { data, error } = await db
    .from('lead_source_keys')
    .select('google_places_api_key')
    .eq('account_id', accountId)
    .maybeSingle()
  // Table missing (migration 041 not run yet) → behave as "no key".
  if (error || !data?.google_places_api_key) return null
  try {
    return decrypt(data.google_places_api_key)
  } catch {
    console.error(`[calling] Google Places key for account ${accountId} could not be decrypted — check ENCRYPTION_KEY.`)
    return null
  }
}

/**
 * Pick the lead provider for this account: the Google Places key from
 * Settings, else GOOGLE_PLACES_API_KEY on the server, else AI web
 * search with the account's OpenRouter key. Server-only.
 */
export async function getLeadSource(db: SupabaseClient, accountId: string): Promise<LeadSource> {
  const placesKey = (await loadPlacesKey(db, accountId)) ?? process.env.GOOGLE_PLACES_API_KEY
  if (placesKey) return googlePlacesSource(placesKey)

  const ai = await loadAiConfig(db, accountId, { requireActive: false })
  if (ai) return aiWebSource(ai)
  throw new LeadSourceError(
    'Lead search isn’t set up yet. Add a Google Places API key in Settings → Lead search.',
    400,
  )
}
