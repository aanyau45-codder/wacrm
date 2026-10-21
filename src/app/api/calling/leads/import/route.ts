import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { dedupeLeads } from '@/lib/calling/dedupe'
import { scoreLead } from '@/lib/calling/schedule'
import { loadExistingRefs, str } from '@/lib/calling/server'
import type { LeadInput, LeadSourceId } from '@/lib/calling/types'

// Save the leads the user confirmed (from search, CSV/Excel or the add
// form). Dedupes again server-side — only "new" rows are inserted —
// into the pool: "Refresh list" on Calls moves them onto the weekly
// list (weekly-list.ts).

const MAX_ROWS = 5000
const SOURCES: LeadSourceId[] = ['google_places', 'ai_web', 'csv', 'manual']

function sanitize(raw: Record<string, unknown>): LeadInput {
  const social =
    raw.social_links && typeof raw.social_links === 'object'
      ? Object.fromEntries(
          Object.entries(raw.social_links as Record<string, unknown>)
            .map(([k, v]) => [k.slice(0, 20), str(v, 300)])
            .filter(([, v]) => v),
        )
      : {}
  return {
    business_name: str(raw.business_name, 200) ?? '',
    contact_person: str(raw.contact_person, 120),
    phone: str(raw.phone, 60),
    email: str(raw.email, 200),
    website: str(raw.website, 300),
    social_links: social as Record<string, string>,
    industry: str(raw.industry, 120),
    town: str(raw.town, 120),
    address: str(raw.address, 300),
    maps_url: str(raw.maps_url, 500),
    source: SOURCES.includes(raw.source as LeadSourceId) ? (raw.source as LeadSourceId) : 'manual',
    lead_note: str(raw.lead_note, 1000),
    priority: typeof raw.priority === 'number' ? raw.priority : null,
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => str(t, 40)).filter((t): t is string => !!t) : [],
  }
}

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const body = await request.json().catch(() => null)
  if (!Array.isArray(body?.leads) || body.leads.length === 0) {
    return NextResponse.json({ error: 'Pick at least one lead to import' }, { status: 400 })
  }
  const incoming = (body.leads as Record<string, unknown>[]).slice(0, MAX_ROWS).map(sanitize)

  try {
    const { supabase: db, accountId, userId } = ctx
    const existing = await loadExistingRefs(db, accountId)
    const checked = dedupeLeads(incoming, existing)
    const fresh = checked
      .filter((l) => l.status === 'new')
      .map((l) => ({ ...l, priority: scoreLead(l) }))

    const rows = fresh.map((l) => ({
      account_id: accountId,
      user_id: userId,
      business_name: l.business_name,
      contact_person: l.contact_person ?? null,
      phone: l.phone,
      email: l.email ?? null,
      website: l.website ?? null,
      social_links: l.social_links ?? {},
      industry: l.industry ?? null,
      town: l.town ?? null,
      address: l.address ?? null,
      maps_url: l.maps_url ?? null,
      source: l.source,
      lead_note: l.lead_note ?? null,
      priority: l.priority,
      tags: l.tags ?? [],
      next_call_date: null,
    }))

    let imported = 0
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const { error } = await db.from('call_leads').insert(chunk)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      imported += chunk.length
    }

    const skipped = checked.length - fresh.length
    return NextResponse.json({
      imported,
      skipped,
      skippedReasons: checked.filter((l) => l.status !== 'new').map((l) => ({ name: l.business_name, reason: l.reason })),
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
