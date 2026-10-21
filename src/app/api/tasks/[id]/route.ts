import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

// Buttons on a reminder notification (public/sw.js):
//   POST { action: 'done' }   → tick the task off
//   POST { action: 'snooze' } → remind again in 15 minutes

const SNOOZE_MINUTES = 15

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id } = await params
  const body = await request.json().catch(() => null)
  const action = body?.action
  if (action !== 'done' && action !== 'snooze') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const now = new Date()
  const update =
    action === 'done'
      ? { done_at: now.toISOString() }
      : { remind_at: new Date(now.getTime() + SNOOZE_MINUTES * 60_000).toISOString(), reminded_at: null }

  const { data, error } = await ctx.supabase
    .from('tasks')
    .update(update)
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .select('id')
    .maybeSingle()
  if (error) return toErrorResponse(error)
  if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
