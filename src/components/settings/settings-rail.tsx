'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  RAIL_GROUPS,
  SECTION_META,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from './settings-sections';

/**
 * The settings left rail — a grouped vertical column on desktop. On
 * phones it never scrolls sideways: it renders as grouped list cards
 * under the Overview, and is hidden while a section is open (the page
 * shows a back link instead).
 */
export function SettingsRail({
  active,
  onSelect,
  hints,
}: {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  hints?: Partial<Record<SettingsSection, ReactNode>>;
}) {
  const t = useTranslations('Settings');

  return (
    <nav
      aria-label="Settings sections"
      className={cn(
        'flex-col gap-4 lg:sticky lg:top-0 lg:flex lg:gap-0',
        active === 'overview' ? 'flex' : 'hidden',
      )}
    >
      {RAIL_GROUPS.map(({ label, group }) => {
        const items = SETTINGS_SECTIONS.filter(
          (s) => SECTION_META[s].group === group,
        );
        return (
          <div key={group} className={cn(group === 'top' && 'hidden lg:block')}>
            {label ? (
              <div className="px-1 pb-2 text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase lg:px-3 lg:pt-4 lg:pb-1.5 lg:text-[11px]">
                {t(`groups.${group}`)}
              </div>
            ) : null}
            <div className="flex flex-col gap-0.5 rounded-[22px] border border-border bg-card p-1.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
            {items.map((s) => {
              const meta = SECTION_META[s];
              const Icon = meta.icon;
              const isActive = s === active;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSelect(s)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[15px] font-semibold whitespace-nowrap transition-colors lg:py-2 lg:text-sm',
                    isActive
                      ? 'bg-foreground text-background'
                      : 'text-foreground hover:bg-muted lg:text-muted-foreground lg:hover:text-foreground',
                  )}
                >
                  <Icon className="size-[18px] shrink-0 lg:size-4" />
                  <span className="flex-1">{t(`sections.${s}`)}</span>
                  {hints?.[s] != null ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-xs font-medium',
                        isActive ? 'text-background/70' : 'text-muted-foreground',
                      )}
                    >
                      {hints[s]}
                    </span>
                  ) : null}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground lg:hidden" />
                </button>
              );
            })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
