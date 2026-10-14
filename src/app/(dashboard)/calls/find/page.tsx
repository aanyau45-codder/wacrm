'use client'

import { useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CallsHeader } from '@/components/calling/calls-nav'
import { LeadPreview } from '@/components/calling/lead-preview'
import type { PreviewLead } from '@/lib/calling/types'
import { cn } from '@/lib/utils'

const TOWNS = ['Kampala', 'Ntinda', 'Kololo', 'Nakawa', 'Wakiso', 'Entebbe', 'Mukono', 'Jinja', 'Mbarara', 'Gulu', 'Mbale', 'Fort Portal', 'Masaka', 'Lira', 'Arua', 'Hoima']
const INDUSTRIES = ['Restaurants', 'Hotels', 'Private schools', 'Clinics', 'Pharmacies', 'Hardware shops', 'Salons', 'Supermarkets', 'Real estate agents', 'Car dealers', 'Law firms', 'Gyms']
const COUNTS = [10, 20, 40, 60]

export default function FindLeadsPage() {
  const [industry, setIndustry] = useState('')
  const [locations, setLocations] = useState<string[]>(['Kampala'])
  const [custom, setCustom] = useState('')
  const [count, setCount] = useState(20)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ leads: PreviewLead[]; source: string } | null>(null)
  const [runId, setRunId] = useState(0)

  function toggleTown(t: string) {
    setLocations((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]))
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!industry.trim()) return toast.error('What kind of business?')
    if (!locations.length) return toast.error('Pick at least one location')
    setLoading(true)
    setResults(null)
    try {
      const res = await fetch('/api/calling/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: industry.trim(), locations, count }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      setResults({ leads: data.leads, source: data.source?.label ?? '' })
      setRunId((n) => n + 1)
      if (!data.leads.length) toast.message('No businesses found — try another industry or town.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CallsHeader
        title="Find leads"
        description="Search Ugandan businesses. You review everything before it's saved."
      />

      <form onSubmit={search} className="space-y-5 rounded-3xl bg-pastel-lilac p-4 sm:p-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="industry">Industry</label>
          <Input
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Private schools, Hardware shops"
            className="h-11 rounded-xl bg-card"
          />
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRIES.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndustry(i)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  industry === i ? 'bg-foreground text-background' : 'bg-card/70 hover:bg-card',
                )}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Locations</p>
          <div className="flex flex-wrap gap-1.5">
            {[...TOWNS, ...locations.filter((l) => !TOWNS.includes(l))].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTown(t)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium',
                  locations.includes(t) ? 'bg-foreground text-background' : 'bg-card/70 hover:bg-card',
                )}
              >
                {t}
                {locations.includes(t) && !TOWNS.includes(t) ? <X className="h-3 w-3" /> : null}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Add another town or area"
              className="h-10 rounded-xl bg-card"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const t = custom.trim()
                  if (t && !locations.includes(t)) setLocations((l) => [...l, t])
                  setCustom('')
                }
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">How many</p>
          <div className="flex gap-1.5">
            {COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCount(c)}
                className={cn(
                  'h-10 flex-1 rounded-xl text-sm font-semibold sm:flex-none sm:px-5',
                  count === c ? 'bg-foreground text-background' : 'bg-card/70 hover:bg-card',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" className="h-11 w-full rounded-xl text-sm" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {loading ? 'Searching… this can take up to a minute' : 'Search'}
        </Button>
      </form>

      {results && results.leads.length > 0 ? (
        <section className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {results.leads.length} results from {results.source}. Duplicates and Do Not Call numbers are already filtered out.
          </p>
          <LeadPreview key={runId} leads={results.leads} />
        </section>
      ) : null}
    </div>
  )
}
