"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bell,
  Bot,
  GitBranch,
  Home,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  PhoneCall,
  Radio,
  Settings,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import { useTaskCounts } from "@/hooks/use-task-counts";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// Mobile tab bar (Airy): four destinations plus "More", which opens a
// sheet with everything else as pastel tiles. Hidden on lg+, where the
// sidebar takes over, and while a page marks itself full-screen with
// `data-hide-nav` (e.g. an open inbox thread, so the composer is free).

const TABS = [
  { href: "/dashboard", labelKey: "home", icon: Home },
  { href: "/inbox", labelKey: "inbox", icon: MessageSquare },
  { href: "/calls", labelKey: "calls", icon: PhoneCall },
  { href: "/contacts", labelKey: "contacts", icon: Users },
] as const;

const MORE = [
  { href: "/tasks", labelKey: "tasks", icon: ListChecks, tone: "bg-pastel-mint text-pastel-mint-fg" },
  { href: "/pipelines", labelKey: "pipelineShort", icon: GitBranch, tone: "bg-pastel-lilac text-pastel-lilac-fg" },
  { href: "/broadcasts", labelKey: "broadcasts", icon: Radio, tone: "bg-pastel-peach text-pastel-peach-fg" },
  { href: "/automations", labelKey: "automations", icon: Zap, tone: "bg-pastel-mint text-pastel-mint-fg" },
  { href: "/flows", labelKey: "flows", icon: Workflow, tone: "bg-pastel-sky text-pastel-sky-fg" },
  { href: "/agents", labelKey: "agentsShort", icon: Bot, tone: "bg-pastel-coral text-pastel-coral-fg" },
  { href: "/notifications", labelKey: "notifications", icon: Bell, tone: "bg-pastel-grey text-pastel-grey-fg" },
  { href: "/settings", labelKey: "settings", icon: Settings, tone: "bg-pastel-grey text-pastel-grey-fg" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function BottomNav() {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();
  const taskCounts = useTaskCounts();
  const tasksDue = taskCounts.overdue + taskCounts.today;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((m) => isActive(pathname, m.href));

  useEffect(() => {
    // Picking a tile navigates; close the sheet once the route changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        aria-label="Primary"
        className="flex h-[72px] shrink-0 items-stretch border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden [:root:has([data-hide-nav])_&]:hidden"
      >
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const dot = tab.href === "/inbox" && totalUnread > 0 && !active;
          return (
            <Link key={tab.href} href={tab.href} className="flex-1">
              <TabInner icon={tab.icon} label={t(tab.labelKey)} active={active} dot={dot} />
            </Link>
          );
        })}
        <button type="button" onClick={() => setMoreOpen(true)} className="flex-1">
          <TabInner
            icon={LayoutGrid}
            label={t("more")}
            active={moreActive || moreOpen}
            dot={unreadNotifications > 0 || taskCounts.overdue > 0}
          />
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-border" />
          <SheetTitle className="px-1 text-lg font-extrabold tracking-tight">{t("moreTitle")}</SheetTitle>
          <div className="grid grid-cols-3 gap-3">
            {MORE.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "relative flex min-h-[92px] flex-col justify-between rounded-[20px] p-3 text-[13px] font-bold transition-transform active:scale-[0.97]",
                  m.tone,
                  isActive(pathname, m.href) && "ring-2 ring-foreground/70",
                )}
              >
                <m.icon className="h-5 w-5" />
                <span className="leading-tight">{t(m.labelKey)}</span>
                {m.href === "/notifications" && unreadNotifications > 0 ? (
                  <span className="absolute top-2.5 right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                ) : null}
                {m.href === "/tasks" && tasksDue > 0 ? (
                  <span
                    className={cn(
                      "absolute top-2.5 right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      taskCounts.overdue > 0 ? "bg-pastel-coral-fg text-white" : "bg-foreground text-background",
                    )}
                  >
                    {tasksDue > 9 ? "9+" : tasksDue}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TabInner({
  icon: Icon,
  label,
  active,
  dot,
}: {
  icon: typeof Home;
  label: string;
  active: boolean;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "relative flex h-[30px] w-[52px] items-center justify-center rounded-full transition-colors",
          active && "bg-foreground text-background",
        )}
      >
        <Icon className="h-[19px] w-[19px]" />
        {dot ? (
          <span className="absolute top-0.5 right-2.5 h-2 w-2 rounded-full bg-pastel-coral-fg ring-2 ring-card" />
        ) : null}
      </span>
      {label}
    </span>
  );
}
