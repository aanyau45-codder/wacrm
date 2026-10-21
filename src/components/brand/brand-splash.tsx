import { ArgonMark } from "@/components/brand/argon-logo";
import { cn } from "@/lib/utils";

// Full-screen brand screen: the Argon mark in the middle and "Argon CRM."
// at the bottom. While loading the mark slowly fades dark and faint and
// back; with `children` (e.g. the offline message) it holds still.
// public/offline.html draws the same screen for the service worker —
// keep them in sync.

export const SPLASH_MARK_SIZE = 210;

export function BrandSplash({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6",
        className,
      )}
      role={children ? "alert" : "status"}
      aria-label={children ? undefined : "Loading"}
    >
      <ArgonMark
        size={SPLASH_MARK_SIZE}
        className={cn("max-w-[55vw] h-auto", children ? "opacity-40" : "animate-brand-breathe")}
      />
      {children ? <div className="mt-8 max-w-xs text-center">{children}</div> : null}
      <p className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+28px)] text-center text-sm font-medium text-muted-foreground">
        Argon CRM.
      </p>
    </div>
  );
}
