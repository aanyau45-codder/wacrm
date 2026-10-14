'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flame, Loader2, PhoneCall, PhoneIncoming, Target, Trophy } from 'lucide-react'
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

type LeadRow = Pick<CallLead, 'id' | 'temperature' | 'industry' | 'next_call_date' | 'do_not_call' | 'phone_invalid'>
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
        .select('id, temperature, industry, next_call_date, do_not_call, phone_invalid')
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

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <CallsHeader
        title="Results"
        action={
          <div className="flex shrink-0 gap-1 rounded-full bg-muted p-1">
            {([7, 30, 90] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  'h-7 rounded-full px-2.5 text-xs font-semibold',
                  range === r ? 'bg-background shadow-sm' : 'text-muted-foreground',
                )}
              >
                {r}d
              </button>
            ))}
          </div>
        }
      />

      {/* Hero: today + week vs targets */}
      <div className="grid gap-3 sm:grid-cols-2">
        <TargetCard
          label="Calls today"
          value={stats.callsToday}
          target={settings.daily_target}
          sub={`${stats.queueToday} still queued${stats.overdue ? ` · ${stats.overdue} overdue` : ''}`}
          tone="bg-pastel-lilac"
        />
        <TargetCard
          label="Calls this week"
          value={stats.callsWeek}
          target={settings.weekly_target}
          sub="Mon – Sun, Kampala time"
          tone="bg-pastel-peach"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={PhoneCall} label={`Calls · ${range}d`} value={String(stats.callsInRange)} />
        <Stat icon={PhoneIncoming} label="Pick-up rate" value={pct(stats.pickupRate)} />
        <Stat icon={Flame} label="Hot leads" value={String(stats.byTemperature.hot)} />
        <Stat
          icon={Trophy}
          label="Hot → Won"
          value={pct(stats.hotToWon)}
          sub={stats.hotEver ? `${stats.hotWon} of ${stats.hotEver}` : 'no hot leads yet'}
        />
      </div>

      {/* Calls per day */}
      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Calls per day</h2>
          <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-foreground" />picked up</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-foreground/25" />no answer</span>
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
              <div className="w-full rounded-t-[3px] bg-foreground/25" style={{ height: `${((d.calls - d.pickups) / maxDay) * 100}%` }} />
              <div className={cn('w-full bg-foreground', d.calls - d.pickups ? '' : 'rounded-t-[3px]')} style={{ height: `${(d.pickups / maxDay) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span>{days[0]?.date.slice(5)}</span>
          <span>today</span>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Temperature */}
        <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">Leads by temperature <span className="font-normal text-muted-foreground">· {totalLeads}</span></h2>
          <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted">
            {(['hot', 'warm', 'cold', 'new', 'won', 'lost', 'dnc'] as const).map((t) =>
              stats.byTemperature[t] ? (
                <div key={t} className={TEMPERATURE_META[t].className} style={{ width: `${(stats.byTemperature[t] / Math.max(1, totalLeads)) * 100}%` }} />
              ) : null,
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['new', 'cold', 'warm', 'hot', 'won', 'lost', 'dnc'] as const).map((t) => (
              <div key={t} className={cn('rounded-2xl px-3 py-2', TEMPERATURE_META[t].className)}>
                <p className="text-[11px] font-semibold opacity-80">{TEMPERATURE_META[t].label}</p>
                <p className="font-heading text-xl font-semibold tabular-nums">{stats.byTemperature[t]}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Outcomes */}
        <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">Outcomes · {range}d</h2>
          {stats.byOutcome.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {stats.byOutcome.map((o) => (
                <li key={o.key} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{o.label}</span>
                    <span className="tabular-nums text-muted-foreground">{o.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(o.count / stats.callsInRange) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Industry */}
      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold">By industry · {range}d</h2>
        {stats.byIndustry.length === 0 ? (
          <p className="text-sm text-muted-foreground">Log calls to compare industries.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Industry</th>
                  <th className="pb-2 text-right font-medium">Calls</th>
                  <th className="pb-2 pl-4 font-medium">Pick-up</th>
                  <th className="pb-2 text-right font-medium">Interested</th>
                  <th className="pb-2 text-right font-medium">Won</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.byIndustry.map((r) => (
                  <tr key={r.industry}>
                    <td className="py-2 font-medium">{r.industry}</td>
                    <td className="py-2 text-right tabular-nums">{r.calls}</td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.pickupRate * 100}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{pct(r.pickupRate)}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{r.positive}</td>
                    <td className="py-2 text-right tabular-nums">{r.won}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function TargetCard({ label, value, target, sub, tone }: { label: string; value: number; target: number; sub: string; tone: string }) {
  const p = Math.min(100, Math.round((value / Math.max(1, target)) * 100))
  return (
    <div className={cn('rounded-3xl p-5', tone)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground/70">{label}</p>
        <Target className="h-4 w-4 text-foreground/60" />
      </div>
      <p className="mt-2 font-heading text-4xl leading-none font-semibold tabular-nums">
        {value}
        <span className="text-lg font-medium text-foreground/50"> / {target}</span>
      </p>
      <div className="mt-4 h-2 rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${p}%` }} />
      </div>
      <p className="mt-2 text-xs text-foreground/70">{p}% of target · {sub}</p>
    </div>
  )
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  )
}
