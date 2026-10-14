'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle2, ExternalLink, Loader2, MapPin, Trash2 } from 'lucide-react'

import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingsPanelHead } from './settings-panel-head'

interface SourceStatus {
  has_key: boolean
  env_key: boolean
  updated_at: string | null
  active: 'google_places' | 'ai_web' | 'none'
}

const ACTIVE_LABEL: Record<SourceStatus['active'], string> = {
  google_places: 'Google Maps listings',
  ai_web: 'AI web search (OpenRouter)',
  none: 'Not set up',
}

/**
 * Settings → Lead search. Holds the Google Places API key used by
 * Calls → Find leads. The key is checked with Google, stored encrypted
 * on the server and never shown again.
 */
export function LeadSearchSettings() {
  const { canEditSettings } = useAuth()
  const [status, setStatus] = useState<SourceStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/calling/source-key')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setLoadError(data.error ?? 'Could not load lead search settings')
      return
    }
    setLoadError(null)
    setStatus(data as SourceStatus)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load, same as other settings panels
    void load()
  }, [load])

  async function save() {
    if (!key.trim()) return toast.error('Paste your Google Places API key')
    setSaving(true)
    const res = await fetch('/api/calling/source-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_places_api_key: key.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return toast.error(data.error ?? 'Could not save the key')
    setKey('')
    toast.success('Google Places key saved')
    void load()
  }

  async function remove() {
    if (!confirm('Remove the Google Places key? Find leads will stop using Google Maps.')) return
    setRemoving(true)
    const res = await fetch('/api/calling/source-key', { method: 'DELETE' })
    setRemoving(false)
    if (!res.ok) return toast.error('Could not remove the key')
    toast.success('Key removed')
    void load()
  }

  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Lead search"
        description={
          <>
            The Google Places API key used by <Link href="/calls/find" className="underline">Calls → Find leads</Link> to pull real
            Ugandan businesses with phone numbers from Google Maps.
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <MapPin className="size-4" /> Google Places API key
          </CardTitle>
          <CardDescription>
            Stored encrypted on the server. It is checked with Google before saving and never shown again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError ? (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p>
          ) : !status ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 p-3 text-sm">
              {status.has_key ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="font-medium">Key saved</span>
                  {status.updated_at ? (
                    <span className="text-muted-foreground">
                      · {new Date(status.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">No key saved{status.env_key ? ' (using the server’s default key)' : ''}</span>
              )}
              <span className="ml-auto text-muted-foreground">
                Find leads uses: <b className="text-foreground">{ACTIVE_LABEL[status.active]}</b>
              </span>
            </div>
          )}

          {canEditSettings ? (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <Input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={status?.has_key ? 'Paste a new key to replace it' : 'AIza…'}
                className="h-10 flex-1"
              />
              <Button type="submit" className="h-10" disabled={saving || !key.trim()}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                {status?.has_key ? 'Replace key' : 'Save key'}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Only admins can change this key.</p>
          )}

          {canEditSettings && status?.has_key ? (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={remove} disabled={removing}>
              {removing ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove key
            </Button>
          ) : null}

          <div className="space-y-1.5 border-t border-border pt-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How to get a key</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Open{' '}
                <a href="https://console.cloud.google.com/apis/library/places.googleapis.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                  Places API (New) <ExternalLink className="size-3" />
                </a>{' '}
                and click Enable (a billing account is required; Google gives a monthly free allowance).
              </li>
              <li>Go to APIs &amp; Services → Credentials → Create credentials → API key.</li>
              <li>Restrict the key to “Places API (New)”, then paste it here.</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
