import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { encrypt } from '@/lib/whatsapp/encryption'
import { loadAiConfig } from '@/lib/ai/config'
import { validateGooglePlacesKey } from '@/lib/calling/lead-sources/google-places'
import { LeadSourceError } from '@/lib/calling/lead-sources/types'

/**
 * GET /api/calling/source-key
 *
 * Which lead source Find leads will use. The key itself is never
 * returned — only whether one is saved.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { data, error } = await supabase
      .from('lead_source_keys')
      .select('google_places_api_key, updated_at')
      .eq('account_id', accountId)
      .maybeSingle()
    if (error) {
      console.error('[calling/source-key GET]', error)
      return NextResponse.json({ error: 'Lead search settings unavailable. Run migration 041.' }, { status: 500 })
    }
    const hasKey = !!data?.google_places_api_key
    const envKey = !!process.env.GOOGLE_PLACES_API_KEY
    let active: 'google_places' | 'ai_web' | 'none' = hasKey || envKey ? 'google_places' : 'none'
    if (active === 'none') {
      const ai = await loadAiConfig(supabase, accountId, { requireActive: false }).catch(() => null)
      if (ai?.provider === 'openrouter') active = 'ai_web'
    }
    return NextResponse.json({
      has_key: hasKey,
      env_key: envKey,
      updated_at: data?.updated_at ?? null,
      active,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/** POST /api/calling/source-key  (admin+) — check the key with Google, then save it encrypted. */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const limit = checkRateLimit(`lead-source-key:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    const key = typeof body?.google_places_api_key === 'string' ? body.google_places_api_key.trim() : ''
    if (!key) return NextResponse.json({ error: 'Enter an API key' }, { status: 400 })
    if (key.length > 200) return NextResponse.json({ error: 'That doesn’t look like an API key' }, { status: 400 })

    try {
      await validateGooglePlacesKey(key)
    } catch (err) {
      if (err instanceof LeadSourceError) return NextResponse.json({ error: err.message }, { status: 400 })
      throw err
    }

    const { error } = await supabase.from('lead_source_keys').upsert(
      {
        account_id: accountId,
        google_places_api_key: encrypt(key),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id' },
    )
    if (error) {
      console.error('[calling/source-key POST]', error)
      return NextResponse.json({ error: 'Failed to save the key' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/** DELETE /api/calling/source-key  (admin+) — forget the saved key. */
export async function DELETE() {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const { error } = await supabase.from('lead_source_keys').delete().eq('account_id', accountId)
    if (error) {
      console.error('[calling/source-key DELETE]', error)
      return NextResponse.json({ error: 'Failed to remove the key' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
