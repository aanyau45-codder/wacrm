'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, FileUp, PhoneCall, Search, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/calls', label: 'Call today', short: 'Today', icon: PhoneCall },
  { href: '/calls/find', label: 'Find leads', short: 'Find', icon: Search },
  { href: '/calls/import', label: 'Import', short: 'Import', icon: FileUp },
  { href: '/calls/dashboard', label: 'Results', short: 'Results', icon: BarChart3 },
  { href: '/calls/settings', label: 'Settings', short: 'Settings', icon: Settings2 },
]

/** Sub-navigation shared by every /calls page: equal-width tabs, never scrolls. */
export function CallsNav() {
  const pathname = usePathname()
  return (
    <nav className="flex border-b border-border">
      {ITEMS.map(({ href, label, short, icon: Icon }) => {
        const active = href === '/calls' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex min-w-0 flex-1 items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-colors sm:text-sm',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="hidden h-4 w-4 shrink-0 sm:block" />
            <span className="truncate sm:hidden">{short}</span>
            <span className="hidden truncate sm:inline">{label}</span>
            {active ? <span className="absolute inset-x-[22%] -bottom-px h-[3px] rounded-full bg-foreground" /> : null}
          </Link>
        )
      })}
    </nav>
  )
}

export function CallsHeader({
  title,
  kicker,
  description,
  action,
}: {
  title: string
  kicker?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {kicker ? <p className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">{kicker}</p> : null}
          <h1 className="mt-1 text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] text-foreground sm:text-[30px]">{title}</h1>
          {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <CallsNav />
    </div>
  )
}
