"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import { Bell, LogOut, Settings as SettingsIcon, User } from "lucide-react";
import { ArgonLogo } from "@/components/brand/argon-logo";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/layout/mode-toggle";

import { useTranslations } from "next-intl";

// Slim top bar (Airy). Pages carry their own big title (PageHeader), so
// this only holds the logo on phones plus the global actions.
export function Header() {
  const t = useTranslations("Header");
  const { profile, signOut } = useAuth();
  const unreadNotifications = useUnreadNotifications();

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-6 lg:px-8">
      <Link href="/dashboard" aria-label="Argon CRM" className="lg:hidden">
        <ArgonLogo size={28} />
      </Link>
      <span className="hidden lg:block" />

      <div className="flex items-center gap-1.5 sm:gap-2">
        <ModeToggle />
        <Link
          href="/notifications"
          aria-label={t("notifications")}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadNotifications > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          ) : null}
        </Link>

        <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-muted/70 focus:bg-muted/70 focus:outline-none data-popup-open:bg-muted/70 sm:gap-3 sm:pl-1 sm:pr-3"
          aria-label={t("openAccountMenu")}
        >
          <Avatar className="size-9">
            {profile?.avatar_url ? (
              <AvatarImage
                src={profile.avatar_url}
                alt={profile.full_name ?? t("defaultAvatar")}
              />
            ) : null}
            <AvatarFallback className="bg-pastel-lilac text-sm font-bold text-pastel-lilac-fg">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-semibold text-foreground lg:inline">
            {profile?.full_name ?? t("defaultUser")}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="min-w-56 bg-popover text-popover-foreground ring-border"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-foreground">
              {profile?.full_name ?? t("defaultUser")}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {profile?.email ?? ""}
            </p>
          </div>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            render={
              <Link
                href="/settings?tab=profile"
                className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
              />
            }
          >
            <User className="size-4" />
            {t("menuProfile")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <Link
                href="/settings?tab=whatsapp"
                className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
              />
            }
          >
            <SettingsIcon className="size-4" />
            {t("menuSettings")}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={signOut}
            className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <LogOut className="size-4" />
            {t("menuSignOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
