"use client"

import { useId } from 'react'
import { ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslations } from 'next-intl'
import { DOW_SHORT_MON_FIRST } from '@/lib/dashboard/date-utils'
import type { ResponseTimeSummary } from '@/lib/dashboard/types'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'

interface ResponseTimeChartProps {
  data: ResponseTimeSummary | null
  loading: boolean
  /** Minutes. Shown next to the week-on-week change line. */
  thresholdMinutes?: number
}

interface Row {
  day: string
  mins: number | null
}

/**
 * "Pastel hill": the whole card is a lilac tile with this week's
 * average as the headline and a smooth curve of the per-weekday
 * averages below. Everything is drawn in `currentColor`, so the
 * pastel -fg token keeps it readable in both light and dark mode.
 */
export function ResponseTimeChart({
  data,
  loading,
  thresholdMinutes = 5,
}: ResponseTimeChartProps) {
  const t = useTranslations('Dashboard.responseTimeChart')
  // useId output contains characters that break `url(#…)` references.
  const gradientId = `rt-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const hasData = data?.buckets.some((b) => b.avgMinutes != null) ?? false

  // Days without samples stay null so the curve bridges them instead
  // of dipping to a fake "0m".
  const rows: Row[] =
    data?.buckets.map((b, i) => ({ day: DOW_SHORT_MON_FIRST[i], mins: b.avgMinutes })) ?? []

  const thisWeek = data?.thisWeekAvg ?? null
  const lastWeek = data?.lastWeekAvg ?? null
  const change =
    thisWeek != null && lastWeek != null && lastWeek > 0
      ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
      : null

  return (
    <section className="overflow-hidden rounded-[22px] bg-pastel-lilac text-pastel-lilac-fg">
      <div className="p-5 pb-0">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-bold">
              <Clock className="h-4 w-4 shrink-0" />
              {t('title')}
            </h2>
            <p className="mt-0.5 text-xs opacity-70">{t('description')}</p>
          </div>
          <dl className="shrink-0 space-y-0.5 text-right text-xs">
            <div className="flex justify-end gap-1.5">
              <dt className="opacity-70">{t('thisWeek')}</dt>
              <dd className="font-bold tabular-nums">{fmt(thisWeek)}</dd>
            </div>
            <div className="flex justify-end gap-1.5">
              <dt className="opacity-70">{t('lastWeek')}</dt>
              <dd className="font-semibold tabular-nums opacity-80">{fmt(lastWeek)}</dd>
            </div>
          </dl>
        </header>

        {!loading && hasData && (
          <>
            <p className="mt-3 text-[40px] leading-none font-bold tracking-tight tabular-nums">
              {fmt(thisWeek)}
            </p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold">
              {change != null && change < 0 && <ArrowDownRight className="h-3.5 w-3.5" />}
              {change != null && change > 0 && <ArrowUpRight className="h-3.5 w-3.5" />}
              {change == null
                ? null
                : change < 0
                  ? t('faster', { percent: Math.abs(change) })
                  : change > 0
                    ? t('slower', { percent: change })
                    : t('same')}
              {change != null && thresholdMinutes > 0 && ' · '}
              {thresholdMinutes > 0 && t('target', { minutes: thresholdMinutes })}
            </p>
          </>
        )}
      </div>

      {loading || !data ? (
        <div className="p-5">
          <Skeleton className="h-[200px] w-full" />
        </div>
      ) : !hasData ? (
        <div className="p-5">
          <EmptyState icon={Clock} title={t('noReplies')} hint={t('noRepliesHint')} />
        </div>
      ) : (
        <div className="mt-2 h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'currentColor', fontSize: 11, opacity: 0.7 }}
                height={26}
                padding={{ left: 8, right: 8 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tickCount={4}
                tick={{ fill: 'currentColor', fontSize: 11, opacity: 0.7 }}
                tickFormatter={(v: number) => fmtTick(v)}
                width={36}
              />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as Row | undefined
                  if (!active || !row) return null
                  return (
                    <div className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background shadow-lg">
                      {row.day} · {row.mins == null ? t('noSamples') : fmt(row.mins)}
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="mins"
                connectNulls
                isAnimationActive={false}
                stroke="currentColor"
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                activeDot={{ r: 6, strokeWidth: 3, stroke: 'var(--pastel-lilac)', fill: 'currentColor' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

function fmt(mins: number | null): string {
  if (mins == null) return '—'
  if (mins < 1) return `${Math.max(1, Math.round(mins * 60))}s`
  if (mins < 60) return `${mins.toFixed(1)}m`
  return `${(mins / 60).toFixed(1)}h`
}

function fmtTick(mins: number): string {
  if (mins < 60 || mins % 60 !== 0) return `${mins}m`
  return `${mins / 60}h`
}
