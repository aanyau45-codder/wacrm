import type { LeadInput } from '../types'
import { LeadSourceError, type LeadSearchParams, type LeadSource } from './types'

// Google Places API (New) — Text Search. Real businesses with listed
// phone numbers, websites and Maps links. Key: GOOGLE_PLACES_API_KEY
// (server env only; never sent to the browser).

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.addressComponents',
  'places.businessStatus',
  'nextPageToken',
].join(',')

interface Place {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  shortFormattedAddress?: string
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  rating?: number
  userRatingCount?: number
  primaryTypeDisplayName?: { text?: string }
  addressComponents?: { longText?: string; types?: string[] }[]
  businessStatus?: string
}

interface SearchResponse {
  places?: Place[]
  nextPageToken?: string
  error?: { message?: string }
}

const SOCIAL_HOSTS: Record<string, RegExp> = {
  facebook: /facebook\.com|fb\.com/i,
  instagram: /instagram\.com/i,
  tiktok: /tiktok\.com/i,
  x: /twitter\.com|x\.com/i,
  linkedin: /linkedin\.com/i,
}

/** Short, human "why this lead" note from the listing's signals. */
export function placeNote(p: Place, industry: string): string {
  const bits: string[] = []
  if (p.primaryTypeDisplayName?.text) bits.push(p.primaryTypeDisplayName.text)
  else bits.push(industry)
  if (p.rating && p.userRatingCount) {
    bits.push(`${p.rating.toFixed(1)}★ from ${p.userRatingCount} reviews`)
    if (p.userRatingCount >= 100) bits.push('busy, established customer base')
  } else {
    bits.push('few online reviews — may want help getting found')
  }
  bits.push(p.websiteUri ? 'has a website' : 'no website listed')
  return bits.join(' · ')
}

function toLead(p: Place, params: LeadSearchParams, location: string): LeadInput | null {
  const name = p.displayName?.text?.trim()
  if (!name) return null
  const locality =
    p.addressComponents?.find((c) => c.types?.includes('locality'))?.longText ??
    p.addressComponents?.find((c) => c.types?.includes('sublocality'))?.longText ??
    location
  const social: Record<string, string> = {}
  let website = p.websiteUri ?? null
  if (website) {
    for (const [k, re] of Object.entries(SOCIAL_HOSTS)) {
      if (re.test(website)) {
        social[k] = website
        website = null
        break
      }
    }
  }
  const ratingBoost = p.userRatingCount ? Math.min(20, Math.round(Math.log10(p.userRatingCount + 1) * 8)) : 0
  return {
    business_name: name,
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
    website,
    social_links: social,
    industry: params.industry,
    town: locality,
    address: p.shortFormattedAddress ?? p.formattedAddress ?? null,
    maps_url: p.googleMapsUri ?? null,
    source: 'google_places',
    lead_note: placeNote(p, params.industry),
    priority: 50 + ratingBoost + (website ? 5 : 0),
  }
}

export function googlePlacesSource(apiKey: string): LeadSource {
  return {
    id: 'google_places',
    label: 'Google Maps listings',
    async search(params) {
      const locations = params.locations.length ? params.locations : ['Kampala']
      const perLocation = Math.ceil(params.count / locations.length)
      const out: LeadInput[] = []
      const seen = new Set<string>()

      for (const location of locations) {
        let pageToken: string | undefined
        let got = 0
        // Up to 3 pages (60 places) per location.
        for (let page = 0; page < 3 && got < perLocation; page++) {
          let res: Response
          try {
            res = await fetch(SEARCH_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': FIELD_MASK,
              },
              body: JSON.stringify({
                textQuery: `${params.industry} in ${location}, Uganda`,
                regionCode: 'UG',
                languageCode: 'en',
                pageSize: 20,
                ...(pageToken ? { pageToken } : {}),
              }),
              signal: AbortSignal.timeout(20_000),
            })
          } catch {
            throw new LeadSourceError('Could not reach Google Places. Try again.')
          }
          const data = (await res.json().catch(() => ({}))) as SearchResponse
          if (!res.ok) {
            throw new LeadSourceError(
              `Google Places error (${res.status})${data.error?.message ? `: ${data.error.message}` : ''}`,
              res.status === 403 || res.status === 401 ? 401 : 502,
            )
          }
          for (const p of data.places ?? []) {
            if (got >= perLocation) break
            if (seen.has(p.id) || p.businessStatus === 'CLOSED_PERMANENTLY') continue
            seen.add(p.id)
            const lead = toLead(p, params, location)
            if (lead) {
              out.push(lead)
              got++
            }
          }
          pageToken = data.nextPageToken
          if (!pageToken) break
        }
      }
      return out.slice(0, params.count)
    },
  }
}
