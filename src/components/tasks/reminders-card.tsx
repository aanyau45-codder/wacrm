'use client'

import { useEffect, useState } from 'react'
import { BellOff, BellRing, Download, Loader2, Sunrise } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { APK_VERSION_KEY, LATEST_APK, NOTIFICATIONS_MIN_APK } from '@/lib/android-app'
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from '@/lib/tasks/push-client'

interface Summary {
  morning_summary: boolean
  summary_time: string
}

function oldApk(): boolean {
  try {
    const v = Number(sessionStorage.getItem(APK_VERSION_KEY))
    return v > 0 && v < NOTIFICATIONS_MIN_APK
  } catch {
    return false
  }
}

/** Turn phone reminders on/off and set the morning summary. */
export function RemindersCard() {
  const { accountId, user } = useAuth()
  const [state, setState] = useState<PushState | 'old-app' | null>(null)
  const [busy, setBusy] = useState<'on' | 'off' | 'test' | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    let cancelled = false
    void getPushState().then((s) => {
      if (cancelled) return
      // Older APKs were built with notifications off; Chrome inside them
      // can't show any, whatever it reports.
      setState(s !== 'on' && oldApk() ? 'old-app' : s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (state !== 'on' || !user) return
    let cancelled = false
    void createClient()
      .from('reminder_settings')
      .select('morning_summary, summary_time')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setSummary({
          morning_summary: data?.morning_summary ?? true,
          summary_time: ((data?.summary_time as string | undefined) ?? '08:00').slice(0, 5),
        })
      })
    return () => {
      cancelled = true
    }
  }, [state, user])

  async function turnOn() {
    setBusy('on')
    try {
      await enablePush()
      setState('on')
      toast.success('Reminders are on for this phone')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not turn reminders on')
      setState(await getPushState())
    } finally {
      setBusy(null)
    }
  }

  async function turnOff() {
    setBusy('off')
    try {
      await disablePush()
      setState('off')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not turn reminders off')
    } finally {
      setBusy(null)
    }
  }

  async function test() {
    setBusy('test')
    try {
      await sendTestPush()
      toast.success('Sent — check your notifications')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send a test')
    } finally {
      setBusy(null)
    }
  }

  async function saveSummary(next: Summary) {
    if (!user || !accountId) return
    setSummary(next)
    const { error } = await createClient()
      .from('reminder_settings')
      .upsert({ user_id: user.id, account_id: accountId, ...next }, { onConflict: 'user_id' })
    if (error) toast.error(error.message)
  }

  if (state === null) return null

  if (state === 'on') {
    return (
      <div className="space-y-3 rounded-[24px] border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pastel-mint text-pastel-mint-fg">
            <BellRing className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Reminders on this phone</p>
            <p className="text-xs text-muted-foreground">Each task reminds you at the time you pick.</p>
          </div>
        </div>
        {summary ? (
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
            <Sunrise className="h-4 w-4 shrink-0 text-muted-foreground" />
            <label htmlFor="morning-summary" className="min-w-0 flex-1 text-sm">
              Morning summary
            </label>
            <Input
              type="time"
              value={summary.summary_time}
              onChange={(e) => e.target.value && void saveSummary({ ...summary, summary_time: e.target.value })}
              disabled={!summary.morning_summary}
              aria-label="Summary time"
              className="h-9 w-[6.5rem] rounded-xl bg-card text-sm disabled:opacity-50"
            />
            <Switch
              id="morning-summary"
              checked={summary.morning_summary}
              onCheckedChange={(v) => void saveSummary({ ...summary, morning_summary: v })}
            />
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={test} disabled={!!busy}>
            {busy === 'test' ? <Loader2 className="animate-spin" /> : null}
            Send a test
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={turnOff} disabled={!!busy}>
            <BellOff /> Turn off
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[24px] bg-pastel-peach p-4 text-pastel-peach-fg">
      <BellRing className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Get reminders on your phone</p>
        <p className="text-xs opacity-80">
          {state === 'old-app'
            ? 'Update the Argon CRM app first — this version can’t show notifications.'
            : state === 'denied'
              ? 'Notifications are blocked. Allow them in your phone’s settings for Argon CRM, then come back.'
              : state === 'unsupported'
                ? 'This browser can’t show reminders. Use the Argon CRM app or Chrome.'
                : 'A notification before each task, plus a summary every morning.'}
        </p>
      </div>
      {state === 'old-app' ? (
        <a
          href={LATEST_APK.url}
          download
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background"
        >
          <Download className="h-4 w-4" /> Update
        </a>
      ) : state === 'off' ? (
        <Button className="h-10 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90" onClick={turnOn} disabled={!!busy}>
          {busy === 'on' ? <Loader2 className="animate-spin" /> : null}
          Turn on
        </Button>
      ) : null}
    </div>
  )
}
