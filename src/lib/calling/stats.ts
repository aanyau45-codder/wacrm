import { addDays, kampalaDateOf } from './dates'
import type { CallLead, CallLog, CallSettings, Temperature } from './types'
import { isFollowUp, isOnList } from './weekly-list'

// Dashboard numbers for the calling layer, computed from leads + logs
// already loaded in the browser (pure, so it's easy to test).

export interface CallStats {
  callsToday: number
  callsWeek: number
  callsInRange: number
  pickupRate: number | null
  byTemperature: Record<Temperature | 'new', number>
  hotEver: number
  hotWon: number
  hotToWon: number | null
  perDay: { date: string; calls: number; pickups: number }[]
  byIndustry: { industry: string; calls: number; pickups: number; positive: number; won: number; pickupRate: number }[]
  byOutcome: { key: string; label: string; count: number }[]
  /** New leads on the weekly list + follow-ups due today. */
  queueToday: number
  /** Follow-ups past their date (the new list never goes overdue). */
  overdue: number
}

const POSITIVE = new Set(['interested', 'meeting'])

export function computeCallStats(
  leads: Pick<CallLead, 'id' | 'temperature' | 'industry' | 'next_call_date' | 'do_not_call' | 'phone_invalid' | 'attempts'>[],
  logs: Pick<CallLog, 'lead_id' | 'called_at' | 'outcome' | 'temperature_after'>[],
  settings: CallSettings,
  today: string,
  rangeDays: number,
  weekStart: string,
): CallStats {
  const outcomeByKey = new Map(settings.outcomes.map((o) => [o.key, o]))
  const leadById = new Map(leads.map((l) => [l.id, l]))
  const rangeStart = addDays(today, -(rangeDays - 1))

  const byTemperature: CallStats['byTemperature'] = { new: 0, cold: 0, warm: 0, hot: 0, won: 0, lost: 0, dnc: 0 }
  let queueToday = 0
  let overdue = 0
  for (const l of leads) {
    byTemperature[l.temperature ?? 'new']++
    if (isOnList(l)) queueToday++
    else if (isFollowUp(l)) {
      if (l.next_call_date === today) queueToday++
      else if (l.next_call_date! < today) overdue++
    }
  }

  const perDayMap = new Map<string, { calls: number; pickups: number }>()
  for (let i = 0; i < rangeDays; i++) perDayMap.set(addDays(rangeStart, i), { calls: 0, pickups: 0 })

  const industry = new Map<string, { calls: number; pickups: number; positive: number; leads: Set<string> }>()
  const outcomeCount = new Map<string, number>()
  const hotLeads = new Set<string>()
  let callsToday = 0
  let callsWeek = 0
  let inRange = 0
  let pickups = 0

  for (const log of logs) {
    const day = kampalaDateOf(log.called_at)
    if (log.temperature_after === 'hot') hotLeads.add(log.lead_id)
    if (day === today) callsToday++
    if (day >= weekStart && day <= today) callsWeek++
    if (day < rangeStart || day > today) continue

    inRange++
    const picked = outcomeByKey.get(log.outcome)?.pickup ?? false
    if (picked) pickups++
    const bucket = perDayMap.get(day)
    if (bucket) {
      bucket.calls++
      if (picked) bucket.pickups++
    }
    outcomeCount.set(log.outcome, (outcomeCount.get(log.outcome) ?? 0) + 1)

    const ind = leadById.get(log.lead_id)?.industry?.trim() || 'Other'
    const row = industry.get(ind) ?? { calls: 0, pickups: 0, positive: 0, leads: new Set<string>() }
    row.calls++
    if (picked) row.pickups++
    if (POSITIVE.has(log.outcome) || log.temperature_after === 'hot') row.positive++
    row.leads.add(log.lead_id)
    industry.set(ind, row)
  }

  // Leads that are Hot right now count too (e.g. imported as hot later).
  for (const l of leads) if (l.temperature === 'hot') hotLeads.add(l.id)
  const hotWon = [...hotLeads].filter((id) => leadById.get(id)?.temperature === 'won').length

  return {
    callsToday,
    callsWeek,
    callsInRange: inRange,
    pickupRate: inRange ? pickups / inRange : null,
    byTemperature,
    hotEver: hotLeads.size,
    hotWon,
    hotToWon: hotLeads.size ? hotWon / hotLeads.size : null,
    perDay: [...perDayMap].map(([date, v]) => ({ date, ...v })),
    byIndustry: [...industry]
      .map(([name, v]) => ({
        industry: name,
        calls: v.calls,
        pickups: v.pickups,
        positive: v.positive,
        won: [...v.leads].filter((id) => leadById.get(id)?.temperature === 'won').length,
        pickupRate: v.calls ? v.pickups / v.calls : 0,
      }))
      .sort((a, b) => b.calls - a.calls),
    byOutcome: [...outcomeCount]
      .map(([key, count]) => ({ key, label: outcomeByKey.get(key)?.label ?? key, count }))
      .sort((a, b) => b.count - a.count),
    queueToday,
    overdue,
  }
}
