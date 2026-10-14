import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { kampalaToday } from '@/lib/calling/dates'
import { applyCall } from '@/lib/calling/schedule'
import { loadCallSettings, str } from '@/lib/calling/server'
import { TEMPERATURES, type CallLead, type Temperature } from '@/lib/calling/types'

// Log one call: insert a call_logs row, then update the lead's
// denormalised state (temperature, last outcome, attempts, next date)
// using the same rules the form previewed.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id } = await params
  const body = await request.json().catch(() => null)
  const outcomeKey = str(body?.outcome, 60)
  const temperature = body?.temperature as Temperature
  const nextCallDate = typeof body?.next_call_date === 'string' && DATE_RE.test(body.next_call_date) ? body.next_call_date : null
  const remarks = str(body?.remarks, 2000)
  const tags: string[] = Array.isArray(body?.tags)
    ? body.tags.map((t: unknown) => str(t, 40)).filter(Boolean).slice(0, 20)
    : []

  if (!outcomeKey) return NextResponse.json({ error: 'Pick an outcome' }, { status: 400 })
  if (!TEMPERATURES.includes(temperature)) {
    return NextResponse.json({ error: 'Pick a temperature' }, { status: 400 })
  }

  try {
    const { supabase: db, accountId, userId } = ctx
    const [settings, leadRes] = await Promise.all([
      loadCallSettings(db, accountId),
      db.from('call_leads').select('*').eq('id', id).eq('account_id', accountId).maybeSingle(),
    ])
    if (leadRes.error) throw leadRes.error
    const lead = leadRes.data as CallLead | null
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const outcome = settings.outcomes.find((o) => o.key === outcomeKey)
    if (!outcome) return NextResponse.json({ error: 'Unknown outcome' }, { status: 400 })

    const today = kampalaToday()
    const update = applyCall(lead, { outcome, temperature, nextCallDate }, settings, today)
    const calledAt = new Date().toISOString()

    const { data: log, error: logError } = await db
      .from('call_logs')
      .insert({
        account_id: accountId,
        lead_id: lead.id,
        user_id: userId,
        called_at: calledAt,
        outcome: outcome.key,
        tags,
        remarks,
        temperature_after: update.temperature,
        next_call_date: update.next_call_date,
      })
      .select()
      .single()
    if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

    const { data: updated, error: updateError } = await db
      .from('call_leads')
      .update({
        ...update,
        last_remark: remarks ?? lead.last_remark,
        last_called_at: calledAt,
        tags: Array.from(new Set([...(lead.tags ?? []), ...tags])),
      })
      .eq('id', lead.id)
      .eq('account_id', accountId)
      .select()
      .single()
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // New tags typed in the form join the account's tag list.
    const newTags = tags.filter((t) => !settings.extra_tags.includes(t))
    if (newTags.length) {
      await db
        .from('call_settings')
        .upsert(
          { account_id: accountId, outcomes: settings.outcomes, extra_tags: [...settings.extra_tags, ...newTags] },
          { onConflict: 'account_id' },
        )
    }

    return NextResponse.json({ lead: updated, log })
  } catch (err) {
    return toErrorResponse(err)
  }
}
