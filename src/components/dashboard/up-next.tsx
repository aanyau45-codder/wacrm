"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { kampalaToday } from '@/lib/calling/dates'
import { TEMPERATURE_META } from '@/lib/calling/defaults'
import type { CallLead } from '@/lib/calling/types'
import { cn } from '@/lib/utils'

// Home "Up next": the next few calls due (today + overdue), Hot first,
// each opening that lead on the call list. Read-only — calling and
// logging stay on /calls.

type Row = Pick<CallLead, 'id' | 'business_name' | 'contact_person' | 'temperature' | 'next_call_date' | 'last_remark' | 'priority'>

const RANK: Record<string, number> = { hot: 0, warm: 1, new: 2, cold: 3 }

export function UpNext() {
  const t = useTranslations('Dashboard.upNext')
  const { accountId } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    const today = kampalaToday()
    void createClient()
      .from('call_leads')
      .select('id, business_name, contact_person, temperature, next_call_date, last_remark, priority', { count: 'exact' })
      .eq('account_id', accountId)
      .eq('do_not_call', false)
      .eq('phone_invalid', false)
      .lte('next_call_date', today)
      .order('priority', { ascending: false })
      .limit(60)
      .then(({ data, count, error }) => {
        if (cancelled) return
        if (error) console.error('[dashboard] up next failed:', error)
        const list = ((data ?? []) as Row[]).sort(
          (a, b) => (RANK[a.temperature ?? 'new'] ?? 4) - (RANK[b.temperature ?? 'new'] ?? 4) || b.priority - a.priority,
        )
        setRows(list.slice(0, 3))
        setTotal(count ?? list.length)
      })
    return () => {
      cancelled = true
    }
  }, [accountId])

  return (
    <section className="rounded-[22px] border border-border bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight text-foreground">
          {t('title')}
          {total > 0 ? <span className="ml-1.5 font-semibold text-muted-foreground">· {total}</span> : null}
        </h2>
        <Link href="/calls" className="text-sm font-semibold text-brand hover:opacity-80">
          {t('seeAll')}
        </Link>
      </div>

      {rows === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="-mx-2">
          {rows.map((r) => {
            const meta = TEMPERATURE_META[r.temperature ?? 'new']
            return (
              <li key={r.id}>
                <Link
                  href={`/calls?lead=${r.id}`}
                  className="flex items-center gap-3.5 rounded-2xl px-2 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold', meta.className)}>
                    {initials(r.business_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-foreground">{r.business_name}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {meta.label}
                      {r.last_remark ? ` · ${r.last_remark}` : r.contact_person ? ` · ${r.contact_person}` : ''}
                    </span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-call text-white">
                    <Phone className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {rows && rows.length > 0 && total > rows.length ? (
        <Link href="/calls" className="mt-2 flex items-center justify-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
          {t('more', { count: total - rows.length })}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </section>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
