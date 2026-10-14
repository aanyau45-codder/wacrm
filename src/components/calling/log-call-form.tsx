'use client'

import { useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TEMPERATURE_META } from '@/lib/calling/defaults'
import { formatDay, kampalaToday } from '@/lib/calling/dates'
import { applyCall, suggestForOutcome } from '@/lib/calling/schedule'
import { TEMPERATURES, type CallLead, type CallLog, type CallSettings, type Temperature } from '@/lib/calling/types'
import { cn } from '@/lib/utils'

interface Props {
  lead: CallLead
  settings: CallSettings
  onSaved: (lead: CallLead, log: CallLog, next: boolean) => void
}

function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-9 rounded-full border px-3 py-1.5 text-left text-[13px] font-medium transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:bg-muted',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * Log a call in a few taps: outcome → (temperature + next date are
 * pre-filled by the rules) → Save. Everything else is optional.
 */
export function LogCallForm({ lead, settings, onSaved }: Props) {
  const today = kampalaToday()
  const [outcomeKey, setOutcomeKey] = useState<string | null>(null)
  const [temperature, setTemperature] = useState<Temperature | null>(lead.temperature)
  const [nextDate, setNextDate] = useState<string>('')
  const [tags, setTags] = useState<string[]>([])
  const [tagOptions, setTagOptions] = useState<string[]>(settings.extra_tags)
  const [newTag, setNewTag] = useState('')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

  const outcome = settings.outcomes.find((o) => o.key === outcomeKey) ?? null

  function pickOutcome(key: string) {
    const o = settings.outcomes.find((x) => x.key === key)
    if (!o) return
    setOutcomeKey(key)
    const s = suggestForOutcome(lead, o, settings, today)
    // Keep DNC if already chosen; otherwise take the rule's suggestion.
    setTemperature((t) => (t === 'dnc' ? t : s.temperature))
    setNextDate(s.nextCallDate ?? '')
  }

  // What will actually be saved (same function the server runs).
  const preview = useMemo(() => {
    if (!outcome || !temperature) return null
    return applyCall(lead, { outcome, temperature, nextCallDate: nextDate || null }, settings, today)
  }, [lead, outcome, temperature, nextDate, settings, today])

  const suggestion = outcome ? suggestForOutcome(lead, outcome, settings, today) : null
  const parked = suggestion?.parked ?? false
  const leavesQueue = preview ? preview.next_call_date === null : false

  function addTag() {
    const t = newTag.trim()
    if (!t) return
    if (!tagOptions.includes(t)) setTagOptions((o) => [...o, t])
    if (!tags.includes(t)) setTags((x) => [...x, t])
    setNewTag('')
  }

  async function save(next: boolean) {
    if (!outcome) return toast.error('Pick an outcome')
    if (!temperature) return toast.error('Pick a temperature')
    setSaving(true)
    try {
      const res = await fetch(`/api/calling/leads/${lead.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: outcome.key,
          temperature,
          next_call_date: leavesQueue ? null : nextDate || null,
          tags,
          remarks: remarks.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not save the call')
      const when = data.lead.next_call_date ? `next call ${formatDay(data.lead.next_call_date, today)}` : 'removed from the queue'
      toast.success(`Logged — ${when}`)
      onSaved(data.lead, data.log, next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the call')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Outcome</h3>
        <div className="flex flex-wrap gap-1.5">
          {settings.outcomes.map((o) => (
            <Chip key={o.key} active={outcomeKey === o.key} onClick={() => pickOutcome(o.key)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Temperature <span className="text-destructive">*</span>
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {TEMPERATURES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTemperature(t)}
              className={cn(
                'h-11 rounded-2xl text-[13px] font-semibold transition-all',
                temperature === t
                  ? cn(TEMPERATURE_META[t].className, 'ring-2 ring-foreground/80')
                  : 'border border-border bg-card text-foreground hover:bg-muted/50',
              )}
            >
              {TEMPERATURE_META[t].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Next call</h3>
        {outcome && leavesQueue ? (
          <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            {preview?.do_not_call
              ? 'Do not call — never scheduled again and kept out of future searches.'
              : preview?.phone_invalid
                ? 'Number marked invalid — removed from the queue.'
                : 'Leaves the call queue (record kept).'}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={nextDate}
              min={today}
              onChange={(e) => setNextDate(e.target.value)}
              className="h-11 max-w-[11rem] rounded-[14px] bg-card"
            />
            <span className="text-sm text-muted-foreground">
              {nextDate ? formatDay(nextDate, today) : outcome ? '' : 'Pick an outcome first'}
              {nextDate && nextDate === suggestion?.nextCallDate ? <span className="ml-1.5 text-xs text-violet-600 dark:text-violet-300">suggested</span> : null}
            </span>
          </div>
        )}
        {parked && !leavesQueue ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {settings.failed_attempt_limit} unanswered calls — marked Cold and parked for {settings.park_days} days.
          </p>
        ) : null}
        {outcome?.action === 'meeting' && !leavesQueue ? (
          <p className="mt-1.5 text-xs text-muted-foreground">Set this to the meeting date.</p>
        ) : null}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tags</h3>
        <div className="flex flex-wrap gap-1.5">
          {tagOptions.map((t) => (
            <Chip
              key={t}
              active={tags.includes(t)}
              onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
              className="min-h-8 py-1 text-xs"
            >
              {t}
            </Chip>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addTag()
            }}
            className="flex items-center gap-1"
          >
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="New tag"
              className="h-8 w-28 rounded-full text-xs"
            />
            <Button type="submit" size="icon-sm" variant="ghost" aria-label="Add tag">
              <Plus />
            </Button>
          </form>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Remarks</h3>
        <Textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="What did they say?"
          rows={2}
          className="rounded-[14px] bg-card"
        />
      </section>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-popover px-4 py-3">
        <Button variant="outline" className="h-12 flex-1 rounded-2xl" disabled={saving || !outcome} onClick={() => save(false)}>
          Save
        </Button>
        <Button className="h-12 flex-[2] rounded-2xl bg-foreground text-background hover:bg-foreground/90" disabled={saving || !outcome} onClick={() => save(true)}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Save & next →
        </Button>
      </div>
    </div>
  )
}
