'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, FileUp, PhoneCall, Search, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/calls', label: 'Call today', icon: PhoneCall },
  { href: '/calls/find', label: 'Find leads', icon: Search },
  { href: '/calls/import', label: 'Import', icon: FileUp },
  { href: '/calls/dashboard', label: 'Results', icon: BarChart3 },
  { href: '/calls/settings', label: 'Settings', icon: Settings2 },
]

/** Sub-navigation shared by every /calls page (scrolls sideways on phones). */
export function CallsNav() {
  const pathname = usePathname()
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/calls' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-pastel-lilac text-violet-900 dark:text-violet-100'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </div>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {kicker ? <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{kicker}</p> : null}
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <CallsNav />
    </div>
  )
}
