import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { dedupeLeads } from '@/lib/calling/dedupe'
import { getLeadSource, LeadSourceError, MAX_SEARCH_COUNT } from '@/lib/calling/lead-sources'
import { loadExistingRefs, str } from '@/lib/calling/server'

// AI lead search. Returns a PREVIEW only — nothing is saved until the
// user picks rows and POSTs them to /api/calling/leads/import.

export const maxDuration = 120

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }

  const body = await request.json().catch(() => null)
  const industry = str(body?.industry, 120)
  const locations: string[] = Array.isArray(body?.locations)
    ? body.locations.map((l: unknown) => str(l, 80)).filter(Boolean).slice(0, 10)
    : []
  const count = Math.min(MAX_SEARCH_COUNT, Math.max(1, Number(body?.count) || 20))
  if (!industry) {
    return NextResponse.json({ error: 'Industry is required' }, { status: 400 })
  }

  try {
    const source = await getLeadSource(ctx.supabase, ctx.accountId)
    const [found, existing] = await Promise.all([
      source.search({ industry, locations, count }),
      loadExistingRefs(ctx.supabase, ctx.accountId),
    ])
    return NextResponse.json({
      source: { id: source.id, label: source.label },
      leads: dedupeLeads(found, existing),
    })
  } catch (err) {
    if (err instanceof LeadSourceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return toErrorResponse(err)
  }
}
