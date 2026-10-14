import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveSettings } from './defaults'
import type { ExistingLeadRef } from './dedupe'
import type { CallSettings } from './types'

// Server-side reads shared by the /api/calling routes. All queries go
// through the caller's RLS-scoped client and also filter by account.

const PAGE = 1000

export async function loadCallSettings(db: SupabaseClient, accountId: string): Promise<CallSettings> {
  const { data, error } = await db
    .from('call_settings')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()
  if (error) throw error
  return resolveSettings(data)
}

/** Every lead's dedupe keys (incl. Do Not Call), paged past 1000 rows. */
export async function loadExistingRefs(db: SupabaseClient, accountId: string): Promise<ExistingLeadRef[]> {
  const out: ExistingLeadRef[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('call_leads')
      .select('business_name, town, phone_normalized, do_not_call')
      .eq('account_id', accountId)
      .range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as ExistingLeadRef[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

/** Calls already scheduled per date from `fromDate` on. */
export async function loadScheduledLoad(
  db: SupabaseClient,
  accountId: string,
  fromDate: string,
): Promise<Record<string, number>> {
  const load: Record<string, number> = {}
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('call_leads')
      .select('next_call_date')
      .eq('account_id', accountId)
      .gte('next_call_date', fromDate)
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const row of data ?? []) {
      const d = row.next_call_date as string
      load[d] = (load[d] ?? 0) + 1
    }
    if (!data || data.length < PAGE) break
  }
  return load
}

export function str(v: unknown, max = 500): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const s = String(v).trim().slice(0, max)
  return s || null
}
