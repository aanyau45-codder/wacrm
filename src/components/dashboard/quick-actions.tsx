"use client"

import Link from 'next/link'
import { UserPlus, Briefcase, Radio, Zap } from 'lucide-react'
import type { ComponentType } from 'react'

import { useTranslations } from 'next-intl'

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages,
// which is out of scope here.
interface Action {
  labelKey: string
  href: string
  icon: ComponentType<{ className?: string }>
  tint: string
}

const ACTIONS: Action[] = [
  { labelKey: 'newContact', href: '/contacts', icon: UserPlus, tint: 'bg-pastel-lilac text-pastel-lilac-fg' },
  { labelKey: 'newDeal', href: '/pipelines', icon: Briefcase, tint: 'bg-pastel-mint text-pastel-mint-fg' },
  { labelKey: 'newBroadcast', href: '/broadcasts/new', icon: Radio, tint: 'bg-pastel-peach text-pastel-peach-fg' },
  { labelKey: 'newAutomation', href: '/automations/new', icon: Zap, tint: 'bg-pastel-sky text-pastel-sky-fg' },
]

export function QuickActions() {
  const t = useTranslations('Dashboard.quickActions')
  
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      {ACTIONS.map((a) => {
        const Icon = a.icon
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex flex-col justify-between gap-3 rounded-[22px] border border-border bg-card p-4 transition-colors hover:bg-muted/60 lg:min-h-[104px]"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${a.tint}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm leading-tight font-semibold text-foreground">{t(a.labelKey as string)}</span>
          </Link>
        )
      })}
    </div>
  )
}
