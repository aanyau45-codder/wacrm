'use client'

import { useState } from 'react'
import { Loader2, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCan } from '@/hooks/use-can'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { CallsHeader } from '@/components/calling/calls-nav'
import { useCallSettings } from '@/components/calling/use-call-settings'
import { DEFAULT_OUTCOMES, TEMPERATURE_META } from '@/lib/calling/defaults'
import { OUTCOME_ACTIONS, TEMPERATURES, type CallSettings, type OutcomeConfig, type OutcomeAction, type Temperature } from '@/lib/calling/types'
import { cn } from '@/lib/utils'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const selectClass = 'h-9 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30'

function slug(label: string, taken: string[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'outcome'
  let key = base
  for (let i = 2; taken.includes(key); i++) key = `${base}_${i}`
  return key
}

export default function CallSettingsPage() {
  const { accountId } = useAuth()
  const canEdit = useCan('send-messages')
  const { settings, loading } = useCallSettings()
  // null until the first edit, so it follows the loaded settings.
  const [edited, setDraft] = useState<CallSettings | null>(null)
  const draft = edited ?? settings
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof CallSettings>(k: K, v: CallSettings[K]) => setDraft({ ...draft, [k]: v })
  const setOutcome = (i: number, patch: Partial<OutcomeConfig>) =>
    set('outcomes', draft.outcomes.map((o, j) => (j === i ? { ...o, ...patch } : o)))

  async function save() {
    if (!accountId) return
    if (!draft.call_days.length) return toast.error('Pick at least one calling day')
    if (draft.end_time <= draft.start_time) return toast.error('End time must be after start time')
    if (draft.outcomes.some((o) => !o.label.trim())) return toast.error('Every outcome needs a name')
    setSaving(true)
    const { error } = await createClient()
      .from('call_settings')
      .upsert({ account_id: accountId, ...draft }, { onConflict: 'account_id' })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Calling settings saved')
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <CallsHeader title="Calling settings" />
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <CallsHeader title="Calling settings" description="When you call, how many, and what happens after each outcome." />

      <fieldset disabled={!canEdit} className="space-y-5">
        <section className="space-y-4 rounded-[22px] border border-border bg-card p-4 sm:p-6">
          <h2 className="font-semibold">Schedule</h2>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Calling days</p>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((d, i) => {
                const n = i + 1
                const on = draft.call_days.includes(n)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set('call_days', on ? draft.call_days.filter((x) => x !== n) : [...draft.call_days, n].sort())}
                    className={cn('h-10 rounded-xl text-xs font-semibold', on ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">From</span>
              <Input type="time" value={draft.start_time} onChange={(e) => set('start_time', e.target.value)} className="h-10" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">To</span>
              <Input type="time" value={draft.end_time} onChange={(e) => set('end_time', e.target.value)} className="h-10" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Calls per day</span>
              <Input type="number" min={1} value={draft.daily_target} onChange={(e) => set('daily_target', Math.max(1, Number(e.target.value) || 1))} className="h-10" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Calls per week</span>
              <Input type="number" min={1} value={draft.weekly_target} onChange={(e) => set('weekly_target', Math.max(1, Number(e.target.value) || 1))} className="h-10" />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            New leads are spread over calling days, at most {Math.min(draft.daily_target, Math.ceil(draft.weekly_target / Math.max(1, draft.call_days.length)))} a day, highest priority first. Kampala time.
          </p>
        </section>

        <section className="space-y-4 rounded-[22px] border border-border bg-card p-4 sm:p-6">
          <h2 className="font-semibold">Unanswered calls</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Park after N misses</span>
              <Input type="number" min={1} value={draft.failed_attempt_limit} onChange={(e) => set('failed_attempt_limit', Math.max(1, Number(e.target.value) || 1))} className="h-10" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Park for (days)</span>
              <Input type="number" min={1} value={draft.park_days} onChange={(e) => set('park_days', Math.max(1, Number(e.target.value) || 1))} className="h-10" />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            After {draft.failed_attempt_limit} unanswered calls in a row the lead is marked Cold and comes back in {draft.park_days} days.
          </p>
        </section>

        <section className="space-y-3 rounded-[22px] border border-border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Outcomes</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => set('outcomes', DEFAULT_OUTCOMES)}>
              <RotateCcw /> Defaults
            </Button>
          </div>
          <ul className="space-y-2">
            {draft.outcomes.map((o, i) => (
              <li key={o.key} className="space-y-2 rounded-2xl bg-muted/50 p-3">
                <div className="flex gap-2">
                  <Input value={o.label} onChange={(e) => setOutcome(i, { label: e.target.value })} className="h-9 flex-1 bg-card" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove outcome"
                    onClick={() => set('outcomes', draft.outcomes.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <select
                    value={o.action}
                    onChange={(e) => setOutcome(i, { action: e.target.value as OutcomeAction })}
                    className={selectClass}
                  >
                    {OUTCOME_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                  {o.action === 'retry' || o.action === 'pick_date' || o.action === 'meeting' ? (
                    <label className="flex items-center gap-1">
                      N =
                      <Input
                        type="number"
                        min={1}
                        value={o.days}
                        onChange={(e) => setOutcome(i, { days: Math.max(1, Number(e.target.value) || 1) })}
                        className="h-9 w-16 bg-card"
                      />
                      days
                    </label>
                  ) : null}
                  <select
                    value={o.temperature ?? ''}
                    onChange={(e) => setOutcome(i, { temperature: (e.target.value || null) as Temperature | null })}
                    className={selectClass}
                  >
                    <option value="">Keep temperature</option>
                    {TEMPERATURES.map((t) => (
                      <option key={t} value={t}>→ {TEMPERATURE_META[t].label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <Switch checked={o.failed} onCheckedChange={(v) => setOutcome(i, { failed: v })} />
                    Counts as unanswered
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch checked={o.pickup} onCheckedChange={(v) => setOutcome(i, { pickup: v })} />
                    Someone picked up
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              set('outcomes', [
                ...draft.outcomes,
                {
                  key: slug('New outcome', draft.outcomes.map((o) => o.key)),
                  label: 'New outcome',
                  action: 'retry',
                  days: 2,
                  temperature: null,
                  failed: false,
                  pickup: true,
                },
              ])
            }
          >
            <Plus /> Add outcome
          </Button>
        </section>

        <section className="space-y-3 rounded-[22px] border border-border bg-card p-4 sm:p-6">
          <h2 className="font-semibold">Extra tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {draft.extra_tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                {t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => set('extra_tags', draft.extra_tags.filter((x) => x !== t))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const t = newTag.trim()
              if (t && !draft.extra_tags.includes(t)) set('extra_tags', [...draft.extra_tags, t])
              setNewTag('')
            }}
          >
            <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="New tag" className="h-10" />
            <Button type="submit" variant="outline" className="h-10">Add</Button>
          </form>
        </section>
      </fieldset>

      {canEdit ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur md:left-auto md:right-6 md:bottom-6 md:rounded-2xl md:border">
          <Button className="h-11 w-full md:w-48" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Save settings
          </Button>
        </div>
      ) : null}
    </div>
  )
}
