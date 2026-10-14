'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, MessageCircle, Phone, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCan } from '@/hooks/use-can'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { CallsHeader } from '@/components/calling/calls-nav'
import { ProgressRing } from '@/components/calling/progress-ring'
import { CallPanel, outcomeLabel } from '@/components/calling/call-panel'
import { TemperatureBadge } from '@/components/calling/temperature-badge'
import { useCallSettings } from '@/components/calling/use-call-settings'
import { endOfWeek, formatDate, formatDay, kampalaStartOfDay, kampalaToday } from '@/lib/calling/dates'
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
  const [filterOpen, setFilterOpen] = useState(false)
  const deepLinked = useRef(false)
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
    // /calls?lead=ID (from a deal on the pipeline) opens that lead once.
    if (!deepLinked.current) {
      deepLinked.current = true
      const linked = new URLSearchParams(window.location.search).get('lead')
      if (linked && all.some((l) => l.id === linked)) setOpenId(linked)
    }
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
  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'today', label: 'Today', count: lists.today.length },
    { key: 'overdue', label: 'Overdue', count: lists.overdue.length },
    { key: 'week', label: 'Week', count: lists.week.length },
    { key: 'all', label: 'All', count: lists.all.length },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CallsHeader
        title="Call today"
        kicker={formatDate(today)}
        description={
          `${lists.today.length} left today` + (lists.overdue.length ? ` · ${lists.overdue.length} overdue` : '')
        }
        action={<ProgressRing value={doneToday} max={target} />}
      />

      {/* List tabs + search stay pinned while the list scrolls. Nothing
          scrolls sideways: the tabs share one full-width bar and the
          stage filter lives in a bottom sheet. */}
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <div className="grid grid-cols-4 gap-1 rounded-full bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={cn(
                'flex h-9 min-w-0 items-center justify-center gap-1 rounded-full px-1 text-[13px] font-semibold transition-colors',
                tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="truncate">{t.label}</span>
              <span
                className={cn(
                  'min-w-4 rounded-full text-[11px] tabular-nums',
                  t.key === 'overdue' && t.count ? 'bg-pastel-coral px-1 text-pastel-coral-fg' : 'opacity-60',
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, town, phone…"
            className="h-11 rounded-[14px] bg-card pr-12 pl-10"
          />
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label="Filter by stage"
            className={cn(
              'absolute top-1/2 right-1.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[10px] transition-colors',
              tempFilter ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {tempFilter && (
          <button
            type="button"
            onClick={() => setTempFilter(null)}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold',
              TEMPERATURE_META[tempFilter].className,
            )}
          >
            {TEMPERATURE_META[tempFilter].label}
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="rounded-t-[28px] border-border px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-border" />
          <SheetTitle className="text-lg font-bold tracking-tight">Filter by stage</SheetTitle>
          <div className="grid grid-cols-3 gap-2">
            {(['new', 'cold', 'warm', 'hot', 'won', 'lost', 'dnc'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTempFilter((f) => (f === t ? null : t))}
                aria-pressed={tempFilter === t}
                className={cn(
                  'flex h-11 items-center justify-center gap-1.5 rounded-[14px] text-sm font-semibold',
                  TEMPERATURE_META[t].className,
                  tempFilter === t && 'ring-2 ring-foreground ring-offset-2 ring-offset-popover',
                )}
              >
                {tempFilter === t && <Check className="h-3.5 w-3.5" />}
                {TEMPERATURE_META[t].label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTempFilter(null)}
              className="h-12 rounded-full border border-border text-sm font-semibold"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              className="h-12 rounded-full bg-foreground text-sm font-semibold text-background"
            >
              Show leads
            </button>
          </div>
        </SheetContent>
      </Sheet>

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
  const temp = lead.do_not_call ? 'dnc' : (lead.temperature ?? 'new')
  const where = [lead.town, lead.industry].filter(Boolean).join(' · ')
  return (
    <li className="flex items-center gap-3 rounded-[22px] border border-border bg-card p-3 transition-colors hover:bg-muted/30">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          aria-hidden
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-[14px] text-sm font-bold',
            TEMPERATURE_META[temp].className,
          )}
        >
          {initials(lead.business_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{lead.business_name}</span>
          {where ? <span className="block truncate text-xs text-muted-foreground">{where}</span> : null}
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
            <TemperatureBadge value={lead.do_not_call ? 'dnc' : lead.temperature} />
            {showDate && lead.next_call_date && lead.next_call_date !== today ? (
              <span className={cn('truncate', overdue ? 'font-semibold text-orange-700 dark:text-orange-400' : 'text-muted-foreground')}>
                {overdue ? 'Due ' : ''}
                {formatDay(lead.next_call_date, today)}
              </span>
            ) : (
              <span className="truncate text-muted-foreground">
                {lastOutcome}
                {lead.attempts ? ` · ${lead.attempts} ${lead.attempts === 1 ? 'call' : 'calls'}` : ''}
              </span>
            )}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1.5">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            className="grid h-10 w-10 place-items-center rounded-full bg-pastel-mint text-pastel-mint-fg"
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
            className="grid h-10 w-10 place-items-center rounded-full bg-green-600 text-white shadow-sm"
          >
            <Phone className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </li>
  )
}

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase()
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
