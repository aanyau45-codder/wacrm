'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, ChevronRight, Loader2, Search, SlidersHorizontal, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCan } from '@/hooks/use-can'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { CallsHeader } from '@/components/calling/calls-nav'
import { CallPanel, outcomeLabel } from '@/components/calling/call-panel'
import { TemperatureBadge } from '@/components/calling/temperature-badge'
import { useCallSettings } from '@/components/calling/use-call-settings'
import { addDays, formatDay, kampalaStartOfDay, kampalaToday } from '@/lib/calling/dates'
import { formatPhone } from '@/lib/calling/phone'
import { TEMPERATURE_META } from '@/lib/calling/defaults'
import { filterCallLog, formatCallClock, groupCallLogByDay, type CallLogEntry } from '@/lib/calling/call-log'
import { TEMPERATURES, type CallSettings, type Temperature } from '@/lib/calling/types'
import { cn } from '@/lib/utils'

type Range = 'today' | '7' | '30' | 'all'
const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: 'all', label: 'All' },
]
const PAGE = 1000

export default function CallLogPage() {
  const { accountId } = useAuth()
  const canWrite = useCan('send-messages')
  const { settings } = useCallSettings()
  const [range, setRange] = useState<Range>('7')
  const [entries, setEntries] = useState<CallLogEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState<string | null>(null)
  const [temperature, setTemperature] = useState<Temperature | null>(null)
  const [remarksOnly, setRemarksOnly] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [openLogId, setOpenLogId] = useState<string | null>(null)
  const today = kampalaToday()

  const load = useCallback(async () => {
    if (!accountId) return
    const db = createClient()
    const since =
      range === 'all' ? null : kampalaStartOfDay(range === 'today' ? today : addDays(today, -(Number(range) - 1)))
    const all: CallLogEntry[] = []
    for (let from = 0; ; from += PAGE) {
      let q = db.from('call_logs').select('*, lead:call_leads(*)').eq('account_id', accountId)
      if (since) q = q.gte('called_at', since)
      const { data, error } = await q.order('called_at', { ascending: false }).range(from, from + PAGE - 1)
      if (error) {
        console.error('[calls] call log failed:', error)
        break
      }
      all.push(...((data ?? []) as CallLogEntry[]))
      if (!data || data.length < PAGE) break
    }
    setEntries(all)
  }, [accountId, range, today])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () => filterCallLog(entries ?? [], { query, outcome, temperature, remarksOnly }),
    [entries, query, outcome, temperature, remarksOnly],
  )
  const groups = useMemo(() => groupCallLogByDay(visible), [visible])
  const pickupKeys = useMemo(() => new Set(settings.outcomes.filter((o) => o.pickup).map((o) => o.key)), [settings])
  const pickedUp = visible.filter((e) => pickupKeys.has(e.outcome)).length
  const withRemarks = visible.filter((e) => e.remarks?.trim()).length
  const filterCount = (outcome ? 1 : 0) + (temperature ? 1 : 0) + (remarksOnly ? 1 : 0)
  const openLead = entries?.find((e) => e.id === openLogId)?.lead ?? null

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <CallsHeader
        kicker="Call log"
        title={entries === null ? 'Your calls' : `${visible.length} ${visible.length === 1 ? 'call' : 'calls'}`}
        description={
          entries === null || visible.length === 0
            ? 'Everyone you called and what they said.'
            : `${pickedUp} picked up · ${withRemarks} with remarks`
        }
      />

      <div className="flex gap-1.5 overflow-x-auto">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={cn(
              'h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors',
              range === r.key ? 'bg-foreground text-background' : 'border border-border bg-card',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, remarks…"
          className="h-11 rounded-[14px] bg-card pr-12 pl-10"
        />
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          aria-label="Filter"
          className={cn(
            'absolute top-1/2 right-1.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[10px] transition-colors',
            filterCount ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {filterCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {outcome && (
            <FilterChip className="bg-pastel-sky text-pastel-sky-fg" onClear={() => setOutcome(null)}>
              {outcomeLabel(settings, outcome)}
            </FilterChip>
          )}
          {temperature && (
            <FilterChip className={TEMPERATURE_META[temperature].className} onClear={() => setTemperature(null)}>
              {TEMPERATURE_META[temperature].label}
            </FilterChip>
          )}
          {remarksOnly && (
            <FilterChip className="bg-pastel-mint text-pastel-mint-fg" onClear={() => setRemarksOnly(false)}>
              With remarks
            </FilterChip>
          )}
        </div>
      )}

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        settings={settings}
        outcome={outcome}
        setOutcome={setOutcome}
        temperature={temperature}
        setTemperature={setTemperature}
        remarksOnly={remarksOnly}
        setRemarksOnly={setRemarksOnly}
      />

      {entries === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {entries.length === 0
            ? range === 'today'
              ? 'No calls logged today yet.'
              : 'No calls logged in this period.'
            : 'No calls match.'}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.date} className="space-y-2">
              <h2 className="flex items-baseline justify-between px-1 text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
                <span>{formatDay(g.date, today)}</span>
                <span className="font-semibold normal-case tracking-normal">
                  {g.entries.length} {g.entries.length === 1 ? 'call' : 'calls'}
                </span>
              </h2>
              <ul className="space-y-2">
                {g.entries.map((e) => (
                  <LogRow
                    key={e.id}
                    entry={e}
                    settings={settings}
                    today={today}
                    onOpen={e.lead ? () => setOpenLogId(e.id) : undefined}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <CallPanel
        lead={openLead}
        settings={settings}
        canWrite={canWrite}
        onClose={() => setOpenLogId(null)}
        onSaved={() => {
          setOpenLogId(null)
          void load()
        }}
        onDeleted={() => {
          setOpenLogId(null)
          void load()
        }}
      />
    </div>
  )
}

function LogRow({
  entry: e,
  settings,
  today,
  onOpen,
}: {
  entry: CallLogEntry
  settings: CallSettings
  today: string
  onOpen?: () => void
}) {
  const l = e.lead
  const who = [l?.contact_person, l?.phone ? formatPhone(l.phone) : null].filter(Boolean).join(' · ')
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="w-full rounded-[18px] border border-border bg-card p-3.5 text-left transition-colors hover:bg-muted/40 disabled:cursor-default"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold">{l?.business_name ?? 'Deleted lead'}</p>
              <TemperatureBadge value={e.temperature_after} />
            </div>
            {who ? <p className="truncate text-xs text-muted-foreground">{who}</p> : null}
          </div>
          <span className="shrink-0 pt-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
            {formatCallClock(e.called_at)}
          </span>
          {onOpen ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
        </div>

        <p className="mt-2 text-sm font-medium">{outcomeLabel(settings, e.outcome)}</p>
        {e.remarks?.trim() ? (
          <p className="mt-1.5 rounded-xl bg-muted/60 px-3 py-2 text-sm whitespace-pre-wrap">{e.remarks.trim()}</p>
        ) : null}
        {e.tags.length || e.next_call_date ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {e.tags.map((t) => (
              <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                {t}
              </span>
            ))}
            {e.next_call_date ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-pastel-lilac px-2 py-0.5 text-[11px] font-semibold text-pastel-lilac-fg">
                <CalendarClock className="h-3 w-3" />
                Next {formatDay(e.next_call_date, today)}
              </span>
            ) : null}
          </div>
        ) : null}
      </button>
    </li>
  )
}

function FilterChip({ className, onClear, children }: { className: string; onClear: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className={cn('inline-flex h-7 max-w-full items-center gap-1 rounded-full px-2.5 text-xs font-semibold', className)}
    >
      <span className="truncate">{children}</span>
      <X className="h-3 w-3 shrink-0" />
    </button>
  )
}

function FilterSheet({
  open,
  onOpenChange,
  settings,
  outcome,
  setOutcome,
  temperature,
  setTemperature,
  remarksOnly,
  setRemarksOnly,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: CallSettings
  outcome: string | null
  setOutcome: (v: string | null) => void
  temperature: Temperature | null
  setTemperature: (v: Temperature | null) => void
  remarksOnly: boolean
  setRemarksOnly: (v: boolean) => void
}) {
  const option = (active: boolean) =>
    cn(
      'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors',
      active ? 'bg-foreground text-background' : 'border border-border bg-card',
    )
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-3xl p-0">
        <div className="space-y-5 p-5">
          <SheetTitle className="text-lg font-bold">Filter calls</SheetTitle>

          <div className="space-y-2">
            <p className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Outcome</p>
            <div className="flex flex-wrap gap-1.5">
              {settings.outcomes.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setOutcome(outcome === o.key ? null : o.key)}
                  className={option(outcome === o.key)}
                >
                  {outcome === o.key ? <Check className="h-3.5 w-3.5" /> : null}
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Stage after the call</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPERATURES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTemperature(temperature === t ? null : t)}
                  className={option(temperature === t)}
                >
                  {temperature === t ? <Check className="h-3.5 w-3.5" /> : null}
                  {TEMPERATURE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3.5">
            <span className="text-sm font-medium">Only calls with remarks</span>
            <Switch checked={remarksOnly} onCheckedChange={(v) => setRemarksOnly(!!v)} />
          </label>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full rounded-full bg-foreground text-sm font-semibold text-background"
          >
            Show calls
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
