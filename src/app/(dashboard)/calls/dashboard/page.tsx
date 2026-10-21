'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { CallsHeader } from '@/components/calling/calls-nav'
import { useCallSettings } from '@/components/calling/use-call-settings'
import { TEMPERATURE_META } from '@/lib/calling/defaults'
import { addDays, kampalaStartOfDay, kampalaToday, startOfWeek } from '@/lib/calling/dates'
import { computeCallStats } from '@/lib/calling/stats'
import type { CallLead, CallLog } from '@/lib/calling/types'
import { cn } from '@/lib/utils'

type Range = 7 | 30 | 90
const PAGE = 1000
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)

type LeadRow = Pick<CallLead, 'id' | 'temperature' | 'industry' | 'next_call_date' | 'do_not_call' | 'phone_invalid' | 'attempts'>
type LogRow = Pick<CallLog, 'lead_id' | 'called_at' | 'outcome' | 'temperature_after'>

export default function CallResultsPage() {
  const { accountId } = useAuth()
  const { settings } = useCallSettings()
  const [range, setRange] = useState<Range>(30)
  const [leads, setLeads] = useState<LeadRow[] | null>(null)
  const [logs, setLogs] = useState<LogRow[] | null>(null)
  const today = kampalaToday()
  const weekStart = startOfWeek(today)

  const load = useCallback(async () => {
    if (!accountId) return
    const db = createClient()
    const ls: LeadRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from('call_leads')
        .select('id, temperature, industry, next_call_date, do_not_call, phone_invalid, attempts')
        .eq('account_id', accountId)
        .range(from, from + PAGE - 1)
      if (error) break
      ls.push(...((data ?? []) as LeadRow[]))
      if (!data || data.length < PAGE) break
    }
    // 90 days covers every range and the current week.
    const since = kampalaStartOfDay(addDays(today, -89))
    const lg: LogRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from('call_logs')
        .select('lead_id, called_at, outcome, temperature_after')
        .eq('account_id', accountId)
        .gte('called_at', since)
        .order('called_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) break
      lg.push(...((data ?? []) as LogRow[]))
      if (!data || data.length < PAGE) break
    }
    setLeads(ls)
    setLogs(lg)
  }, [accountId, today])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(
    () => (leads && logs ? computeCallStats(leads, logs, settings, today, range, weekStart) : null),
    [leads, logs, settings, today, range, weekStart],
  )

  if (!stats) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <CallsHeader title="Results" />
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const totalLeads = Object.values(stats.byTemperature).reduce((a, b) => a + b, 0)
  const maxDay = Math.max(settings.daily_target, ...stats.perDay.map((d) => d.calls), 1)
  const days = range === 90 ? stats.perDay.slice(-30) : stats.perDay
  const toGo = Math.max(0, settings.daily_target - stats.callsToday)
  const headline =
    toGo === 0 ? 'Target hit today 🎉' : stats.callsToday === 0 ? `${toGo} calls to go today` : `Nice pace, ${toGo} to go`

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <CallsHeader
        kicker={`Results · last ${range} days`}
        title={headline}
        action={
          <div className="flex shrink-0 gap-1">
            {([7, 30, 90] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  'h-8 rounded-full px-3 text-xs font-semibold transition-colors',
                  range === r ? 'bg-foreground text-background' : 'border border-border bg-card',
                )}
              >
                {r}d
              </button>
            ))}
          </div>
        }
      />

      {/* 2×2 pastel tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          tone="bg-pastel-peach text-pastel-peach-fg"
          label="Today"
          value={String(stats.callsToday)}
          of={settings.daily_target}
          sub={`${stats.queueToday} queued${stats.overdue ? ` · ${stats.overdue} overdue` : ''}`}
        />
        <Tile
          tone="bg-pastel-lilac text-pastel-lilac-fg"
          label="This week"
          value={String(stats.callsWeek)}
          of={settings.weekly_target}
          sub="Mon – Sun"
        />
        <Tile
          tone="bg-pastel-mint text-pastel-mint-fg"
          label="Pick-up rate"
          value={pct(stats.pickupRate)}
          sub={`of ${stats.callsInRange} calls · ${range}d`}
        />
        <Tile
          tone="bg-pastel-coral text-pastel-coral-fg"
          label="Hot → Won"
          value={pct(stats.hotToWon)}
          sub={stats.hotEver ? `${stats.hotWon} of ${stats.hotEver} hot leads` : 'no hot leads yet'}
        />
      </div>

      {/* Calls per day */}
      <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold">Calls per day</h2>
          <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-brand" />picked up</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-pastel-lilac" />no answer</span>
            <span className="flex items-center gap-1"><i className="h-px w-3 border-t border-dashed border-foreground/60" />target</span>
          </span>
        </div>
        <div className="relative flex h-40 items-end gap-[3px]">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/40"
            style={{ bottom: `${(settings.daily_target / maxDay) * 100}%` }}
          />
          {days.map((d) => (
            <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${d.calls} calls, ${d.pickups} picked up`}>
              <div
                className={cn('w-full bg-pastel-lilac', range === 7 ? 'rounded-t-lg' : 'rounded-t-[3px]')}
                style={{ height: `${((d.calls - d.pickups) / maxDay) * 100}%` }}
              />
              <div
                className={cn('w-full bg-brand', d.calls - d.pickups ? '' : range === 7 ? 'rounded-t-lg' : 'rounded-t-[3px]')}
                style={{ height: `${(d.pickups / maxDay) * 100}%` }}
              />
            </div>
          ))}
        </div>
        {range === 7 ? (
          <div className="mt-1.5 flex gap-[3px] text-[10px] text-muted-foreground">
            {days.map((d) => (
              <span key={d.date} className={cn('flex-1 text-center', d.date === today && 'font-bold text-foreground')}>
                {WEEKDAY[new Date(`${d.date}T12:00:00Z`).getUTCDay()]}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{days[0]?.date.slice(5)}</span>
            <span>today</span>
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Temperature */}
        <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-bold">
            Leads by temperature <span className="font-normal text-muted-foreground">· {totalLeads}</span>
          </h2>
          <div className="mb-4 flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-muted">
            {(['hot', 'warm', 'cold', 'new', 'won', 'lost', 'dnc'] as const).map((t) =>
              stats.byTemperature[t] ? (
                <div key={t} className={TEMPERATURE_META[t].className} style={{ width: `${(stats.byTemperature[t] / Math.max(1, totalLeads)) * 100}%` }} />
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['new', 'cold', 'warm', 'hot', 'won', 'lost', 'dnc'] as const).map((t) => (
              <span key={t} className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold', TEMPERATURE_META[t].className)}>
                {TEMPERATURE_META[t].label}
                <b className="tabular-nums">{stats.byTemperature[t]}</b>
              </span>
            ))}
          </div>
        </section>

        {/* Outcomes */}
        <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-bold">Outcomes · {range}d</h2>
          {stats.byOutcome.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls logged yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {stats.byOutcome.map((o) => (
                <li key={o.key} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{o.label}</span>
                    <span className="font-semibold tabular-nums">{o.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-pastel-lilac">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(o.count / stats.callsInRange) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Industry */}
      <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-bold">By industry · {range}d</h2>
        {stats.byIndustry.length === 0 ? (
          <p className="text-sm text-muted-foreground">Log calls to compare industries.</p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.byIndustry.map((r) => (
              <li key={r.industry} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.industry}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.calls} {r.calls === 1 ? 'call' : 'calls'} · {r.positive} interested · {r.won} won
                  </p>
                </div>
                <div className="flex w-28 shrink-0 items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-pastel-mint">
                    <div className="h-full rounded-full bg-green-600" style={{ width: `${r.pickupRate * 100}%` }} />
                  </div>
                  <span className="w-9 text-right text-xs font-semibold tabular-nums">{pct(r.pickupRate)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Tile({ tone, label, value, of, sub }: { tone: string; label: string; value: string; of?: number; sub: string }) {
  const p = of ? Math.min(100, Math.round((Number(value) / Math.max(1, of)) * 100)) : null
  return (
    <div className={cn('flex min-h-[132px] flex-col rounded-[22px] p-4 sm:p-5', tone)}>
      <p className="text-[13px] font-bold">{label}</p>
      <p className="mt-2 text-[30px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
        {value}
        {of ? <span className="text-base font-semibold opacity-60"> /{of}</span> : null}
      </p>
      {p !== null ? (
        <div className="mt-3 h-1.5 rounded-full bg-current/15">
          <div className="h-full rounded-full bg-current transition-all" style={{ width: `${p}%` }} />
        </div>
      ) : null}
      <p className="mt-auto pt-2 text-xs font-semibold opacity-75">{sub}</p>
    </div>
  )
}
