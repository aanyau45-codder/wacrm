'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { DEFAULT_CALL_SETTINGS, resolveSettings } from '@/lib/calling/defaults'
import type { CallSettings } from '@/lib/calling/types'

/** The account's calling settings (defaults until the row loads). */
export function useCallSettings() {
  const { accountId } = useAuth()
  const [settings, setSettings] = useState<CallSettings>(DEFAULT_CALL_SETTINGS)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!accountId) return
    const { data, error } = await createClient()
      .from('call_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()
    if (error) console.error('[calls] settings failed:', error)
    setSettings(resolveSettings(data))
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    // setState runs after the Supabase await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  return { settings, setSettings, loading, reload }
}
