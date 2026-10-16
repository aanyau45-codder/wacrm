"use client"

import { useId } from 'react'
import { MessageSquare } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslations } from 'next-intl'
import type { ConversationsSeriesPoint } from '@/lib/dashboard/types'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'
import { cn } from '@/lib/utils'

type RangeDays = 7 | 30 | 90

interface ConversationsChartProps {
  /** Per-range data, so switching tabs never re-fetches. */
  series: Record<RangeDays, ConversationsSeriesPoint[] | null>
  loading: boolean
  range: RangeDays
  onRangeChange: (r: RangeDays) => void
}

/**
 * Same "pastel hill" look as the response-time card: a sky tile with
 * the range total as the headline and smooth curves below. Incoming is
 * the filled hill, outgoing the dashed line; both draw in
 * `currentColor` so the pastel -fg token works in light and dark mode.
 */
export function ConversationsChart({ series, loading, range, onRangeChange }: ConversationsChartProps) {
  const t = useTranslations('Dashboard.conversationsChart')
  // useId output contains characters that break `url(#…)` references.
  const gradientId = `cv-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const data = series[range]
  const hasData = data?.some((p) => p.incoming > 0 || p.outgoing > 0) ?? false
  const incoming = data?.reduce((s, p) => s + p.incoming, 0) ?? 0
  const outgoing = data?.reduce((s, p) => s + p.outgoing, 0) ?? 0

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[22px] bg-pastel-sky text-pastel-sky-fg">
      <div className="p-5 pb-0">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-bold">
              <MessageSquare className="h-4 w-4 shrink-0" />
              {t('title')}
            </h2>
            <p className="mt-0.5 text-xs opacity-70">{t('description')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-background/40 p-0.5">
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRangeChange(r)}
                aria-pressed={range === r}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors',
                  range === r ? 'bg-background text-foreground shadow-sm' : 'opacity-70 hover:opacity-100',
                )}
              >
                {t('days', { count: r })}
              </button>
            ))}
          </div>
        </header>

        {!loading && hasData && (
          <>
            <p className="mt-3 text-[40px] leading-none font-bold tracking-tight tabular-nums">
              {(incoming + outgoing).toLocaleString()}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-[3px] w-4 rounded-full bg-current" />
                {t('tooltipIncoming', { count: incoming })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-[3px] border-dotted border-current" />
                {t('tooltipOutgoing', { count: outgoing })}
              </span>
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
          <EmptyState icon={MessageSquare} title={t('noActivity')} hint={t('noActivityHint')} />
        </div>
      ) : (
        <div className="mt-2 h-[200px] min-h-[200px] flex-1" role="img" aria-label={t('ariaLabel')}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
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
                tickFormatter={shortDayLabel}
                interval="preserveStartEnd"
                minTickGap={24}
                height={26}
                padding={{ left: 8, right: 8 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tickCount={4}
                tick={{ fill: 'currentColor', fontSize: 11, opacity: 0.7 }}
                width={36}
              />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as ConversationsSeriesPoint | undefined
                  if (!active || !p) return null
                  return (
                    <div className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold whitespace-nowrap text-background shadow-lg">
                      {shortDayLabel(p.day)} · {t('tooltipIncoming', { count: p.incoming })} ·{' '}
                      {t('tooltipOutgoing', { count: p.outgoing })}
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="incoming"
                isAnimationActive={false}
                stroke="currentColor"
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                activeDot={{ r: 6, strokeWidth: 3, stroke: 'var(--pastel-sky)', fill: 'currentColor' }}
              />
              <Area
                type="monotone"
                dataKey="outgoing"
                isAnimationActive={false}
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray="2 5"
                strokeLinecap="round"
                strokeOpacity={0.75}
                fill="none"
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--pastel-sky)', fill: 'currentColor' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

function shortDayLabel(key: string): string {
  // key is YYYY-MM-DD; build a local date so midnight never shifts the day.
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
