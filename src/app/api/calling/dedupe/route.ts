import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { dedupeLeads } from '@/lib/calling/dedupe'
import { loadExistingRefs } from '@/lib/calling/server'
import type { LeadInput } from '@/lib/calling/types'

// CSV/Excel preview: tag parsed rows new / duplicate / dnc / no_phone
// against the account's leads. Saves nothing.

const MAX_ROWS = 5000

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const body = await request.json().catch(() => null)
  const leads = Array.isArray(body?.leads) ? (body.leads as LeadInput[]).slice(0, MAX_ROWS) : null
  if (!leads) return NextResponse.json({ error: 'leads[] is required' }, { status: 400 })

  try {
    const existing = await loadExistingRefs(ctx.supabase, ctx.accountId)
    return NextResponse.json({ leads: dedupeLeads(leads, existing) })
  } catch (err) {
    return toErrorResponse(err)
  }
}
