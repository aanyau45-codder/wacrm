import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'
import { sendPushToUser } from '@/lib/tasks/push'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { str } from '@/lib/calling/server'

// This phone's reminder notifications.
//   GET    → { publicKey } to subscribe with (null when not set up)
//   POST   { subscription }  → save it (+ default reminder settings)
//   POST   { test: true }    → send a test notification to my phones
//   DELETE { endpoint }      → stop notifications on this phone

export async function GET() {
  try {
    await getCurrentAccount()
  } catch (err) {
    return toErrorResponse(err)
  }
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null })
}

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }
  const body = await request.json().catch(() => null)
  const { supabase: db, userId, accountId } = ctx

  if (body?.test) {
    const sent = await sendPushToUser(supabaseAdmin(), userId, {
      title: 'Reminders are on',
      body: 'This is how task reminders will look.',
      url: '/tasks',
      tag: 'test',
    })
    if (!sent) return NextResponse.json({ error: 'No phone received it — turn reminders on first' }, { status: 409 })
    return NextResponse.json({ sent })
  }

  const sub = body?.subscription
  const endpoint = str(sub?.endpoint, 1000)
  const p256dh = str(sub?.keys?.p256dh, 200)
  const auth = str(sub?.keys?.auth, 200)
  if (!endpoint?.startsWith('https://') || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  try {
    // An endpoint belongs to one browser; if it was saved under another
    // login on this phone, the service-role client moves it to me.
    const { error } = await supabaseAdmin()
      .from('push_subscriptions')
      .upsert(
        {
          endpoint,
          p256dh,
          auth,
          user_id: userId,
          account_id: accountId,
          user_agent: str(request.headers.get('user-agent'), 300),
        },
        { onConflict: 'endpoint' },
      )
    if (error) throw error
    const { error: sErr } = await db
      .from('reminder_settings')
      .upsert({ user_id: userId, account_id: accountId }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (sErr) throw sErr
    return NextResponse.json({ ok: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function DELETE(request: Request) {
  let ctx
  try {
    ctx = await getCurrentAccount()
  } catch (err) {
    return toErrorResponse(err)
  }
  const body = await request.json().catch(() => null)
  const endpoint = str(body?.endpoint, 1000)
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  const { error } = await ctx.supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) return toErrorResponse(error)
  return NextResponse.json({ ok: true })
}
