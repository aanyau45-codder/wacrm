import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { kampalaToday } from '@/lib/calling/dates'
import { loadCallSettings } from '@/lib/calling/server'
import { isNewLead, isOnList, planRefresh, type ListLead } from '@/lib/calling/weekly-list'

// "Refresh list": top this week's list of new leads up to the weekly
// goal from the pool (see weekly-list.ts). "empty" sends every new
// lead on the list back to the pool. Follow-ups are never touched.

const PAGE = 1000
const CHUNK = 200

async function loadNewLeads(db: SupabaseClient, accountId: string): Promise<ListLead[]> {
  const out: ListLead[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('call_leads')
      .select('id, priority, created_at, next_call_date, attempts, do_not_call, phone_invalid, temperature')
      .eq('account_id', accountId)
      .eq('attempts', 0)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as ListLead[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

async function setDate(db: SupabaseClient, accountId: string, ids: string[], date: string | null) {
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await db
      .from('call_leads')
      .update({ next_call_date: date })
      .eq('account_id', accountId)
      .eq('attempts', 0)
      .in('id', ids.slice(i, i + CHUNK))
    if (error) throw error
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
  const action = body?.action === 'empty' ? 'empty' : 'refresh'

  try {
    const { supabase: db, accountId } = ctx
    const leads = await loadNewLeads(db, accountId)

    if (action === 'empty') {
      const ids = leads.filter(isOnList).map((l) => l.id)
      await setDate(db, accountId, ids, null)
      return NextResponse.json({ added: 0, returned: ids.length, listSize: 0, poolLeft: leads.filter(isNewLead).length })
    }

    const settings = await loadCallSettings(db, accountId)
    const today = kampalaToday()
    const plan = planRefresh(leads, settings.weekly_target, today)
    const onListBefore = leads.filter(isOnList).length
    await setDate(db, accountId, plan.toPool, null)
    await setDate(db, accountId, plan.toList, today)
    return NextResponse.json({
      added: Math.max(0, plan.listSize - (onListBefore - plan.toPool.length)),
      returned: plan.toPool.length,
      listSize: plan.listSize,
      poolLeft: plan.poolLeft,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
