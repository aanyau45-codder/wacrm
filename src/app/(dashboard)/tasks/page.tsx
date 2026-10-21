'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, ListChecks, Loader2, PhoneCall, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { RemindersCard } from '@/components/tasks/reminders-card'
import { TaskSheet } from '@/components/tasks/task-sheet'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCan } from '@/hooks/use-can'
import { formatDate, kampalaToday } from '@/lib/calling/dates'
import { formatDue, remindLabel, sortTasks, taskGroup, type Task } from '@/lib/tasks/tasks'
import { cn } from '@/lib/utils'

type Row = Task & { lead: { business_name: string } | null }
type Tab = 'today' | 'upcoming' | 'done'

const SELECT = '*, lead:call_leads(business_name)'

export default function TasksPage() {
  const { user } = useAuth()
  const canWrite = useCan('send-messages')
  const [tasks, setTasks] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [openId, setOpenId] = useState<string | 'new' | null>(null)
  const [now, setNow] = useState(() => new Date())
  const deepLinked = useRef(false)
  const userId = user?.id

  const load = useCallback(async () => {
    if (!userId) return
    const db = createClient()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [open, done] = await Promise.all([
      db.from('tasks').select(SELECT).eq('user_id', userId).is('done_at', null).order('due_at').limit(500),
      db.from('tasks').select(SELECT).eq('user_id', userId).gte('done_at', since).order('done_at', { ascending: false }).limit(100),
    ])
    const err = open.error ?? done.error
    if (err) {
      setError(err.message)
      return
    }
    const all = [...(open.data ?? []), ...(done.data ?? [])] as Row[]
    setTasks(all)
    setNow(new Date())
    // /tasks?task=ID (from a reminder) opens that task once; ?new=1 adds one.
    if (!deepLinked.current) {
      deepLinked.current = true
      const params = new URLSearchParams(window.location.search)
      const linked = params.get('task')
      if (linked && all.some((t) => t.id === linked)) setOpenId(linked)
      else if (params.get('new')) setOpenId('new')
    }
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    // Back from the background (e.g. after a notification): refresh.
    const onVisible = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [load])

  const groups = useMemo(() => {
    const g: Record<'overdue' | 'today' | 'upcoming' | 'done', Row[]> = { overdue: [], today: [], upcoming: [], done: [] }
    for (const t of sortTasks(tasks ?? [])) g[taskGroup(t, now)].push(t)
    return g
  }, [tasks, now])

  const openTask = openId && openId !== 'new' ? (tasks?.find((t) => t.id === openId) ?? null) : null

  function upsert(task: Task) {
    setTasks((ts) => {
      const prev = (ts ?? []).find((t) => t.id === task.id)
      const row = { ...task, lead: prev?.lead ?? null } as Row
      return prev ? (ts ?? []).map((t) => (t.id === task.id ? row : t)) : [...(ts ?? []), row]
    })
  }

  async function toggleDone(task: Row) {
    if (!canWrite) return
    const done_at = task.done_at ? null : new Date().toISOString()
    upsert({ ...task, done_at })
    const { error: err } = await createClient().from('tasks').update({ done_at }).eq('id', task.id)
    if (err) {
      upsert(task)
      toast.error(err.message)
    } else if (done_at) {
      toast.success('Done', { action: { label: 'Undo', onClick: () => void toggleDone({ ...task, done_at }) } })
    }
  }

  const todayCount = groups.overdue.length + groups.today.length
  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'today', label: 'Today', count: todayCount },
    { key: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
    { key: 'done', label: 'Done', count: groups.done.length },
  ]

  const subtitle =
    tasks === null
      ? ' '
      : [
          groups.overdue.length ? `${groups.overdue.length} overdue` : null,
          `${groups.today.length} due today`,
          groups.upcoming.length ? `${groups.upcoming.length} coming up` : null,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        kicker={formatDate(kampalaToday(now))}
        title="Tasks"
        subtitle={subtitle}
        actions={
          canWrite ? (
            <Button className="h-11 rounded-full bg-foreground px-5 text-background hover:bg-foreground/90" onClick={() => setOpenId('new')}>
              <Plus /> New task
            </Button>
          ) : null
        }
        className="mb-0"
      />

      <RemindersCard />

      <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
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
                  t.key === 'today' && groups.overdue.length ? 'bg-pastel-coral px-1 text-pastel-coral-fg' : 'opacity-60',
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Couldn’t load tasks: {error}
        </p>
      ) : tasks === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : tab === 'today' ? (
        todayCount === 0 ? (
          <Empty
            text={groups.upcoming.length ? 'Nothing due today 🎉' : 'No tasks yet. Add one, or add a call-back time when you log a call.'}
            onAdd={canWrite ? () => setOpenId('new') : undefined}
          />
        ) : (
          <div className="space-y-5">
            {groups.overdue.length ? (
              <Section title="Overdue" tone="text-pastel-coral-fg">
                {groups.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} now={now} overdue onOpen={() => setOpenId(t.id)} onToggle={() => void toggleDone(t)} />
                ))}
              </Section>
            ) : null}
            {groups.today.length ? (
              <Section title="Today">
                {groups.today.map((t) => (
                  <TaskRow key={t.id} task={t} now={now} onOpen={() => setOpenId(t.id)} onToggle={() => void toggleDone(t)} />
                ))}
              </Section>
            ) : null}
          </div>
        )
      ) : (tab === 'upcoming' ? groups.upcoming : groups.done).length === 0 ? (
        <Empty text={tab === 'upcoming' ? 'Nothing coming up.' : 'Nothing done in the last 30 days.'} />
      ) : (
        <ul className="space-y-2">
          {(tab === 'upcoming' ? groups.upcoming : groups.done).map((t) => (
            <TaskRow key={t.id} task={t} now={now} onOpen={() => setOpenId(t.id)} onToggle={() => void toggleDone(t)} />
          ))}
        </ul>
      )}

      <TaskSheet
        open={openId !== null}
        task={openTask}
        leadName={openTask?.lead?.business_name}
        canWrite={canWrite}
        onClose={() => setOpenId(null)}
        onSaved={(t) => {
          upsert(t)
          setOpenId(null)
        }}
        onDeleted={(id) => {
          setTasks((ts) => (ts ?? []).filter((t) => t.id !== id))
          setOpenId(null)
        }}
      />
    </div>
  )
}

