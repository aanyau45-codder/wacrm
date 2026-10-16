import type { CallLead } from './types'

// "List types" on the Calls page: the tags a lead was imported with
// (e.g. "Schools" from schools.xlsx), plus its industry so leads
// imported before auto-tagging still show up under a type.

const MAX_TAG = 40

/** "private_schools-kampala.xlsx" → "Private schools kampala". */
export function tagFromFileName(fileName: string): string {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TAG)
  return base ? base[0].toUpperCase() + base.slice(1) : ''
}

/** Case-insensitive key so "Schools" and "schools " are one type. */
export function typeKey(s: string): string {
  return s.trim().toLowerCase()
}

/** Add `tag` to `tags` unless it's blank or already there. */
export function withTag(tags: string[] | undefined, tag: string): string[] {
  const list = tags ?? []
  const t = tag.trim().slice(0, MAX_TAG)
  if (!t || list.some((x) => typeKey(x) === typeKey(t))) return list
  return [...list, t]
}

/** The types a lead belongs to (tags first, then industry), deduped. */
export function leadTypes(lead: Pick<CallLead, 'tags' | 'industry'>): string[] {
  let out: string[] = []
  for (const t of lead.tags ?? []) out = withTag(out, t)
  if (lead.industry) out = withTag(out, lead.industry)
  return out
}

/** Every type across `leads` with its lead count, biggest first. */
export function countTypes(leads: Pick<CallLead, 'tags' | 'industry'>[]): { key: string; label: string; count: number }[] {
  const byKey = new Map<string, { key: string; label: string; count: number }>()
  for (const l of leads) {
    for (const t of leadTypes(l)) {
      const key = typeKey(t)
      const row = byKey.get(key) ?? { key, label: t, count: 0 }
      row.count += 1
      byKey.set(key, row)
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
