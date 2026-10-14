import type { LeadInput } from './types'

// ============================================================
// CSV / Excel → LeadInput[]. Header names are matched loosely
// ("Business Name", "company", "Tel", "Mobile No." …) so exports
// from Google Sheets, Excel or other tools import without editing.
// ============================================================

type Field = keyof Pick<
  LeadInput,
  | 'business_name'
  | 'contact_person'
  | 'phone'
  | 'email'
  | 'website'
  | 'industry'
  | 'town'
  | 'address'
  | 'maps_url'
  | 'lead_note'
  | 'priority'
>

const HEADER_ALIASES: Record<Field, string[]> = {
  business_name: ['business name', 'business', 'name', 'company', 'company name', 'organisation', 'organization', 'shop', 'store'],
  contact_person: ['contact person', 'contact name', 'owner', 'manager', 'person', 'first name'],
  phone: ['phone', 'phone number', 'tel', 'telephone', 'mobile', 'mobile number', 'mobile no', 'phone no', 'contact', 'contact number', 'whatsapp', 'cell'],
  email: ['email', 'e mail', 'email address', 'mail'],
  website: ['website', 'web', 'url', 'site', 'web site'],
  industry: ['industry', 'category', 'sector', 'type', 'business type'],
  town: ['town', 'city', 'location', 'district', 'area', 'region'],
  address: ['address', 'street', 'physical address', 'street address'],
  maps_url: ['maps', 'maps link', 'google maps', 'map', 'maps url'],
  lead_note: ['notes', 'note', 'remarks', 'comments', 'description', 'why'],
  priority: ['priority', 'score', 'rank'],
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Map column index → field, first match wins. */
export function mapHeaders(headers: string[]): Map<number, Field> {
  const map = new Map<number, Field>()
  const taken = new Set<Field>()
  const normed = headers.map(normHeader)
  // Exact alias matches first, then "contains" matches.
  for (const pass of ['exact', 'contains'] as const) {
    normed.forEach((h, i) => {
      if (map.has(i) || !h) return
      for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
        if (taken.has(field)) continue
        const hit =
          pass === 'exact'
            ? aliases.includes(h)
            : aliases.some((a) => a.length > 3 && h.includes(a))
        if (hit) {
          map.set(i, field)
          taken.add(field)
          return
        }
      }
    })
  }
  return map
}

/** RFC 4180-ish CSV parsing: quoted fields, escaped quotes, newlines in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  // Semicolon-separated files (Excel in some locales).
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === delim) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

export interface ParsedLeads {
  leads: LeadInput[]
  /** Columns recognised, for the preview ("Phone ← 'Mobile No.'"). */
  mapped: { column: string; field: Field }[]
  error?: string
}

/** Turn a 2-D table (header row first) into leads. */
export function rowsToLeads(rows: unknown[][], defaults: Partial<LeadInput> = {}): ParsedLeads {
  if (rows.length < 2) return { leads: [], mapped: [], error: 'The file has no data rows.' }
  const headers = rows[0].map((h) => String(h ?? ''))
  const map = mapHeaders(headers)
  const fields = new Set(map.values())
  if (!fields.has('business_name') || !fields.has('phone')) {
    return {
      leads: [],
      mapped: [...map].map(([i, field]) => ({ column: headers[i], field })),
      error: 'Need at least a business name column and a phone column.',
    }
  }
  const leads: LeadInput[] = []
  for (const row of rows.slice(1)) {
    const lead: LeadInput = { business_name: '', source: 'csv', ...defaults }
    for (const [i, field] of map) {
      const raw = row[i]
      if (raw === null || raw === undefined || raw === '') continue
      if (field === 'priority') {
        const n = Number(raw)
        if (Number.isFinite(n)) lead.priority = n
      } else {
        lead[field] = String(raw).trim()
      }
    }
    if (lead.business_name || lead.phone) leads.push(lead)
  }
  return { leads, mapped: [...map].map(([i, field]) => ({ column: headers[i], field })) }
}

/** Parse an uploaded .csv/.xlsx file in the browser. */
export async function parseLeadFile(file: File, defaults: Partial<LeadInput> = {}): Promise<ParsedLeads> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser')
    const sheet = await readSheet(file)
    return rowsToLeads(sheet as unknown[][], defaults)
  }
  if (name.endsWith('.xls')) {
    return { leads: [], mapped: [], error: 'Old .xls files aren’t supported — save as .xlsx or .csv.' }
  }
  return rowsToLeads(parseCsv(await file.text()), defaults)
}
