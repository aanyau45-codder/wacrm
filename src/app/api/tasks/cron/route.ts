import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { kampalaStartOfDay, kampalaToday, addDays } from '@/lib/calling/dates'
import { pushConfigured, sendPushToUser } from '@/lib/tasks/push'
import { formatDue, isSummaryDue, summaryBody } from '@/lib/tasks/tasks'

/**
 * Sends due task reminders and the morning summary. Hit every minute
 * by pg_cron in Supabase with the `x-cron-secret` header matching
 * TASKS_CRON_SECRET.
 *
 * Each reminder is claimed (reminded_at set) before sending, so
 * overlapping runs never send twice. Reminders more than 6 hours late
 * (scheduler was down) are skipped rather than sent stale.
 */
export async function GET(request: Request) {
  const expected = process.env.TASKS_CRON_SECRET
  if (!expected) return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  const supplied = Buffer.from(request.headers.get('x-cron-secret') ?? '')
  const expectedBuf = Buffer.from(expected)
  if (supplied.length !== expectedBuf.length || !timingSafeEqual(supplied, expectedBuf)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!pushConfigured()) return NextResponse.json({ error: 'push keys not configured' }, { status: 503 })

  const admin = supabaseAdmin()
  const now = new Date()
  const nowIso = now.toISOString()

  // 1. Task reminders ------------------------------------------
  const { data: due, error } = await admin
    .from('tasks')
    .select('id, user_id, title, notes, due_at, lead_id')
    .is('done_at', null)
    .is('reminded_at', null)
    .lte('remind_at', nowIso)
    .gte('remind_at', new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString())
    .order('remind_at')
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let reminders = 0
  for (const task of due ?? []) {
    const { data: claim } = await admin
      .from('tasks')
      .update({ reminded_at: nowIso })
      .eq('id', task.id)
      .is('reminded_at', null)
      .select('id')
      .maybeSingle()
    if (!claim) continue
    const when = formatDue(task.due_at as string, now)
    reminders += await sendPushToUser(admin, task.user_id as string, {
      title: task.title as string,
      body: [`Due ${when}`, task.notes].filter(Boolean).join(' · '),
      url: `/tasks?task=${task.id}`,
      tag: `task-${task.id}`,
      taskId: task.id as string,
    })
  }

  // 2. Morning summary ------------------------------------------
  const { data: settings, error: sErr } = await admin
    .from('reminder_settings')
    .select('user_id, account_id, morning_summary, summary_time, last_summary_on')
    .eq('morning_summary', true)
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  let summaries = 0
  const today = kampalaToday(now)
  for (const s of settings ?? []) {
    if (!isSummaryDue(s as { morning_summary: boolean; summary_time: string; last_summary_on: string | null }, now)) continue
    const { data: claim } = await admin
      .from('reminder_settings')
      .update({ last_summary_on: today })
      .eq('user_id', s.user_id)
      .or(`last_summary_on.is.null,last_summary_on.lt.${today}`)
      .select('user_id')
      .maybeSingle()
    if (!claim) continue

    const userId = s.user_id as string
    const accountId = s.account_id as string
    const endOfToday = kampalaStartOfDay(addDays(today, 1))
    const [open, list, follow] = await Promise.all([
      admin
        .from('tasks')
        .select('title, due_at')
        .eq('account_id', accountId)
        .eq('user_id', userId)
        .is('done_at', null)
        .lt('due_at', endOfToday)
        .order('due_at')
        .limit(200),
      // On this week's call list (never called, dated) …
      admin
        .from('call_leads')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('attempts', 0)
        .eq('do_not_call', false)
        .not('next_call_date', 'is', null),
      // … plus follow-ups due today or earlier.
      admin
        .from('call_leads')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .gt('attempts', 0)
        .eq('do_not_call', false)
        .lte('next_call_date', today),
    ])
    const tasks = open.data ?? []
    const startOfToday = kampalaStartOfDay(today)
    const todays = tasks.filter((t) => (t.due_at as string) >= startOfToday)
    const followUps = follow.count ?? 0
    summaries += await sendPushToUser(admin, userId, {
      title: 'Good morning — your day',
      body: summaryBody({
        today: todays.length,
        overdue: tasks.length - todays.length,
        calls: (list.count ?? 0) + followUps,
        followUps,
        first: todays.slice(0, 3).map((t) => `${formatDue(t.due_at as string, now)} ${t.title}`),
      }),
      url: '/tasks',
      tag: 'morning-summary',
    })
  }

  return NextResponse.json({ reminders, summaries })
}
