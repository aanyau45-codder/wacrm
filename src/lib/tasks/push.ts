import 'server-only'
import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

// Web Push to a user's phones/browsers (the Android app gets them as
// app notifications). Keys live only in server env vars:
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY — generate once with
//   `npx web-push generate-vapid-keys`; changing them drops every
//   existing subscription (each phone must turn reminders on again).

export interface PushPayload {
  title: string
  body: string
  /** Page opened when the notification is tapped. */
  url: string
  /** Same tag replaces an older notification instead of stacking. */
  tag?: string
  /** Task id: adds "Done" and "Snooze 15 min" buttons. */
  taskId?: string
}

let configured = false
export function pushConfigured(): boolean {
  if (configured) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://wacrm-chi-lime.vercel.app'
  webpush.setVapidDetails(site, pub, priv)
  configured = true
  return true
}

/** Sends to every subscription of `userId`; drops ones the browser revoked. Returns how many got it. */
export async function sendPushToUser(admin: SupabaseClient, userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (error) throw error

  let sent = 0
  const body = JSON.stringify(payload)
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          body,
          { TTL: 60 * 60, urgency: 'high' },
        )
        sent++
        await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id)
        } else {
          console.error('[push] send failed:', status, err instanceof Error ? err.message : err)
        }
      }
    }),
  )
  return sent
}
