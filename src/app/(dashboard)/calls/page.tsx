'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MessageCircle, Phone, Search, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCan } from '@/hooks/use-can'
import { Input } from '@/components/ui/input'
import { CallsHeader } from '@/components/calling/calls-nav'
import { CallPanel, outcomeLabel } from '@/components/calling/call-panel'
import { TemperatureBadge } from '@/components/calling/temperature-badge'
import { useCallSettings } from '@/components/calling/use-call-settings'
import { endOfWeek, formatDay, kampalaStartOfDay, kampalaToday } from '@/lib/calling/dates'
import { formatPhone, whatsappLink } from '@/lib/calling/phone'
import { TEMPERATURE_META } from '@/lib/calling/defaults'
import type { CallLead, Temperature } from '@/lib/calling/types'
import { cn } from '@/lib/utils'

type Tab = 'today' | 'overdue' | 'week' | 'all'
const PAGE = 1000

function byPriority(a: CallLead, b: CallLead) {
  return b.priority - a.priority || a.business_name.localeCompare(b.business_name)
}

export default function CallTodayPage() {
  const { accountId } = useAuth()
  const canWrite = useCan('send-messages')
  const { settings } = useCallSettings()
  const [leads, setLeads] = useState<CallLead[] | null>(null)
  const [doneToday, setDoneToday] = useState(0)
  const [tab, setTab] = useState<Tab>('today')
  const [query, setQuery] = useState('')
  const [tempFilter, setTempFilter] = useState<Temperature | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const today = kampalaToday()

  const load = useCallback(async () => {
    if (!accountId) return
    const db = createClient()
    const all: CallLead[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from('call_leads')
        .select('*')
        .eq('account_id', accountId)
        .order('priority', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) {
        console.error('[calls] leads failed:', error)
        break
      }
      all.push(...((data ?? []) as CallLead[]))
      if (!data || data.length < PAGE) break
    }
    setLeads(all)
    const { count } = await db
      .from('call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .gte('called_at', kampalaStartOfDay(today))
    setDoneToday(count ?? 0)
  }, [accountId, today])

  useEffect(() => {
    void load()
  }, [load])

  const queued = useMemo(
    () => (leads ?? []).filter((l) => l.next_call_date && !l.do_not_call && !l.phone_invalid),
    [leads],
  )
  const lists = useMemo(() => {
    const weekEnd = endOfWeek(today)
    return {
      today: queued.filter((l) => l.next_call_date === today).sort(byPriority),
      overdue: queued
        .filter((l) => l.next_call_date! < today)
        .sort((a, b) => a.next_call_date!.localeCompare(b.next_call_date!) || byPriority(a, b)),
      week: queued
        .filter((l) => l.next_call_date! >= today && l.next_call_date! <= weekEnd)
        .sort((a, b) => a.next_call_date!.localeCompare(b.next_call_date!) || byPriority(a, b)),
      all: [...(leads ?? [])].sort(byPriority),
    }
  }, [queued, leads, today])

  const visible = useMemo(() => {
    let rows = lists[tab]
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter((l) =>
        [l.business_name, l.town, l.industry, l.contact_person, l.phone]
          .some((v) => v?.toLowerCase().includes(q)),
      )
    }
    if (tempFilter) rows = rows.filter((l) => (l.temperature ?? 'new') === tempFilter)
    return rows
  }, [lists, tab, query, tempFilter])

  const openLead = leads?.find((l) => l.id === openId) ?? null

  function handleSaved(updated: CallLead, next: boolean) {
    setDoneToday((n) => n + 1)
    const idx = visible.findIndex((l) => l.id === updated.id)
    setLeads((ls) => (ls ?? []).map((l) => (l.id === updated.id ? updated : l)))
    if (next) {
      // Next lead in the current list that still needs a call.
      const nextLead = visible.slice(idx + 1).find((l) => l.id !== updated.id && !l.do_not_call)
      setOpenId(nextLead?.id ?? null)
    } else {
      setOpenId(null)
    }
  }

  const target = settings.daily_target
  const pct = Math.min(100, Math.round((doneToday / Math.max(1, target)) * 100))
  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'today', label: 'Today', count: lists.today.length },
    { key: 'overdue', label: 'Overdue', count: lists.overdue.length },
    { key: 'week', label: 'This week', count: lists.week.length },
    { key: 'all', label: 'All', count: lists.all.length },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CallsHeader title="Call today" description={formatDay(today, '') + ' · Kampala time'} />

      {/* Progress */}
      <div className="flex items-center gap-4 rounded-3xl bg-pastel-lilac p-4 sm:p-5">
        <div
          className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(var(--foreground) ${pct * 3.6}deg, color-mix(in oklch, var(--foreground) 12%, transparent) 0)` }}
        >
          <div className="grid h-12 w-12 place-items-center rounded-full bg-pastel-lilac text-sm font-semibold tabular-nums">
            {pct}%
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-2xl leading-none font-semibold tabular-nums">
            {doneToday}
            <span className="text-base font-medium text-foreground/60"> / {target} calls</span>
          </p>
          <p className="mt-1.5 text-sm text-foreground/70">
            {lists.today.length} left today
            {lists.overdue.length ? ` · ${lists.overdue.length} overdue` : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-full bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors',
                tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] tabular-nums',
                  t.key === 'overdue' && t.count ? 'bg-pastel-coral text-foreground' : 'bg-foreground/10',
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, town, phone…"
            className="h-10 rounded-full pl-9"
          />
        </div>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1">
            {(['new', 'cold', 'warm', 'hot', 'won', 'lost', 'dnc'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTempFilter((f) => (f === t ? null : t))}
                className={cn(
                  'h-7 rounded-full px-2.5 text-xs font-semibold transition-opacity',
                  TEMPERATURE_META[t].className,
                  tempFilter && tempFilter !== t ? 'opacity-40' : '',
                  tempFilter === t ? 'ring-2 ring-foreground' : '',
                )}
              >
                {TEMPERATURE_META[t].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {leads === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {tab === 'today' ? 'Nothing left for today 🎉' : 'No leads here.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((l) => (
            <LeadRow
              key={l.id}
              lead={l}
              today={today}
              showDate={tab !== 'today'}
              lastOutcome={outcomeLabel(settings, l.last_outcome)}
              onOpen={() => setOpenId(l.id)}
            />
          ))}
        </ul>
      )}

      <CallPanel
        lead={openLead}
        settings={settings}
        canWrite={canWrite}
        onClose={() => setOpenId(null)}
        onSaved={handleSaved}
        onDeleted={(id) => {
          setLeads((ls) => (ls ?? []).filter((l) => l.id !== id))
          setOpenId(null)
        }}
      />
    </div>
  )
}

function LeadRow({
  lead,
  today,
  showDate,
  lastOutcome,
  onOpen,
}: {
  lead: CallLead
  today: string
  showDate: boolean
  lastOutcome: string
  onOpen: () => void
}) {
  const wa = whatsappLink(lead.phone)
  const overdue = lead.next_call_date && lead.next_call_date < today
  return (
    <li className="flex items-stretch gap-2 rounded-2xl border border-border bg-card p-2 pl-3 transition-colors hover:bg-muted/40">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-1 text-left">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{lead.business_name}</span>
          <TemperatureBadge value={lead.temperature} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {lastOutcome}
          {lead.attempts ? ` · ${lead.attempts} ${lead.attempts === 1 ? 'call' : 'calls'}` : ''}
          {lead.town ? ` · ${lead.town}` : ''}
          {showDate && lead.next_call_date ? (
            <span className={overdue ? 'font-medium text-red-600 dark:text-red-400' : ''}>
              {' '}· {formatDay(lead.next_call_date, today)}
            </span>
          ) : null}
        </p>
        {lead.last_remark ? (
          <p className="mt-1 line-clamp-1 text-xs text-foreground/80">“{lead.last_remark}”</p>
        ) : null}
      </button>
      <div className="flex shrink-0 items-center gap-1.5">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-foreground"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        ) : null}
        {lead.phone && !lead.do_not_call ? (
          <a
            href={`tel:${lead.phone}`}
            onClick={onOpen}
            aria-label={`Call ${formatPhone(lead.phone)}`}
            title={formatPhone(lead.phone)}
            className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white"
          >
            <Phone className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-pastel-peach p-6 text-center sm:p-10">
      <Sparkles className="mx-auto h-8 w-8" />
      <h2 className="mt-3 font-heading text-xl font-semibold">No leads yet</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-foreground/70">
        Find businesses to call with AI search, or import your own list from CSV or Excel.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/calls/find" className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background">
          Find leads
        </Link>
        <Link href="/calls/import" className="inline-flex h-10 items-center rounded-full bg-card px-4 text-sm font-medium">
          Import a list
        </Link>
      </div>
    </div>
  )
}
