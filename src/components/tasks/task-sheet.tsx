'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, PhoneCall, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { kampalaToday } from '@/lib/calling/dates'
import {
  DEFAULT_REMIND_MINUTES,
  REMIND_OPTIONS,
  isoToKampala,
  kampalaToIso,
  scheduleFields,
  type Task,
} from '@/lib/tasks/tasks'

export interface TaskDraft {
  title?: string
  lead_id?: string | null
  deal_id?: string | null
  contact_id?: string | null
  /** Shown as the linked lead's name. */
  leadName?: string | null
}

interface Props {
  open: boolean
  /** Editing an existing task, or null to add one. */
  task: Task | null
  draft?: TaskDraft
  leadName?: string | null
  canWrite: boolean
  onClose: () => void
  onSaved: (task: Task) => void
  onDeleted?: (id: string) => void
}

/** Next whole hour in Kampala, as a default time for a new task. */
function nextHour(): { date: string; time: string } {
  const { date, time } = isoToKampala(new Date(Date.now() + 60 * 60 * 1000))
  return { date, time: `${time.slice(0, 2)}:00` }
}

export function TaskSheet(props: Props) {
  return (
    <Sheet open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-border" />
        {/* Keyed so the form resets for each task. */}
        {props.open ? <TaskForm key={props.task?.id ?? 'new'} {...props} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function TaskForm({ task, draft, leadName, canWrite, onClose, onSaved, onDeleted }: Props) {
  const { accountId, user } = useAuth()
  const initial = task ? isoToKampala(task.due_at) : nextHour()
  const [title, setTitle] = useState(task?.title ?? draft?.title ?? '')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [remind, setRemind] = useState<number | null>(task ? task.remind_minutes : DEFAULT_REMIND_MINUTES)
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [busy, setBusy] = useState<'save' | 'done' | 'delete' | null>(null)
  const leadId = task?.lead_id ?? draft?.lead_id ?? null
  const linkedName = leadName ?? draft?.leadName ?? null

  async function save() {
    if (!title.trim()) return toast.error('Give the task a name')
    if (!date || !time) return toast.error('Pick a date and time')
    if (!accountId || !user) return
    setBusy('save')
    const dueAt = kampalaToIso(date, time)
    const unchangedSchedule = task && task.due_at === dueAt && task.remind_minutes === remind
    const fields = {
      title: title.trim().slice(0, 200),
      notes: notes.trim() || null,
      ...(unchangedSchedule ? {} : scheduleFields(dueAt, remind)),
    }
    const db = createClient()
    const { data, error } = task
      ? await db.from('tasks').update(fields).eq('id', task.id).select().single()
      : await db
          .from('tasks')
          .insert({
            ...fields,
            ...scheduleFields(dueAt, remind),
            account_id: accountId,
            user_id: user.id,
            lead_id: leadId,
            deal_id: draft?.deal_id ?? null,
            contact_id: draft?.contact_id ?? null,
          })
          .select()
          .single()
    setBusy(null)
    if (error) return toast.error(error.message)
    toast.success(task ? 'Task updated' : 'Task added')
    onSaved(data as Task)
  }

  async function toggleDone() {
    if (!task) return
    setBusy('done')
    const { data, error } = await createClient()
      .from('tasks')
      .update({ done_at: task.done_at ? null : new Date().toISOString() })
      .eq('id', task.id)
      .select()
      .single()
    setBusy(null)
    if (error) return toast.error(error.message)
    onSaved(data as Task)
  }

  async function remove() {
    if (!task || !confirm(`Delete “${task.title}”?`)) return
    setBusy('delete')
    const { error } = await createClient().from('tasks').delete().eq('id', task.id)
    setBusy(null)
    if (error) return toast.error(error.message)
    toast.success('Task deleted')
    onDeleted?.(task.id)
  }

  return (
    <div className="space-y-4">
      <SheetTitle className="px-1 text-lg font-extrabold tracking-tight">{task ? 'Task' : 'New task'}</SheetTitle>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing? e.g. Call Acme back"
        aria-label="Task"
        disabled={!canWrite}
        autoFocus={!task}
        className="h-12 rounded-[14px] bg-card text-base"
      />

      <div className="grid grid-cols-[1fr_7.5rem] gap-2">
        <Input
          type="date"
          value={date}
          min={task ? undefined : kampalaToday()}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          disabled={!canWrite}
          className="h-11 rounded-[14px] bg-card"
        />
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Time"
          disabled={!canWrite}
          className="h-11 rounded-[14px] bg-card"
        />
      </div>

      <select
        value={remind ?? ''}
        onChange={(e) => setRemind(e.target.value === '' ? null : Number(e.target.value))}
        aria-label="Reminder"
        disabled={!canWrite}
        className="h-11 w-full rounded-[14px] border border-border bg-card px-3 text-sm"
      >
        {REMIND_OPTIONS.map((o) => (
          <option key={o.label} value={o.value ?? ''}>
            {o.value === null ? o.label : `Remind me ${o.label.toLowerCase()}`}
          </option>
        ))}
      </select>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        disabled={!canWrite}
        className="rounded-[14px] bg-card"
      />

      {leadId ? (
        <Link
          href={`/calls?lead=${leadId}`}
          onClick={onClose}
          className="flex items-center gap-2.5 rounded-2xl bg-pastel-sky px-3.5 py-3 text-sm font-semibold text-pastel-sky-fg"
        >
          <PhoneCall className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{linkedName ?? 'Open the lead'}</span>
          <span className="text-xs opacity-70">Open</span>
        </Link>
      ) : null}

      {canWrite ? (
        <div className="flex gap-2 pt-1">
          {task ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 shrink-0 rounded-2xl text-destructive"
                onClick={remove}
                disabled={!!busy}
                aria-label="Delete task"
              >
                {busy === 'delete' ? <Loader2 className="animate-spin" /> : <Trash2 />}
              </Button>
              <Button variant="outline" className="h-12 flex-1 rounded-2xl" onClick={toggleDone} disabled={!!busy}>
                {busy === 'done' ? <Loader2 className="animate-spin" /> : task.done_at ? <RotateCcw /> : <Check />}
                {task.done_at ? 'Not done' : 'Done'}
              </Button>
            </>
          ) : null}
          <Button
            className="h-12 flex-[2] rounded-2xl bg-foreground text-background hover:bg-foreground/90"
            onClick={save}
            disabled={!!busy}
          >
            {busy === 'save' ? <Loader2 className="animate-spin" /> : null}
            {task ? 'Save' : 'Add task'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
