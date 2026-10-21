import type { CallLead } from './types'

// The weekly list of NEW leads (never called). Imports go to a pool
// (no date); "Refresh list" tops the list up to the weekly goal from
// the pool, and never past it. Follow-ups (leads already called) are
// a separate list and don't count towards the goal.
//
//   pool      attempts 0, next_call_date null
//   list      attempts 0, next_call_date set (the day it was added)
//   follow-up attempts > 0, next_call_date set

export type ListLead = Pick<
  CallLead,
  'id' | 'priority' | 'created_at' | 'next_call_date' | 'attempts' | 'do_not_call' | 'phone_invalid' | 'temperature'
>

/** Just what the list/pool/follow-up checks read. */
export type QueueState = Pick<CallLead, 'next_call_date' | 'attempts' | 'do_not_call' | 'phone_invalid' | 'temperature'>

const CLOSED = new Set(['won', 'lost', 'dnc'])

/** Never called and still callable. */
export function isNewLead(l: QueueState): boolean {
  return l.attempts === 0 && !l.do_not_call && !l.phone_invalid && !CLOSED.has(l.temperature ?? '')
}

export const isOnList = (l: QueueState) => isNewLead(l) && !!l.next_call_date
export const isInPool = (l: QueueState) => isNewLead(l) && !l.next_call_date
export const isFollowUp = (l: QueueState) =>
  l.attempts > 0 && !!l.next_call_date && !l.do_not_call && !l.phone_invalid

export interface RefreshPlan {
  /** Ids to (re)date to today — kept from the list or pulled from the pool. */
  toList: string[]
  /** Ids sent back to the pool (list was over the goal). */
  toPool: string[]
  listSize: number
  poolLeft: number
}

const byPriority = (a: ListLead, b: ListLead) =>
  b.priority - a.priority || a.created_at.localeCompare(b.created_at)

/**
 * Keep the leads already on the list (longest-waiting first) up to
 * `goal`, send any extra back to the pool, then fill the gaps from the
 * pool by priority. Everything kept is dated `today` so nothing on
 * the list shows as overdue.
 */
export function planRefresh(leads: ListLead[], goal: number, today: string): RefreshPlan {
  const target = Math.max(0, Math.floor(goal))
  const onList = leads
    .filter(isOnList)
    .sort((a, b) => a.next_call_date!.localeCompare(b.next_call_date!) || byPriority(a, b))
  const pool = leads.filter(isInPool).sort(byPriority)

  const kept = onList.slice(0, target)
  const pulled = pool.slice(0, Math.max(0, target - kept.length))
  return {
    toList: [...kept.filter((l) => l.next_call_date !== today), ...pulled].map((l) => l.id),
    toPool: onList.slice(target).map((l) => l.id),
    listSize: kept.length + pulled.length,
    poolLeft: pool.length - pulled.length,
  }
}
