'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ChevronRight, GitBranch, Globe, Loader2, MapPin, MessageCircle, Phone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/currency'
import { formatCallTime, formatDay, kampalaToday } from '@/lib/calling/dates'
import { formatPhone, whatsappLink } from '@/lib/calling/phone'
import { fillQuickMessage } from '@/lib/calling/quick-messages'
import type { CallLead, CallLog, CallSettings } from '@/lib/calling/types'
import type { DealStatus } from '@/types'
import { LogCallForm } from './log-call-form'
import { TemperatureBadge } from './temperature-badge'

interface Props {
  lead: CallLead | null
  settings: CallSettings
  canWrite: boolean
  onClose: () => void
  onSaved: (lead: CallLead, next: boolean) => void
  onDeleted: (id: string) => void
}

const DESKTOP_QUERY = '(min-width: 640px)'
function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

interface LinkedDeal {
  id: string
  value: number
  currency: string | null
  status: DealStatus | null
  stage: { name: string; color: string | null } | null
  pipeline: { name: string } | null
}

export function outcomeLabel(settings: CallSettings, key: string | null): string {
  if (!key) return 'Not called yet'
  return settings.outcomes.find((o) => o.key === key)?.label ?? key
}

/** Bottom sheet on phones, side panel on desktop: lead info, call log form, history. */
export function CallPanel({ lead, settings, canWrite, onClose, onSaved, onDeleted }: Props) {
  // History is tagged with its lead so a stale list never shows.
  const [loaded, setLoaded] = useState<{ leadId: string; logs: CallLog[] } | null>(null)
  const history = lead && loaded?.leadId === lead.id ? loaded.logs : null
  const setHistory = (fn: (h: CallLog[] | null) => CallLog[]) =>
    lead && setLoaded({ leadId: lead.id, logs: fn(history) })
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  )
  const today = kampalaToday()

  const leadId = lead?.id
  const dealId = lead?.deal_id ?? null
  const [linked, setLinked] = useState<LinkedDeal | null>(null)
  const deal = linked && linked.id === dealId ? linked : null
  useEffect(() => {
    if (!dealId) return
    let cancelled = false
    void createClient()
      .from('deals')
      .select('id, value, currency, status, stage:pipeline_stages(name, color), pipeline:pipelines(name)')
      .eq('id', dealId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setLinked(data as unknown as LinkedDeal)
      })
    return () => {
      cancelled = true
    }
    // Refetch after each save: a call can move the deal.
  }, [dealId, lead?.updated_at])

  useEffect(() => {
    if (!leadId) return
    let cancelled = false
    void createClient()
      .from('call_logs')
      .select('*')
      .eq('lead_id', leadId)
      .order('called_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('[calls] history failed:', error)
        setLoaded({ leadId, logs: (data ?? []) as CallLog[] })
      })
    return () => {
      cancelled = true
    }
  }, [leadId])

  async function remove() {
    if (!lead || !confirm(`Delete ${lead.business_name} and its call history?`)) return
    const { error } = await createClient().from('call_leads').delete().eq('id', lead.id)
    if (error) return toast.error(error.message)
    toast.success('Lead deleted')
    onDeleted(lead.id)
  }

  const wa = lead ? whatsappLink(lead.phone) : null
  const quick =
    lead && wa && !lead.do_not_call
      ? settings.quick_messages
          .map((m) => m.trim())
          .filter(Boolean)
          .map((m) => {
            const text = fillQuickMessage(m, lead)
            return { text, href: whatsappLink(lead.phone, text)! }
          })
      : []
  const socials = lead ? Object.entries(lead.social_links ?? {}) : []

  return (
    <Sheet open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl p-0 data-[side=right]:w-full data-[side=right]:rounded-none data-[side=right]:sm:max-w-lg"
      >
        {lead ? (
          <>
            <SheetHeader className="space-y-2 border-b border-border p-4 pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <TemperatureBadge value={lead.do_not_call ? 'dnc' : lead.temperature} />
                {lead.industry ? <span className="text-xs text-muted-foreground">{lead.industry}</span> : null}
                {lead.town ? <span className="text-xs text-muted-foreground">· {lead.town}</span> : null}
              </div>
              <SheetTitle className="text-2xl font-extrabold tracking-tight">{lead.business_name}</SheetTitle>
              {lead.phone ? (
                lead.do_not_call ? (
                  <p className="text-lg font-bold whitespace-nowrap text-muted-foreground tabular-nums">{formatPhone(lead.phone)}</p>
                ) : (
                  <a
                    href={`tel:${lead.phone}`}
                    className="block w-fit text-lg font-bold whitespace-nowrap text-green-700 tabular-nums dark:text-green-400"
                  >
                    {formatPhone(lead.phone)}
                  </a>
                )
              ) : null}
              <SheetDescription>
                {lead.contact_person ? `${lead.contact_person} · ` : ''}
                {lead.attempts} {lead.attempts === 1 ? 'call' : 'calls'}
                {lead.next_call_date
                  ? ` · next ${formatDay(lead.next_call_date, today)}`
                  : lead.attempts === 0 && !lead.do_not_call && !lead.phone_invalid
                    ? ' · in pool'
                    : ' · not queued'}
                {lead.last_remark ? <span className="italic"> · “{lead.last_remark}”</span> : null}
              </SheetDescription>
              <div className="flex flex-wrap gap-2 pt-1">
                {lead.phone && !lead.do_not_call ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-green-700"
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </a>
                ) : null}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-pastel-mint px-4 text-sm font-semibold text-pastel-mint-fg"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                ) : null}
                {lead.maps_url ? (
                  <a
                    href={lead.maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-card px-4"
                    aria-label="Google Maps"
                  >
                    <MapPin className="h-4 w-4" />
                  </a>
                ) : null}
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-card px-4"
                    aria-label="Website"
                  >
                    <Globe className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
              {quick.length ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Quick WhatsApp</h3>
                    <Link href="/calls/settings#quick-messages" className="text-xs font-medium text-muted-foreground underline">
                      Edit
                    </Link>
                  </div>
                  {quick.map((q) => (
                    <a
                      key={q.href}
                      href={q.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2.5 rounded-2xl bg-pastel-mint/60 p-3 text-left text-sm text-pastel-mint-fg hover:bg-pastel-mint"
                    >
                      <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="line-clamp-2 min-w-0 flex-1">{q.text}</span>
                    </a>
                  ))}
                </div>
              ) : null}
              {lead.lead_note || lead.email || lead.address || socials.length ? (
                <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                  {lead.lead_note ? <p className="text-foreground">{lead.lead_note}</p> : null}
                  {lead.email ? <p>✉ {lead.email}</p> : null}
                  {lead.address ? <p>📍 {lead.address}</p> : null}
                  {socials.length ? (
                    <p className="flex flex-wrap gap-2">
                      {socials.map(([k, url]) => (
                        <a key={k} href={url} target="_blank" rel="noreferrer" className="capitalize underline">
                          {k}
                        </a>
                      ))}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </SheetHeader>

            <div className="space-y-6 p-4 pb-0">
              {deal ? (
                <Link
                  href={`/pipelines?deal=${deal.id}`}
                  className="flex items-center gap-3 rounded-[22px] border border-border bg-card p-3.5 hover:bg-muted/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pastel-lilac text-pastel-lilac-fg">
                    <GitBranch className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {deal.status === 'won' ? 'Won on the pipeline' : deal.status === 'lost' ? 'Lost on the pipeline' : 'On the pipeline'}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[deal.pipeline?.name, deal.stage?.name].filter(Boolean).join(' → ')}
                      {deal.value ? ` · ${formatCurrency(deal.value, deal.currency ?? undefined)}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ) : null}
              {lead.do_not_call ? (
                <p className="rounded-xl bg-zinc-900 p-3 text-sm text-white dark:bg-white dark:text-zinc-900">
                  On the Do Not Call list. It won&apos;t be scheduled or imported again.
                </p>
              ) : canWrite ? (
                <LogCallForm
                  key={lead.id}
                  lead={lead}
                  settings={settings}
                  dealStatus={deal?.status ?? null}
                  onSaved={(updated, log, next) => {
                    setHistory((h) => [log, ...(h ?? [])])
                    onSaved(updated, next)
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">You have view-only access.</p>
              )}
            </div>

            <div className="space-y-3 p-4">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Call history</h3>
              {history === null ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calls yet.</p>
              ) : (
                <ol className="space-y-2">
                  {history.map((h) => (
                    <li key={h.id} className="rounded-2xl border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{outcomeLabel(settings, h.outcome)}</span>
                        <TemperatureBadge value={h.temperature_after} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatCallTime(h.called_at)}
                        {h.next_call_date ? ` · next ${formatDay(h.next_call_date, today)}` : ''}
                      </p>
                      {h.remarks ? <p className="mt-1.5 text-sm">{h.remarks}</p> : null}
                      {h.tags.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {h.tags.map((t) => (
                            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
              {canWrite ? (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
                  <Trash2 /> Delete lead
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