function Section({ title, tone, children }: { title: string; tone?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={cn('mb-2 px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase', tone)}>{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

function Empty({ text, onAdd }: { text: string; onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border p-8 text-center">
      <ListChecks className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {onAdd ? (
        <Button variant="outline" className="rounded-full" onClick={onAdd}>
          <Plus /> New task
        </Button>
      ) : null}
    </div>
  )
}

function TaskRow({
  task,
  now,
  overdue,
  onOpen,
  onToggle,
}: {
  task: Row
  now: Date
  overdue?: boolean
  onOpen: () => void
  onToggle: () => void
}) {
  const done = !!task.done_at
  return (
    <li className="flex items-center gap-3 rounded-[22px] border border-border bg-card p-3 pl-2.5">
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          done ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/60',
        )}
      >
        {done ? <Check className="h-4 w-4" /> : null}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={cn('block truncate text-[15px] font-semibold', done && 'text-muted-foreground line-through')}>
          {task.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className={cn('tabular-nums', overdue && 'font-semibold text-pastel-coral-fg')}>{formatDue(task.due_at, now)}</span>
          {task.remind_minutes !== null && !done ? (
            <span className="inline-flex items-center gap-1" title={remindLabel(task.remind_minutes)}>
              <Bell className="h-3 w-3" />
              {task.remind_minutes === 0 ? 'on time' : remindLabel(task.remind_minutes).replace(' before', '')}
            </span>
          ) : null}
          {task.lead ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <PhoneCall className="h-3 w-3 shrink-0" />
              <span className="truncate">{task.lead.business_name}</span>
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}
