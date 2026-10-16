'use client'

import { useRef, useState } from 'react'
import { FileSpreadsheet, Loader2, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CallsHeader } from '@/components/calling/calls-nav'
import { LeadPreview } from '@/components/calling/lead-preview'
import { tagFromFileName, withTag } from '@/lib/calling/list-tags'
import { parseLeadFile } from '@/lib/calling/parse-leads'
import type { LeadInput, PreviewLead } from '@/lib/calling/types'

async function checkLeads(leads: LeadInput[]): Promise<PreviewLead[]> {
  const res = await fetch('/api/calling/dedupe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Could not check the leads')
  return data.leads
}

export default function ImportLeadsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<PreviewLead[] | null>(null)
  const [mapped, setMapped] = useState<string | null>(null)
  // Auto list tag: the industry typed above, else the file name.
  const [listTag, setListTag] = useState('')
  const [runId, setRunId] = useState(0)
  const [industry, setIndustry] = useState('')
  const [manual, setManual] = useState({ business_name: '', phone: '', contact_person: '', town: '', industry: '' })

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setPreview(null)
    try {
      const parsed = await parseLeadFile(file, industry.trim() ? { industry: industry.trim() } : {})
      if (parsed.error) throw new Error(parsed.error)
      setListTag(industry.trim() || tagFromFileName(file.name))
      setMapped(parsed.mapped.map((m) => `${m.column} → ${m.field.replace('_', ' ')}`).join(' · '))
      setPreview(await checkLeads(parsed.leads))
      setRunId((n) => n + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read the file')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault()
    if (!manual.business_name.trim() || !manual.phone.trim()) return toast.error('Name and phone are required')
    setBusy(true)
    try {
      const lead = { ...manual, source: 'manual' as const, tags: withTag([], manual.industry) }
      const [checked] = await checkLeads([lead])
      if (checked.status !== 'new') throw new Error(checked.reason ?? 'Already in your list')
      const res = await fetch('/api/calling/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: [lead] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not add the lead')
      toast.success(`${manual.business_name} added to the queue`)
      setManual({ business_name: '', phone: '', contact_person: '', town: '', industry: '' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the lead')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CallsHeader title="Import leads" description="CSV or Excel. Duplicates and Do Not Call numbers are skipped." />

      <div className="space-y-4 rounded-3xl bg-pastel-peach p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card/80">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="text-sm text-foreground/80">
            <p className="font-semibold text-foreground">Upload a .csv or .xlsx file</p>
            <p>Needs a business name column and a phone column. Email, website, town, address, industry, notes and priority are picked up too.</p>
          </div>
        </div>
        <Input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="List name or industry, e.g. Schools (optional)"
          className="h-10 rounded-xl bg-card"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button className="h-11 w-full rounded-xl" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          Choose file
        </Button>
      </div>

      {preview ? (
        <section className="space-y-2">
          {mapped ? <p className="text-xs text-muted-foreground">Columns: {mapped}</p> : null}
          <LeadPreview key={runId} leads={preview} defaultTag={listTag} />
        </section>
      ) : null}

      <form onSubmit={addManual} className="space-y-3 rounded-3xl border border-border p-4 sm:p-6">
        <p className="font-semibold">Add one lead</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Business name *" value={manual.business_name} onChange={(e) => setManual({ ...manual, business_name: e.target.value })} className="h-10" />
          <Input placeholder="Phone *" inputMode="tel" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} className="h-10" />
          <Input placeholder="Contact person" value={manual.contact_person} onChange={(e) => setManual({ ...manual, contact_person: e.target.value })} className="h-10" />
          <Input placeholder="Town" value={manual.town} onChange={(e) => setManual({ ...manual, town: e.target.value })} className="h-10" />
          <Input placeholder="Industry" value={manual.industry} onChange={(e) => setManual({ ...manual, industry: e.target.value })} className="h-10 sm:col-span-2" />
        </div>
        <Button type="submit" variant="outline" className="h-10" disabled={busy}>
          <Plus /> Add to queue
        </Button>
      </form>
    </div>
  )
}
