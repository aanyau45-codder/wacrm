import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { kampalaToday } from '@/lib/calling/dates'
import { dealStatusForCall } from '@/lib/calling/pipeline'
import { applyCall } from '@/lib/calling/schedule'
import { loadCallSettings, str } from '@/lib/calling/server'
import { TEMPERATURES, type CallLead, type Temperature } from '@/lib/calling/types'
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe'
import type { SupabaseClient } from '@supabase/supabase-js'

// Log one call: insert a call_logs row, then update the lead's
// denormalised state (temperature, last outcome, attempts, next date)
// using the same rules the form previewed. A linked deal follows the
// call (won / lost / reopened); a Hot call can add the lead to the
// pipeline when I tick "Add to pipeline" in the form.

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
  const addStageId = str(body?.pipeline?.stage_id, 64)
  const rawValue = Number(body?.pipeline?.value)
  const dealValue = Number.isFinite(rawValue) && rawValue > 0 ? Math.min(Math.round(rawValue * 100) / 100, 9_999_999_999) : 0
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

    // Pipeline: create the deal (Hot + ticked) or move the linked one.
    let dealId = lead.deal_id
    let contactId = lead.contact_id
    let dealWarning: string | null = null
    try {
      if (!dealId && addStageId && update.temperature === 'hot') {
        const made = await createDeal(db, accountId, userId, lead, addStageId, dealValue, remarks)
        dealId = made.dealId
        contactId = made.contactId
      } else if (dealId) {
        const { data: deal } = await db.from('deals').select('id, status').eq('id', dealId).eq('account_id', accountId).maybeSingle()
        const status = deal ? dealStatusForCall(update.temperature as Temperature, deal.status) : null
        if (deal && status) {
          const { error } = await db.from('deals').update({ status }).eq('id', deal.id).eq('account_id', accountId)
          if (error) throw error
        }
      }
    } catch (err) {
      // The call itself is logged; only the pipeline step failed.
      console.error('[calls] pipeline sync failed:', err)
      dealWarning = err instanceof Error ? err.message : 'Could not update the pipeline'
    }

    const { data: updated, error: updateError } = await db
      .from('call_leads')
      .update({
        ...update,
        // Only when changed, so logging still works before migration 042.
        ...(dealId !== lead.deal_id ? { deal_id: dealId } : {}),
        ...(contactId !== lead.contact_id ? { contact_id: contactId } : {}),
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

    return NextResponse.json({ lead: updated, log, deal_warning: dealWarning })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/** Find or create the lead's contact, then open a deal for it in `stageId`. */
async function createDeal(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  lead: CallLead,
  stageId: string,
  value: number,
  remarks: string | null,
): Promise<{ dealId: string; contactId: string | null }> {
  const { data: stage, error: stageError } = await db
    .from('pipeline_stages')
    .select('id, pipeline_id, pipeline:pipelines!inner(account_id)')
    .eq('id', stageId)
    .eq('pipeline.account_id', accountId)
    .maybeSingle()
  if (stageError) throw stageError
  if (!stage) throw new Error('That pipeline stage no longer exists')

  let contactId = lead.contact_id
  if (!contactId && lead.phone) {
    const existing = await findExistingContact(db, accountId, lead.phone)
    if (existing) {
      contactId = existing.id
    } else {
      const { data: contact, error } = await db
        .from('contacts')
        .insert({
          account_id: accountId,
          user_id: userId,
          phone: lead.phone,
          name: lead.contact_person || lead.business_name,
          company: lead.business_name,
          email: lead.email,
        })
        .select('id')
        .single()
      if (error && !isUniqueViolation(error)) throw error
      contactId = contact?.id ?? (await findExistingContact(db, accountId, lead.phone))?.id ?? null
    }
  }

  const { data: account } = await db.from('accounts').select('default_currency').eq('id', accountId).maybeSingle()
  const { data: deal, error } = await db
    .from('deals')
    .insert({
      account_id: accountId,
      user_id: userId,
      pipeline_id: stage.pipeline_id,
      stage_id: stage.id,
      contact_id: contactId,
      title: lead.business_name,
      value,
      currency: account?.default_currency ?? 'USD',
      notes: [lead.lead_note, remarks].filter(Boolean).join(' · ') || null,
      status: 'open',
    })
    .select('id')
    .single()
  if (error) throw error
  return { dealId: deal.id as string, contactId }
}
