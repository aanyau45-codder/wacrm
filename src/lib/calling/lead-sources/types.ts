import type { LeadInput, LeadSourceId } from '../types'

// Every lead provider implements this, so Google Places can be swapped
// for another directory/API without touching the search UI or routes.

export interface LeadSearchParams {
  /** e.g. "bakeries", "hardware shops", "private schools" */
  industry: string
  /** Ugandan towns/areas, e.g. ["Kampala", "Ntinda", "Jinja"] */
  locations: string[]
  /** How many leads to return in total (spread across locations). */
  count: number
}

export interface LeadSource {
  id: LeadSourceId
  label: string
  search(params: LeadSearchParams): Promise<LeadInput[]>
}

export class LeadSourceError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message)
    this.name = 'LeadSourceError'
  }
}

export const MAX_SEARCH_COUNT = 60
