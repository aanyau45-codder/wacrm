import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'
import { encrypt } from '@/lib/whatsapp/encryption'
import {
  exchangeEmbeddedSignupCode,
  findGrantedWabaId,
  listWabaPhoneNumbers,
  requestSmbAppDataSync,
  subscribeWabaToApp,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api'
import { COEXISTENCE_FINISH_EVENT } from '@/lib/whatsapp/coexistence'

/**
 * WhatsApp Business app coexistence onboarding (Embedded Signup).
 *
 * GET  — whether the "Connect WhatsApp Business app" button can be shown
 *        (needs META_APP_ID, META_APP_SECRET and META_ES_CONFIG_ID), plus
 *        the public app id + configuration id the browser SDK needs.
 * POST — finish onboarding: exchange the code for a token, subscribe the
 *        WABA to our webhook, save the config, and request the one-time
 *        contacts + chat-history sync. The number is NOT /register-ed —
 *        it is already registered through the Business app.
 */

function signupEnv() {
  const appId = process.env.META_APP_ID?.trim()
  const appSecret = process.env.META_APP_SECRET?.trim()
  const configId = process.env.META_ES_CONFIG_ID?.trim()
  return { appId, appSecret, configId, enabled: !!(appId && appSecret && configId) }
}

export async function GET() {
  try {
    await getCurrentAccount()
    const { appId, configId, enabled } = signupEnv()
    return NextResponse.json(enabled ? { enabled, appId, configId } : { enabled: false })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireRole('admin')
  } catch (err) {
    return toErrorResponse(err)
  }

  const { appId, appSecret, enabled } = signupEnv()
  if (!enabled || !appId || !appSecret) {
    return NextResponse.json({ error: 'WhatsApp Business app connection is not set up on the server.' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as {
    code?: unknown
    event?: unknown
    phone_number_id?: unknown
    waba_id?: unknown
    business_id?: unknown
  } | null
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const code = str(body?.code)
  if (!code) return NextResponse.json({ error: 'Missing signup code' }, { status: 400 })
  const event = str(body?.event)
  if (event && event !== COEXISTENCE_FINISH_EVENT) {
    return NextResponse.json(
      {
        error:
          'That signup connected a new number rather than your WhatsApp Business app. Use the manual setup below for new numbers.',
      },
      { status: 400 },
    )
  }

  // 1. Code → business token. The code lives ~30 seconds.
  let accessToken: string
  try {
    accessToken = await exchangeEmbeddedSignupCode({ code, appId, appSecret })
  } catch (err) {
    return NextResponse.json({ error: `Meta: ${(err as Error).message}` }, { status: 400 })
  }

  // 2. Which WABA / number. Normally from the session event; fall back to
  //    asking Meta what the token was granted for.
  let wabaId = str(body?.waba_id)
  let phoneNumberId = str(body?.phone_number_id)
  try {
    if (!wabaId) wabaId = await findGrantedWabaId({ accessToken, appId, appSecret })
    if (!wabaId) {
      return NextResponse.json({ error: 'Meta did not return a WhatsApp Business account. Please try again.' }, { status: 400 })
    }
    if (!phoneNumberId) phoneNumberId = (await listWabaPhoneNumbers({ wabaId, accessToken }))[0]?.id ?? null
    if (!phoneNumberId) {
      return NextResponse.json({ error: 'No phone number found on that WhatsApp Business account.' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: `Meta: ${(err as Error).message}` }, { status: 400 })
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // 3. One number, one account (see the manual config route, issue #136).
  const { data: claimed } = await admin
    .from('whatsapp_config')
    .select('account_id')
    .eq('phone_number_id', phoneNumberId)
    .neq('account_id', ctx.accountId)
    .maybeSingle()
  if (claimed) {
    return NextResponse.json(
      { error: 'This WhatsApp number is already connected to another Argon CRM account.' },
      { status: 409 },
    )
  }

  let phoneInfo
  try {
    phoneInfo = await verifyPhoneNumber({ phoneNumberId, accessToken })
  } catch (err) {
    return NextResponse.json({ error: `Meta: ${(err as Error).message}` }, { status: 400 })
  }

  // 4. Route this WABA's webhooks (messages, echoes, history) to us.
  let subscribedAppsAt: string | null = null
  try {
    await subscribeWabaToApp({ wabaId, accessToken })
    subscribedAppsAt = new Date().toISOString()
  } catch (err) {
    console.warn('[embedded-signup] subscribed_apps failed:', (err as Error).message)
  }

  // 5. Save. Columns from migration 044 are dropped if it hasn't run yet.
  const now = new Date().toISOString()
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('whatsapp_config')
    .select('id')
    .eq('account_id', ctx.accountId)
    .maybeSingle()
  const base = {
    phone_number_id: phoneNumberId,
    waba_id: wabaId,
    access_token: encrypt(accessToken),
    status: 'connected',
    connected_at: now,
    // Registered through the Business app — no /register call.
    registered_at: now,
    subscribed_apps_at: subscribedAppsAt,
    last_registration_error: null,
    updated_at: now,
  }
  const coex = {
    connection_type: 'coexistence',
    meta_business_id: str(body?.business_id),
    last_sync_error: null,
    history_sync_progress: null,
  }
  const save = (row: Record<string, unknown>) =>
    existing
      ? supabase.from('whatsapp_config').update(row).eq('account_id', ctx.accountId)
      : supabase.from('whatsapp_config').insert({ account_id: ctx.accountId, user_id: ctx.userId, ...row })
  let { error: saveError } = await save({ ...base, ...coex })
  const migrationMissing = !!saveError && /connection_type|meta_business_id|sync/.test(saveError.message)
  if (migrationMissing) ({ error: saveError } = await save(base))
  if (saveError) {
    console.error('[embedded-signup] save failed:', saveError)
    return NextResponse.json({ error: 'Connected with Meta but could not save. Please try again.' }, { status: 500 })
  }

  // 6. One-time sync of the phone's contacts, then chat history. Must
  //    happen within 24h of onboarding; Meta delivers via the webhook.
  const syncErrors: string[] = []
  const syncStamps: Record<string, string> = {}
  for (const [syncType, column] of [
    ['smb_app_state_sync', 'contacts_sync_requested_at'],
    ['history', 'history_sync_requested_at'],
  ] as const) {
    try {
      await requestSmbAppDataSync({ phoneNumberId, accessToken, syncType })
      syncStamps[column] = new Date().toISOString()
    } catch (err) {
      syncErrors.push(`${syncType === 'history' ? 'Chat history' : 'Contacts'}: ${(err as Error).message}`)
    }
  }
  if (!migrationMissing) {
    await supabase
      .from('whatsapp_config')
      .update({ ...syncStamps, last_sync_error: syncErrors.join(' · ') || null })
      .eq('account_id', ctx.accountId)
  }

  return NextResponse.json({
    success: true,
    phone_info: phoneInfo,
    subscribed: subscribedAppsAt != null,
    sync_errors: syncErrors,
    migration_missing: migrationMissing,
  })
}
