'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ExternalLink, Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { formatDay } from '@/lib/calling/dates'
import { withTag } from '@/lib/calling/list-tags'
import { formatPhone } from '@/lib/calling/phone'
import type { DedupeStatus, LeadInput, PreviewLead } from '@/lib/calling/types'
import { cn } from '@/lib/utils'

const STATUS: Record<DedupeStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-pastel-mint text-pastel-mint-fg' },
  duplicate: { label: 'Already have', className: 'bg-muted text-muted-foreground' },
  dnc: { label: 'Do not call', className: 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' },
  no_phone: { label: 'No phone', className: 'bg-pastel-coral text-pastel-coral-fg' },
}

function toLeadInput(l: PreviewLead): LeadInput {
  const copy: Partial<PreviewLead> = { ...l }
  delete copy.key
  delete copy.status
  delete copy.reason
  return copy as LeadInput
}

interface Props {
  leads: PreviewLead[]
  /** Tag added to every imported lead (e.g. "Schools"); editable here. */
  defaultTag?: string
  /** Called after a successful import. */
  onImported?: () => void
}

/**
 * Preview of leads from search or a file. Only "new" rows can be
 * picked; nothing is saved until "Import selected" is pressed.
 */
export function LeadPreview({ leads, defaultTag = '', onImported }: Props) {
  const importable = useMemo(() => leads.filter((l) => l.status === 'new'), [leads])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(importable.map((l) => l.key)))
  const [saving, setSaving] = useState(false)
  const [tag, setTag] = useState(defaultTag)
  const [result, setResult] = useState<{ imported: number; skipped: number; firstDate: string | null; lastDate: string | null } | null>(null)

  const counts = useMemo(() => {
    const c: Record<DedupeStatus, number> = { new: 0, duplicate: 0, dnc: 0, no_phone: 0 }
    for (const l of leads) c[l.status]++
    return c
  }, [leads])

  function toggle(key: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  async function importSelected() {
    const picked = importable.filter((l) => selected.has(l.key))
    if (!picked.length) return toast.error('Pick at least one lead')
    setSaving(true)
    try {
      const res = await fetch('/api/calling/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: picked.map((l) => {
            const input = toLeadInput(l)
            return { ...input, tags: withTag(input.tags, tag) }
          }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult(data)
      toast.success(`Imported ${data.imported} leads`)
      onImported?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    return (
      <div className="rounded-3xl bg-pastel-mint p-6 text-center">
        <p className="font-heading text-3xl font-semibold">{result.imported}</p>
        <p className="text-sm text-foreground/70">leads added to your call queue</p>
        {result.firstDate ? (
          <p className="mt-2 text-sm">
            Scheduled {formatDay(result.firstDate)}
            {result.lastDate && result.lastDate !== result.firstDate ? ` → ${formatDay(result.lastDate)}` : ''}, highest priority first.
          </p>
        ) : null}
        {result.skipped ? <p className="mt-1 text-xs text-foreground/60">{result.skipped} skipped as duplicates.</p> : null}
        <Link href="/calls" className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background">
          Start calling
        </Link>
      </div>
    )
  }

  const allOn = importable.length > 0 && importable.every((l) => selected.has(l.key))

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2">
        <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-sm font-semibold">List tag</span>
        <Input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          maxLength={40}
          placeholder="e.g. Schools"
          className="h-9 rounded-xl bg-card"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(Object.keys(STATUS) as DedupeStatus[]).map((s) =>
          counts[s] ? (
            <span key={s} className={cn('rounded-full px-2.5 py-1 font-semibold', STATUS[s].className)}>
              {counts[s]} {STATUS[s].label.toLowerCase()}
            </span>
          ) : null,
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <label className="flex items-center gap-3 border-b border-border bg-muted/50 px-3 py-2 text-sm font-medium">
          <Checkbox
            checked={allOn}
            onCheckedChange={(on) => setSelected(on ? new Set(importable.map((l) => l.key)) : new Set())}
          />
          Select all new ({importable.length})
        </label>
        <ul className="divide-y divide-border">
          {leads.map((l) => {
            const pickable = l.status === 'new'
            const socials = Object.entries(l.social_links ?? {})
            return (
              <li key={l.key} className={cn('flex gap-3 px-3 py-3', !pickable && 'opacity-60')}>
                <Checkbox
                  className="mt-0.5"
                  disabled={!pickable}
                  checked={pickable && selected.has(l.key)}
                  onCheckedChange={() => toggle(l.key)}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{l.business_name || '—'}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS[l.status].className)}>
                      {STATUS[l.status].label}
                    </span>
                  </div>
                  <p className="text-sm tabular-nums">
                    {l.phone ? formatPhone(l.phone) : <span className="text-muted-foreground">no phone</span>}
                    {l.contact_person ? <span className="text-muted-foreground"> · {l.contact_person}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[l.town, l.address].filter(Boolean).join(' · ')}
                    {l.email ? ` · ${l.email}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {l.website ? (
                      <a href={l.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                        Website <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {socials.map(([k, url]) => (
                      <a key={k} href={url} target="_blank" rel="noreferrer" className="capitalize underline">
                        {k}
                      </a>
                    ))}
                    {l.maps_url ? (
                      <a href={l.maps_url} target="_blank" rel="noreferrer" className="underline">
                        Maps
                      </a>
                    ) : null}
                    <span className="text-muted-foreground">via {l.source.replace('_', ' ')}</span>
                  </div>
                  {l.lead_note ? <p className="text-xs text-foreground/80">💡 {l.lead_note}</p> : null}
                  {l.reason && !pickable ? <p className="text-xs text-muted-foreground">{l.reason}</p> : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <Button className="h-11 w-full" onClick={importSelected} disabled={saving || selected.size === 0}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Import {selected.size} selected
        </Button>
      </div>
    </div>
  )
}
